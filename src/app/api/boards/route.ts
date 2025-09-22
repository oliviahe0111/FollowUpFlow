import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  CreateBoardRequest,
  boardToDTO
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
    // Authenticate user and get cookies to set
    const { user, error: authError, cookiesToSet } = await authenticateAppRouterRequest(request);
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

    console.log(`[API] Found ${boards.length} boards for user:`, { userId: user.id });

    // Create response with preserved cookies
    const successData = { data: boards.map(boardToDTO) };
    const response = NextResponse.json(successData);
    
    // Set all cookies that were collected during authentication
    if (cookiesToSet) {
      cookiesToSet.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      });
    }
    
    return response;

  } catch (error: unknown) {
    console.error('[API] boards GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}

export async function POST(request: NextRequest) {
  console.log(`[API] POST /api/boards`);

  try {
    // Authenticate user and get cookies to set
    const { user, error: authError, cookiesToSet } = await authenticateAppRouterRequest(request);
    if (!user) {
      console.log('[API] Authentication failed:', authError);
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
    
    // Create success response and set cookies
    const response = createSuccessResponse(boardToDTO(board), 201);
    
    // Set all cookies that were collected during authentication
    if (cookiesToSet) {
      cookiesToSet.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      });
    }
    
    return response;

  } catch (error: unknown) {
    console.error('[API] boards POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return createErrorResponse(500, errorMessage, 'server_error');
  }
}