import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  Board, 
  CreateBoardRequest,
  boardToDTO,
  ApiSuccessResponse,
  ApiErrorResponse
} from '@/types/domain';
import { authenticateAppRouterRequest } from '../_auth';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  parseJsonBody,
  handleCORS 
} from '../_utils';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return handleCORS();
}

export async function GET(request: NextRequest) {
  console.log(`[API] GET /api/boards`);

  try {
    // Authenticate user
    const { user, error: authError } = await authenticateAppRouterRequest(request);
    if (!user) {
      console.log('[API] Authentication failed:', authError);
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
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
    return createSuccessResponse(boards.map(boardToDTO));

  } catch (error: unknown) {
    console.error('[API] boards GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/boards`);

  try {
    // Authenticate user
    const { user } = await authenticateAppRouterRequest(request);
    if (!user) {
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    // Parse and validate request body
    let body: CreateBoardRequest;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body', 'invalid_json');
    }
    
    if (!body.title?.trim()) {
      return createErrorResponse(400, 'title is required', 'missing_title');
    }

    // Create board
    const board = await prisma.board.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        ownerId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    console.log(`[API] Created board ${board.id} for user ${user.id}`);
    return createSuccessResponse(boardToDTO(board), 201);

  } catch (error: unknown) {
    console.error('[API] boards POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}