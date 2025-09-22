import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  CreateEdgeRequest,
  edgeToDTO,
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


export async function OPTIONS() {
  return handleCORS();
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  console.log(`[API] GET /api/edges`, {
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

    // Fetch edges for the board
    const edges = await prisma.edge.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`[API] Found ${edges.length} edges for board ${boardId}`);
    return createSuccessResponse(edges.map(edgeToDTO));

  } catch (error: unknown) {
    console.error('[API] edges GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/edges`);

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse and validate request body
    let body: CreateEdgeRequest;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }
    
    if (!body.board_id || !body.source_id || !body.target_id) {
      return createErrorResponse(400, 'Missing required fields: board_id, source_id, target_id', 'missing_fields');
    }

    if (!isValidId(body.source_id) || !isValidId(body.target_id)) {
      return createErrorResponse(400, 'Invalid source_id or target_id format', 'invalid_id_format');
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

    // Verify source and target nodes exist and belong to the board
    const [sourceNode, targetNode] = await Promise.all([
      prisma.node.findUnique({
        where: { id: body.source_id },
        select: { boardId: true }
      }),
      prisma.node.findUnique({
        where: { id: body.target_id },
        select: { boardId: true }
      })
    ]);

    if (!sourceNode || sourceNode.boardId !== body.board_id) {
      return createErrorResponse(404, 'Source node not found in board', 'source_node_not_found');
    }

    if (!targetNode || targetNode.boardId !== body.board_id) {
      return createErrorResponse(404, 'Target node not found in board', 'target_node_not_found');
    }

    // Create edge
    const edge = await prisma.edge.create({
      data: {
        boardId: body.board_id,
        sourceId: body.source_id,
        targetId: body.target_id,
      }
    });

    console.log(`[API] Created edge ${edge.id} from ${body.source_id} to ${body.target_id} for board ${body.board_id}`);
    return createSuccessResponse(edgeToDTO(edge), 201);

  } catch (error: unknown) {
    console.error('[API] edges POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}