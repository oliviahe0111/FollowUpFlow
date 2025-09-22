/**
 * Shared utilities for App Router API routes
 */
import { NextResponse, NextRequest } from 'next/server';
import { ApiErrorResponse } from '@/types/domain';

/**
 * Create standardized error response
 */
export function createErrorResponse(
  status: number, 
  message: string, 
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { 
      error: message, 
      code: code || 'error' 
    },
    { status }
  );
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T, 
  status: number = 200
): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody(request: NextRequest) {
  const body = await request.json();
  return body;
}

/**
 * Extract board_id from URL search params (supports both board_id and boardId)
 */
export function extractBoardIdFromParams(searchParams: URLSearchParams): string | null {
  return searchParams.get('board_id') || searchParams.get('boardId');
}

/**
 * CORS helper for OPTIONS requests
 */
export function handleCORS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}