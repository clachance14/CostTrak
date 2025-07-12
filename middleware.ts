import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/unauthorized', '/password-reset', '/password-reset/confirm']

// Role-based route access
const roleRoutes: Record<string, string[]> = {
  executive: ['/dashboard/executive', '/dashboard', '/projects', '/reports'],
  controller: ['/dashboard/controller', '/controller', '/dashboard', '/projects', '/reports', '/settings'],
  ops_manager: ['/dashboard/ops-manager', '/dashboard', '/projects', '/purchase-orders', '/labor', '/reports'],
  project_manager: ['/dashboard/project-manager', '/dashboard', '/projects', '/purchase-orders', '/labor'],
  accounting: ['/dashboard/accounting', '/dashboard', '/purchase-orders', '/reports', '/exports'],
  viewer: ['/dashboard/viewer', '/dashboard', '/projects'],
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
    return supabaseResponse
  }

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  if (!user) {
    // Redirect to login if not authenticated
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Check session timeout (30 minutes of inactivity)
  if (session) {
    const sessionTimeout = 30 * 60 * 1000 // 30 minutes in milliseconds
    const lastActivity = request.cookies.get('last_activity')?.value
    const now = Date.now()

    if (lastActivity) {
      const timeSinceLastActivity = now - parseInt(lastActivity)
      
      if (timeSinceLastActivity > sessionTimeout) {
        // Session timed out - sign out and redirect to login
        await supabase.auth.signOut()
        
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('message', 'Your session has expired. Please sign in again.')
        return NextResponse.redirect(url)
      }
    }

    // Update last activity time
    supabaseResponse.cookies.set('last_activity', now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTimeout / 1000, // Convert to seconds
    })
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // User exists in auth but not in profiles - redirect to setup
    if (pathname !== '/setup-profile') {
      const url = request.nextUrl.clone()
      url.pathname = '/setup-profile'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Check role-based access
  const userRole = profile.role
  
  // Controllers have access to all routes for testing
  if (userRole === 'controller') {
    return supabaseResponse
  }
  
  const allowedRoutes = roleRoutes[userRole] || []

  // Check if user has access to the current route
  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route))

  if (!hasAccess && !pathname.startsWith('/api')) {
    // Redirect to appropriate dashboard if accessing unauthorized route
    const url = request.nextUrl.clone()
    const defaultRoute = `/dashboard/${userRole.replace('_', '-')}`
    url.pathname = allowedRoutes.includes(defaultRoute) ? defaultRoute : '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (auth endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}