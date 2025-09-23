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
  console.log(`[API] GET /api/boards - Starting request`);

  try {
    // VERCEL ENVIRONMENT DEBUGGING
    console.log('[VERCEL-ENV] Environment Analysis:', {
      NODE_ENV: process.env.NODE_ENV,
      platform: process.platform,
      runtime: process.env.VERCEL ? 'Vercel' : 'Local',
      vercelRegion: process.env.VERCEL_REGION || 'unknown',
      vercelRuntime: process.env.VERCEL_RUNTIME || 'unknown',
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    console.log('[VERCEL-BUILD] Build Configuration:', {
      hasNextConfig: typeof require !== 'undefined' ? 'available' : 'unavailable',
      prismaClient: {
        exists: !!prisma,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(prisma)).filter(name => name.startsWith('$')),
        models: Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'))
      },
      serverlessOptimization: {
        functionTimeout: process.env.VERCEL_FUNCTION_TIMEOUT || 'default',
        maxDuration: process.env.VERCEL_FUNCTION_MAX_DURATION || 'default'
      }
    });

    console.log('[VERCEL-ENV] Database Environment Variables:', {
      DATABASE_URL_exists: !!process.env.DATABASE_URL,
      DATABASE_URL_prefix: process.env.DATABASE_URL?.substring(0, 50) + '...',
      DIRECT_URL_exists: !!process.env.DIRECT_URL,
      DIRECT_URL_prefix: process.env.DIRECT_URL?.substring(0, 50) + '...',
      allDatabaseKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes('database')),
      allSupabaseKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes('supabase'))
    });

    // Test Prisma client status first
    console.log('[API] Testing Prisma client status...');
    console.log('[PRISMA-STATUS] Client Analysis:', {
      clientExists: !!prisma,
      clientType: typeof prisma,
      hasQueryMethod: typeof prisma.$queryRaw === 'function',
      hasConnectMethod: typeof prisma.$connect === 'function',
      hasDisconnectMethod: typeof prisma.$disconnect === 'function',
      prismaVersion: process.env.npm_package_dependencies_prisma || 'unknown'
    });

    // Test database connection with timeout
    console.log('[API] Testing database connection...');
    const connectionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
    );

    try {
      await Promise.race([prisma.$connect(), connectionTimeout]);
      console.log('[API] ✅ Database connected successfully');

      // Test a simple query to verify connection works
      console.log('[API] Testing simple query...');
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('[API] ✅ Simple query successful:', testQuery);

      // Test raw database connection without Prisma
      console.log('[API] Testing raw SQL query...');
      try {
        const rawSqlTest = await prisma.$queryRaw`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`;
        console.log('[API] ✅ Raw SQL test successful:', rawSqlTest);
      } catch (rawSqlError) {
        console.error('[API] ⚠️ Raw SQL test failed:', {
          error: rawSqlError,
          message: rawSqlError instanceof Error ? rawSqlError.message : 'Unknown raw SQL error'
        });
      }
    } catch (connectionError) {
      console.error('[API] 🚫 Database connection failed:', {
        error: connectionError,
        message: connectionError instanceof Error ? connectionError.message : 'Unknown connection error',
        stack: connectionError instanceof Error ? connectionError.stack : 'No stack trace',
        environment: {
          nodeEnv: process.env.NODE_ENV,
          isVercel: !!process.env.VERCEL,
          databaseUrlExists: !!process.env.DATABASE_URL,
          databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 50) + '...'
        }
      });
      throw connectionError;
    }

    // Authenticate user and get cookies to set
    console.log('[API] Authenticating user...');
    const { user, error: authError, cookiesToSet } = await authenticateAppRouterRequest(request);

    console.log('[API] Auth result:', {
      hasUser: !!user,
      authError: authError || 'none',
      userIdType: user ? typeof user.id : 'no user',
      userIdLength: user ? user.id.length : 0
    });

    if (!user) {
      console.log('[API] ❌ Authentication failed:', authError);
      return createErrorResponse(401, 'Authentication required', 'unauthenticated');
    }

    console.log('[API] ✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email,
      userIdFormat: user.id
    });

    // Validate and format user ID for UUID compatibility
    console.log('[API] Validating user ID format...');
    const userId = user.id;

    // Check if user ID is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(userId);

    console.log('[API] User ID validation:', {
      userId: userId,
      length: userId.length,
      isValidUUID: isValidUUID,
      format: isValidUUID ? 'Valid UUID' : 'Invalid UUID format'
    });

    if (!isValidUUID) {
      console.error('[API] ❌ User ID is not a valid UUID format:', userId);
      return createErrorResponse(400, 'Invalid user ID format - expected UUID', 'invalid_user_id');
    }

    // Fetch boards owned by the user
    console.log('[API] Querying boards for user with valid UUID...');
    const boards = await prisma.board.findMany({
      where: {
        ownerId: userId
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`[API] ✅ Query successful - Found ${boards.length} boards for user:`, { userId: user.id });

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
    console.error('[API] ❌ DETAILED ERROR ANALYSIS:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type',
      cause: error instanceof Error ? error.cause : 'No cause',
    });

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      console.error('[API] 🔌 Database connection error detected');
      return createErrorResponse(500, 'Database connection failed - check environment variables', 'db_connection');
    }

    if (errorMessage.includes('UUID') || errorMessage.includes('invalid input syntax')) {
      console.error('[API] 🔢 UUID format error detected');
      return createErrorResponse(500, 'User ID format invalid - UUID mismatch', 'uuid_format');
    }

    if (errorMessage.includes('Environment variable') || errorMessage.includes('DATABASE_URL')) {
      console.error('[API] ⚙️ Environment variable error detected');
      return createErrorResponse(500, 'Missing required environment variables', 'env_vars');
    }

    if (errorMessage.includes('Prisma')) {
      console.error('[API] 📦 Prisma client error detected');
      return createErrorResponse(500, 'Database client error - check Prisma configuration', 'prisma_error');
    }

    console.error('[API] 🚫 Unclassified error');
    return createErrorResponse(500, `Server error: ${errorMessage}`, 'server_error');
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
    } catch {
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
      },
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