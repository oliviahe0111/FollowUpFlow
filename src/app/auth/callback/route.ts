import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getURL } from '../../../../lib/getURL'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // Fix URL construction to handle root path correctly
    const redirectPath = next === '/' ? '' : (next.startsWith('/') ? next.slice(1) : next)
    const response = NextResponse.redirect(getURL() + redirectPath)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('[AUTH] Callback success, redirecting to:', getURL() + redirectPath)
      return response
    } else {
      console.error('[AUTH] Callback error:', error)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(getURL() + 'auth/auth-code-error')
}