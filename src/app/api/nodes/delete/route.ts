import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidId } from '@/types/domain';
import { authenticateAppRouterRequest } from '../../_auth';
import { 
  createErrorResponse, 
  createSuccessResponse,
  parseJsonBody,
  handleCORS 
} from '../../_utils';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return handleCORS();
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/nodes/delete`);

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse and validate request body
    let body: { nodeId: string };
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }
    
    if (!body.nodeId) {
      return createErrorResponse(400, 'Node ID is required', 'missing_node_id');
    }

    if (!isValidId(body.nodeId)) {
      return createErrorResponse(400, 'Invalid node id format', 'invalid_node_id');
    }

    const nodeId = body.nodeId;

    // First check if node exists and get its board
    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
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

    // Delete related edges first (foreign key constraints)
    await prisma.edge.deleteMany({
      where: {
        OR: [
          { sourceId: nodeId },
          { targetId: nodeId }
        ]
      }
    });

    // Delete the node
    await prisma.node.delete({
      where: { id: nodeId }
    });

    console.log(`[API] Deleted node ${nodeId} and related edges`);
    return createSuccessResponse({ ok: true, deleted: true });

  } catch (error: unknown) {
    console.error('[API] node DELETE error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}