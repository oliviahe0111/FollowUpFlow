import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { 
  Board, 
  ApiSuccessResponse, 
  ApiErrorResponse, 
  CreateBoardRequest,
  boardToDTO
} from '@/types/domain';
import { 
  authenticateRequest, 
  sendAuthError 
} from '@/lib/auth';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiSuccessResponse<Board[]> | ApiSuccessResponse<Board> | ApiErrorResponse>
) {
  const method = req.method;
  console.log(`[API] ${method} /api/boards`, {
    hasBody: !!req.body
  });

  try {
    if (method === 'GET') {
      // Authenticate user
      const { user, error: authError } = await authenticateRequest(req, res);
      if (!user) {
        console.log('[API] Authentication failed:', authError);
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      // Fetch boards owned by the user
      const boards = await prisma.board.findMany({
        where: { 
          ownerId: user.id 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        orderBy: { createdAt: 'desc' }
      });

      console.log(`[API] Found ${boards.length} boards for user ${user.id}`);
      return res.status(200).json({ 
        data: boards.map(boardToDTO) 
      });
    }

    if (method === 'POST') {
      // Authenticate user
      const { user } = await authenticateRequest(req, res);
      if (!user) {
        return sendAuthError(res, 401, 'Authentication required', 'unauthenticated');
      }

      const body = req.body as CreateBoardRequest;
      
      if (!body.title?.trim()) {
        return sendAuthError(res, 400, 'title is required', 'missing_title');
      }

      const board = await prisma.board.create({
        data: {
          title: body.title.trim(),
          description: body.description?.trim() || null,
          ownerId: user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      console.log(`[API] Created board ${board.id} for user ${user.id}`);
      return res.status(201).json({ data: boardToDTO(board) });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendAuthError(res, 405, 'Method not allowed', 'method_not_allowed');
  } catch (error: unknown) {
    console.error('[API] boards error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return sendAuthError(res, 500, errorMessage, 'server_error');
  }
}