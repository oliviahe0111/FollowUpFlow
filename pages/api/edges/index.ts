import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { 
  Edge, 
  ApiSuccessResponse, 
  ApiErrorResponse, 
  CreateEdgeRequest,
  edgeToDTO
} from '@/types/domain';
import { 
  authenticateRequest, 
  authorizeBoardAccess, 
  sendAuthError, 
  extractBoardId 
} from '@/lib/auth';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiSuccessResponse<Edge[]> | ApiSuccessResponse<Edge> | ApiErrorResponse>
) {
  const method = req.method;
  console.log(`[API] ${method} /api/edges`, {
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

      // Fetch edges for the board
      const edges = await prisma.edge.findMany({
        where: { boardId },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`[API] Found ${edges.length} edges for board ${boardId}`);
      return res.status(200).json({ 
        data: edges.map(edgeToDTO) 
      });
    }

    if (method === 'POST') {
      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      const body = req.body as CreateEdgeRequest;
      
      if (!body.board_id || !body.source_id || !body.target_id) {
        return sendAuthError(res, 400, 'board_id, source_id, and target_id are required', 'missing_fields');
      }

      // Authorize board access
      const { authorized } = await authorizeBoardAccess(body.board_id, user.id);
      if (!authorized) {
        return sendAuthError(res, 403, 'Access denied', 'unauthorized');
      }

      const edge = await prisma.edge.create({
        data: {
          boardId: body.board_id,
          sourceId: body.source_id,
          targetId: body.target_id,
        },
      });

      console.log(`[API] Created edge ${edge.id} for board ${body.board_id}`);
      return res.status(201).json({ data: edgeToDTO(edge) });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendAuthError(res, 405, 'Method not allowed', 'method_not_allowed');
  } catch (error: unknown) {
    console.error('[API] edges error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return sendAuthError(res, 500, errorMessage, 'server_error');
  }
}
