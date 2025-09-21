import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { 
  Node, 
  ApiSuccessResponse, 
  ApiErrorResponse, 
  CreateNodeRequest,
  UpdateNodeRequest,
  nodeToDTO,
  isValidNodeType
} from '@/types/domain';
import { 
  authenticateRequest, 
  authorizeBoardAccess, 
  sendAuthError, 
  extractBoardId 
} from '@/lib/auth';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiSuccessResponse<Node[]> | ApiSuccessResponse<Node> | ApiErrorResponse>
) {
  const method = req.method;
  console.log(`[API] ${method} /api/nodes`, {
    query: req.query,
    hasBody: !!req.body
  });

  try {
    if (method === 'GET') {
      // Extract board_id from query (supports both board_id and boardId)
      const boardId = extractBoardId(req.query);
      
      if (!boardId) {
        console.log('[API] Missing board_id parameter');
        return sendAuthError(res, 400, 'board_id parameter is required', 'missing_board_id');
      }

      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        console.log('[API] Authentication failed:', authError);
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      // Authorize board access
      const { authorized, error: authzError } = await authorizeBoardAccess(boardId, user.id);
      if (!authorized) {
        console.log('[API] Authorization failed:', authzError);
        const status = authzError === 'Board not found' ? 404 : 403;
        return sendAuthError(res, status, authzError || 'Access denied', 'unauthorized');
      }

      // Fetch nodes for the board
      const nodes = await prisma.node.findMany({
        where: { boardId },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`[API] Found ${nodes.length} nodes for board ${boardId}`);
      return res.status(200).json({ 
        data: nodes.map(nodeToDTO) 
      });
    }

    if (method === 'POST') {
      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      const body = req.body as CreateNodeRequest;
      
      if (!body.board_id || !body.type || !body.content || 
          body.x === undefined || body.y === undefined || 
          body.width === undefined || body.height === undefined) {
        return sendAuthError(res, 400, 'board_id, type, content, x, y, width, height are required', 'missing_fields');
      }

      if (!isValidNodeType(body.type)) {
        return sendAuthError(res, 400, 'Invalid node type', 'invalid_node_type');
      }

      // Authorize board access
      const { authorized } = await authorizeBoardAccess(body.board_id, user.id);
      if (!authorized) {
        return sendAuthError(res, 403, 'Access denied', 'unauthorized');
      }

      const node = await prisma.node.create({
        data: {
          boardId: body.board_id,
          type: body.type,
          content: body.content,
          rootId: body.root_id ?? null,
          parentId: body.parent_id ?? null,
          x: Math.floor(body.x),
          y: Math.floor(body.y),
          width: Math.floor(body.width),
          height: Math.floor(body.height),
        },
      });

      console.log(`[API] Created node ${node.id} for board ${body.board_id}`);
      return res.status(201).json({ data: nodeToDTO(node) });
    }

    if (method === 'PUT') {
      const id = req.query.id as string;
      
      if (!id) {
        return sendAuthError(res, 400, 'Node ID is required', 'missing_id');
      }

      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      // First check if node exists and get its board
      const existingNode = await prisma.node.findUnique({
        where: { id },
        select: { boardId: true }
      });

      if (!existingNode) {
        return sendAuthError(res, 404, 'Node not found', 'node_not_found');
      }

      // Authorize board access
      const { authorized } = await authorizeBoardAccess(existingNode.boardId, user.id);
      if (!authorized) {
        return sendAuthError(res, 403, 'Access denied', 'unauthorized');
      }

      const body = req.body as UpdateNodeRequest;
      const data: any = {};
      
      if (body.content !== undefined) data.content = body.content;
      if (body.type !== undefined) {
        if (!isValidNodeType(body.type)) {
          return sendAuthError(res, 400, 'Invalid node type', 'invalid_node_type');
        }
        data.type = body.type;
      }
      if (body.root_id !== undefined) data.rootId = body.root_id;
      if (body.parent_id !== undefined) data.parentId = body.parent_id;
      if (body.x !== undefined) data.x = Math.floor(body.x);
      if (body.y !== undefined) data.y = Math.floor(body.y);
      if (body.width !== undefined) data.width = Math.floor(body.width);
      if (body.height !== undefined) data.height = Math.floor(body.height);

      if (Object.keys(data).length === 0) {
        return sendAuthError(res, 400, 'At least one field must be provided for update', 'no_update_fields');
      }

      const node = await prisma.node.update({ where: { id }, data });

      console.log(`[API] Updated node ${id}`);
      return res.status(200).json({ data: nodeToDTO(node) });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return sendAuthError(res, 405, 'Method not allowed', 'method_not_allowed');
  } catch (error: unknown) {
    console.error('[API] nodes error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return sendAuthError(res, 500, errorMessage, 'server_error');
  }
}
