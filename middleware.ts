import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/unauthorized', '/password-reset', '/password-reset/confirm']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  try {
    // Update/refresh the user's session
    const { response, user, supabase } = await updateSession(request)

    // Redirect to login if not authenticated
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // For authenticated users, check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

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
    console.error('Middleware auth error:', error)
    // Fallback to redirect on error
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}