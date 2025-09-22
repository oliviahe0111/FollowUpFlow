import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  Node, 
  CreateNodeRequest,
  UpdateNodeRequest,
  nodeToDTO,
  isValidNodeType,
  isValidId
} from '@/types/domain';
import { authenticateAppRouterRequest } from '../_auth';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  parseJsonBody,
  extractBoardIdFromParams,
  handleCORS 
} from '../_utils';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  console.log(`[API] GET /api/nodes`, {
    query: Object.fromEntries(searchParams.entries())
  });

  try {
    // Extract board_id from query (supports both board_id and boardId)
    const boardId = extractBoardIdFromParams(searchParams);
    
    if (!boardId) {
      console.log('[API] Missing board_id parameter');
      return createErrorResponse(400, 'board_id parameter is required', 'missing_board_id');
    }

    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Authorize board access
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true }
    });

    if (!board) {
      return createErrorResponse(404, 'Board not found', 'board_not_found');
    }

    if (board.ownerId !== user.id) {
      return createErrorResponse(403, 'Access denied', 'unauthorized');
    }

    // Fetch nodes for the board
    const nodes = await prisma.node.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`[API] Found ${nodes.length} nodes for board ${boardId}`);
    return createSuccessResponse(nodes.map(nodeToDTO));

  } catch (error: unknown) {
    console.error('[API] nodes GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/nodes`);

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse and validate request body
    let body: CreateNodeRequest;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }
    
    if (!body.board_id || !body.type || !body.content || 
        body.x === undefined || body.y === undefined || 
        !body.width || !body.height) {
      return createErrorResponse(400, 'Missing required fields: board_id, type, content, x, y, width, height', 'missing_fields');
    }

    if (!isValidNodeType(body.type)) {
      return createErrorResponse(400, 'Invalid node type', 'invalid_node_type');
    }

    // Authorize board access
    const board = await prisma.board.findUnique({
      where: { id: body.board_id },
      select: { ownerId: true }
    });

    if (!board) {
      return createErrorResponse(404, 'Board not found', 'board_not_found');
    }

    if (board.ownerId !== user.id) {
      return createErrorResponse(403, 'Access denied', 'unauthorized');
    }

    // Create node
    const node = await prisma.node.create({
      data: {
        boardId: body.board_id,
        type: body.type,
        content: body.content,
        rootId: body.root_id || null,
        parentId: body.parent_id || null,
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
      }
    });

    console.log(`[API] Created node ${node.id} for board ${body.board_id}`);
    return createSuccessResponse(nodeToDTO(node), 201);

  } catch (error: unknown) {
    console.error('[API] nodes POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  console.log(`[API] PUT /api/nodes`, {
    id,
    query: Object.fromEntries(searchParams.entries())
  });

  if (!id || !isValidId(id)) {
    return createErrorResponse(400, 'Valid node id parameter is required', 'missing_node_id');
  }

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // First check if node exists and get its board
    const existingNode = await prisma.node.findUnique({
      where: { id },
      select: { boardId: true }
    });

    if (!existingNode) {
      return createErrorResponse(404, 'Node not found', 'node_not_found');
    }

    // Authorize board access
    const board = await prisma.board.findUnique({
      where: { id: existingNode.boardId },
      select: { ownerId: true }
    });

    if (!board || board.ownerId !== user.id) {
      return createErrorResponse(403, 'Access denied', 'unauthorized');
    }

    // Parse and validate request body
    let body: UpdateNodeRequest;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    
    if (body.content !== undefined) data.content = body.content;
    if (body.type !== undefined) {
      if (!isValidNodeType(body.type)) {
        return createErrorResponse(400, 'Invalid node type', 'invalid_node_type');
      }
      data.type = body.type;
    }
    if (body.x !== undefined) data.x = body.x;
    if (body.y !== undefined) data.y = body.y;
    if (body.width !== undefined) data.width = body.width;
    if (body.height !== undefined) data.height = body.height;
    if (body.parent_id !== undefined) data.parentId = body.parent_id;
    if (body.root_id !== undefined) data.rootId = body.root_id;

    // Update node
    const updatedNode = await prisma.node.update({
      where: { id },
      data
    });

    console.log(`[API] Updated node ${id}`);
    return createSuccessResponse(nodeToDTO(updatedNode));

  } catch (error: unknown) {
    console.error('[API] nodes PUT error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}