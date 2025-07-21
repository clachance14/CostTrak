import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database.generated'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/unauthorized', '/password-reset', '/password-reset/confirm']

export async function middleware(request: NextRequest) {
  // Create a response that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const pathname = request.nextUrl.pathname

  // Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
    return response
  }

  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Middleware: Missing Supabase environment variables')
      console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing')
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing')
      
      // Don't throw - return early to prevent runtime crash
      // Allow the request to continue for public routes
      console.error('Middleware: Continuing without auth due to missing env vars')
      return response
    }

    // Create a Supabase client configured for middleware with proper types
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: CookieOptions }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Refresh session if expired - required for Server Components
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Middleware: Auth error', userError)
    }

    // Redirect to login if not authenticated
    if (!user) {
      // Prevent redirect loop - if already going to login, allow it
      if (pathname === '/login') {
        return response
      }
      
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // For authenticated users, check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Middleware: Profile error', profileError)
    }

    if (!profile) {
      // User exists in auth but not in profiles - redirect to setup
      if (pathname !== '/setup-profile') {
        const url = request.nextUrl.clone()
        url.pathname = '/setup-profile'
        return NextResponse.redirect(url)
      }
      // If on setup-profile without profile, allow it to proceed
      return response
    }

    // Role-based access control
    const rolePaths: Record<string, string[]> = {
      '/accounting': ['accounting', 'controller', 'executive'],
      '/controller': ['controller', 'executive'],
      '/executive': ['executive', 'controller'],
      '/ops-manager': ['ops_manager', 'controller', 'executive'],
      '/project-manager': ['project_manager', 'controller', 'executive', 'ops_manager'],
      '/viewer': ['viewer', 'controller', 'executive', 'ops_manager', 'project_manager'],
    }

    let requiredRoles: string[] | undefined
    for (const path in rolePaths) {
      if (pathname.startsWith(path)) {
        requiredRoles = rolePaths[path]
        break
      }
    }

    if (requiredRoles && !requiredRoles.includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    return response
  } catch (error) {
    console.error('Middleware: Unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      pathname,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
    })
    
    // For public routes, allow access even on error
    if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
      return response
    }
    
    // Only redirect to login for protected routes
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}