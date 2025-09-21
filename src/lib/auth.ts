import { createServerClient } from '@supabase/ssr';
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { isValidId, ApiErrorResponse } from '@/types/domain';

export interface AuthResult {
  user: {
    id: string;
    email: string;
  } | null;
  error?: string;
}

export async function authenticateRequest(req: NextApiRequest, res: NextApiResponse): Promise<AuthResult> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => {
            return req.cookies[name];
          },
          set: () => {
            // We don't need to set cookies in API routes for read operations
          },
          remove: () => {
            // We don't need to remove cookies in API routes for read operations
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, error: error?.message || 'Unauthenticated' };
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
      },
    };
  } catch (error) {
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}

export async function authorizeBoardAccess(
  boardId: string, 
  userId: string
): Promise<{ authorized: boolean; board?: any; error?: string }> {
  try {
    if (!isValidId(boardId)) {
      return { authorized: false, error: 'Invalid board ID format' };
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return { authorized: false, error: 'Board not found' };
    }

    // Type assertion needed due to Prisma schema/DB sync issues
    const boardWithOwner = board as any;
    if (boardWithOwner.ownerId !== userId) {
      return { authorized: false, error: 'Access denied' };
    }

    return { authorized: true, board };
  } catch (error) {
    return { 
      authorized: false, 
      error: error instanceof Error ? error.message : 'Authorization failed' 
    };
  }
}

export function sendAuthError(res: NextApiResponse<ApiErrorResponse>, status: number, message: string, code?: string) {
  return res.status(status).json({ error: message, code });
}

export function extractBoardId(query: any): string | null {
  // Support both board_id and boardId query parameters
  const boardId = query.board_id || query.boardId;
  
  if (!boardId) {
    return null;
  }
  
  // Handle array case (shouldn't happen with proper routing, but defensive)
  if (Array.isArray(boardId)) {
    return boardId[0] || null;
  }
  
  return boardId;
}