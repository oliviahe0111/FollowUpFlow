import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { 
  ApiSuccessResponse, 
  ApiErrorResponse,
  isValidId
} from '@/types/domain';
import { 
  authenticateRequest, 
  sendAuthError 
} from '@/lib/auth';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiSuccessResponse<{ message: string }> | ApiErrorResponse>
) {
  const { id } = req.query;
  const method = req.method;
  
  console.log(`[API] ${method} /api/boards/${id}`);

  if (!id || typeof id !== 'string' || !isValidId(id)) {
    return sendAuthError(res, 400, 'Valid board ID is required', 'invalid_board_id');
  }

  try {
    if (method === 'DELETE') {
      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        console.log('[API] Authentication failed:', authError);
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      // Check if the board exists and is owned by the current user
      const board = await prisma.board.findUnique({
        where: { id }
      });

      if (!board) {
        return sendAuthError(res, 404, 'Board not found', 'board_not_found');
      }

      // Check ownership - only the owner can delete their board
      const boardOwnerId = (board as any).ownerId;
      if (boardOwnerId !== user.id) {
        return sendAuthError(res, 403, 'You can only delete your own boards', 'forbidden');
      }

      // Delete the board (this will cascade delete nodes and edges due to the schema)
      await prisma.board.delete({
        where: { id }
      });

      console.log(`[API] Board ${id} deleted successfully by user ${user.id}`);
      return res.status(200).json({ 
        data: { message: 'Board deleted successfully' } 
      });
    }

    res.setHeader('Allow', 'DELETE');
    return sendAuthError(res, 405, 'Method not allowed', 'method_not_allowed');
  } catch (error: unknown) {
    console.error('[API] delete board error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return sendAuthError(res, 500, errorMessage, 'server_error');
  }
}