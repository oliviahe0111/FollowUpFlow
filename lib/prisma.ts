import { PrismaClient } from '@prisma/client';

declare global { var prisma: PrismaClient | undefined; }

// Enhanced Prisma client with better error handling and logging
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['warn', 'error', 'info'],
    errorFormat: 'pretty',
  });

// Add connection validation for production
if (process.env.NODE_ENV === 'production') {
  // Log environment variable status for debugging
  console.log('[PRISMA] Production environment detected');
  console.log('[PRISMA] DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('[PRISMA] DIRECT_URL exists:', !!process.env.DIRECT_URL);

  // Test database connection on startup
  prisma.$connect()
    .then(() => {
      console.log('[PRISMA] ✅ Database connection successful');
    })
    .catch((error) => {
      console.error('[PRISMA] ❌ Database connection failed:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      });
    });
} else {
  // Development mode - use global to prevent hot reload issues
  global.prisma = prisma;
}
