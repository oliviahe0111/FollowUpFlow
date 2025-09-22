/**
 * Authentication adapter for App Router
 * Bridges existing auth system with new Request/Response format
 */
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

interface CookieOptions {
  domain?: string;
  expires?: Date | number;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  priority?: 'low' | 'medium' | 'high';
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  secure?: boolean;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
  } | null;
  error?: string;
  cookiesToSet?: Array<{ name: string; value: string; options?: CookieOptions }>;
}

/**
 * Authenticate App Router request using Supabase with proper cookie handling
 */
export async function authenticateAppRouterRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookieArray) {
            cookieArray.forEach((cookie) => {
              cookiesToSet.push(cookie);
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
        url: request.url
      });
      return { user: null, error: error?.message || 'Unauthenticated', cookiesToSet };
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
      cookiesToSet
    };
  } catch (error) {
    console.error('[AUTH] Authentication exception:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}