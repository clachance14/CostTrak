import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.generated'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/unauthorized', '/password-reset', '/password-reset/confirm']

export async function middleware(request: NextRequest) {
  // Create a response object that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client with proper cookie handling for edge runtime
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options?: any) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options?: any) {
          request.cookies.delete({ name, ...options })
          response.cookies.delete({ name, ...options })
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname === route) || pathname.startsWith('/api/auth/')) {
    return response
  }

  try {
    // Check authentication - explicitly handle the auth client to avoid type issues
    // Use the auth property without type inference issues
    const authClient = supabase.auth as any // Temporary workaround for type issue
    const { data: { user }, error: userError } = await authClient.getUser()
    
    if (userError || !user) {
      // Redirect to login if not authenticated
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // For protected routes, verify user has a profile
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/projects') || pathname.startsWith('/api')) {
      // Simple profile check without complex role logic for now
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // User exists in auth but not in profiles - redirect to setup
        const url = request.nextUrl.clone()
        url.pathname = '/setup-profile'
        return NextResponse.redirect(url)
      }
    }

    return response
  } catch (error) {
    console.error('Middleware auth error:', error)
    // On error, allow the request to proceed
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}