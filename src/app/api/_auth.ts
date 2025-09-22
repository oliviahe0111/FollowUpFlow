/**
 * Authentication adapter for App Router
 * Bridges existing auth system with new Request/Response format
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface AuthResult {
  user: {
    id: string;
    email: string;
  } | null;
  error?: string;
}

/**
 * Authenticate App Router request using Supabase
 */
export async function authenticateAppRouterRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // App Router handles cookie setting differently
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.log('[AUTH] Authentication failed:', {
        error: error?.message,
        hasUser: !!user,
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      });
      return { user: null, error: error?.message || 'Unauthenticated' };
    }

    console.log('[AUTH] Authentication successful:', {
      userId: user.id,
      email: user.email
    });

    return {
      user: {
        id: user.id,
        email: user.email || '',
      },
    };
  } catch (error) {
    console.error('[AUTH] Authentication exception:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}