// import { createServerClient } from '@supabase/ssr'
// import { NextResponse, type NextRequest } from 'next/server'

// export async function middleware(request: NextRequest) {
//   const response = NextResponse.next({
//     request: {
//       headers: request.headers,
//     },
//   })

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           return request.cookies.getAll()
//         },
//         setAll(cookiesToSet) {
//           cookiesToSet.forEach(({ name, value, options }) => {
//             request.cookies.set(name, value)
//             response.cookies.set(name, value, options)
//           })
//         },
//       },
//     }
//   )

//   const {
//     data: { session },
//   } = await supabase.auth.getSession()

//   // Check if user is trying to access protected routes
//   const isProtectedRoute = request.nextUrl.pathname === '/' || 
//                           request.nextUrl.pathname.startsWith('/board')

//   // Redirect unauthenticated users to login
//   if (!session && isProtectedRoute) {
//     const redirectUrl = new URL('/login', request.url)
//     return NextResponse.redirect(redirectUrl)
//   }

//   // Redirect authenticated users away from login page
//   if (session && request.nextUrl.pathname === '/login') {
//     const redirectUrl = new URL('/', request.url)
//     return NextResponse.redirect(redirectUrl)
//   }

//   return response
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - auth/callback (OAuth callback)
//      * - auth/signout (signout route)
//      * - auth/auth-code-error (error page)
//      */
//     '/((?!api|_next/static|_next/image|favicon.ico|auth/callback|auth/signout|auth/auth-code-error).*)',
//   ],
// }

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Only run auth checks on protected routes - not on every request
  const pathname = request.nextUrl.pathname
  
  // Define which routes need protection
  const isProtectedRoute = pathname === '/' || 
                          pathname.startsWith('/board') ||
                          pathname.startsWith('/api/') // Protect API routes too

  // Skip auth check for public routes
  if (!isProtectedRoute) {
    return response
  }

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

  try {
    // Use getUser() instead of getSession() - it's faster and doesn't refresh tokens
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    // If there's an auth error or no user, redirect to login
    if (error || !user) {
      // Don't redirect API calls - return 401 instead
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
      
      // Redirect pages to login
      const redirectUrl = new URL('/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // User is authenticated - allow the request
    return response

  } catch (error) {
    console.error('Middleware auth error:', error)
    
    // On error, redirect to login (for pages) or return 401 (for API)
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    /*
     * Match protected routes only:
     * - Root path /
     * - Board pages /board/...
     * - API routes /api/... (but exclude auth endpoints)
     * Exclude:
     * - Static files (_next/static, _next/image, favicon.ico)
     * - Auth callback routes
     * - Login page
     */
    '/((?!_next/static|_next/image|favicon.ico|login|auth/callback|auth/signout|auth/auth-code-error).*)',
  ],
}