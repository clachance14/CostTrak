// Debug version of middleware with additional logging
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/unauthorized', '/password-reset', '/password-reset/confirm']

export async function middleware(request: NextRequest) {
  console.log('[Middleware] Processing request for:', request.nextUrl.pathname)
  
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if environment variables are present
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Middleware] Missing Supabase environment variables')
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          const value = request.cookies.get(name)?.value
          console.log(`[Middleware] Cookie get: ${name} = ${value ? 'exists' : 'not found'}`)
          return value
        },
        set(name: string, value: string, options: CookieOptions) {
          console.log(`[Middleware] Cookie set: ${name}`)
          // Update both request and response cookies
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          console.log(`[Middleware] Cookie remove: ${name}`)
          // Remove from both request and response cookies
          request.cookies.delete(name)
          response.cookies.delete(name)
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
    console.log('[Middleware] Public route, allowing access')
    return response
  }

  try {
    console.log('[Middleware] Checking authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('[Middleware] Auth error:', userError.message)
    }

    // Redirect to login if not authenticated
    if (!user) {
      console.log('[Middleware] No user found, redirecting to login')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    console.log('[Middleware] User authenticated, checking profile...')
    
    // For authenticated users, check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
      
    if (profileError) {
      console.error('[Middleware] Profile error:', profileError.message)
    }

    if (!profile) {
      console.log('[Middleware] No profile found, redirecting to setup')
      // User exists in auth but not in profiles - redirect to setup
      if (pathname !== '/setup-profile') {
        const url = request.nextUrl.clone()
        url.pathname = '/setup-profile'
        return NextResponse.redirect(url)
      }
      // If on setup-profile without profile, allow it to proceed
      return response
    }

    console.log('[Middleware] Profile found with role:', profile.role)

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
      console.log('[Middleware] Insufficient role, redirecting to unauthorized')
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    console.log('[Middleware] Access granted')
    return response
  } catch (error) {
    console.error('[Middleware] Unexpected error:', error)
    // Fallback to redirect on error
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}