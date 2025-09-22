import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  isValidId
} from '@/types/domain';
import { authenticateAppRouterRequest } from '../../_auth';
import { 
  createErrorResponse, 
  createSuccessResponse,
  handleCORS 
} from '../../_utils';

export async function OPTIONS() {
  return handleCORS();
}

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[API] DELETE /api/boards/${id}`);

  if (!id || typeof id !== 'string' || !isValidId(id)) {
    return createErrorResponse(400, 'Valid board ID is required', 'invalid_board_id');
  }

  try {
    // Authenticate user
    const { user, error: authError } = await authenticateAppRouterRequest(request);
    if (!user) {
      console.log('[API] Authentication failed:', authError);
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Check if the board exists and is owned by the current user
    const board = await prisma.board.findUnique({
      where: { id }
    });

    if (!board) {
      return createErrorResponse(404, 'Board not found', 'board_not_found');
    }

    // Check ownership - only the owner can delete their board
    const boardOwnerId = board.ownerId;
    if (boardOwnerId !== user.id) {
      return createErrorResponse(403, 'You can only delete your own boards', 'forbidden');
    }

    // Delete the board (this will cascade delete nodes and edges due to the schema)
    await prisma.board.delete({
      where: { id }
    });

    console.log(`[API] Board ${id} deleted successfully by user ${user.id}`);
    return createSuccessResponse({ message: 'Board deleted successfully' });

  } catch (error: unknown) {
    console.error('[API] delete board error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

// Optional: Add PUT for board updates
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[API] PUT /api/boards/${id}`);

  if (!id || typeof id !== 'string' || !isValidId(id)) {
    return createErrorResponse(400, 'Valid board ID is required', 'invalid_board_id');
  }

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse request body
    let body: { title?: string; description?: string };
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }

    // Check ownership
    const board = await prisma.board.findUnique({
      where: { id }
    });

    if (!board) {
      return createErrorResponse(404, 'Board not found', 'board_not_found');
    }

    if (board.ownerId !== user.id) {
      return createErrorResponse(403, 'You can only edit your own boards', 'forbidden');
    }

    // Update board
    const updatedBoard = await prisma.board.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      }
    });

    console.log(`[API] Board ${id} updated successfully by user ${user.id}`);
    return createSuccessResponse({ message: 'Board updated successfully', board: updatedBoard });

  } catch (error: unknown) {
    console.error('[API] update board error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}