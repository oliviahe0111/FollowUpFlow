import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;

    // Forward to the pages API route
    const baseUrl = request.nextUrl.origin;
    const apiResponse = await fetch(`${baseUrl}/api/nodes/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nodeId })
    });

    const result = await apiResponse.json();
    
    if (!apiResponse.ok) {
      return NextResponse.json(result, { status: apiResponse.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Delete operation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}