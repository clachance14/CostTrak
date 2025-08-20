import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    
    // Verify the OTP token
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      // Successfully verified the token
      
      // Handle different confirmation types
      switch (type) {
        case 'recovery':
        case 'email':
          // For password recovery, redirect to reset password page
          // The session is now established, so the reset-password page will work
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
        
        case 'signup':
        case 'invite':
          // For signup confirmation, redirect to dashboard or profile setup
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
        
        default:
          // For other types, redirect to the next URL or dashboard
          return NextResponse.redirect(new URL(next, requestUrl.origin))
      }
    } else {
      // Token verification failed
      console.error('Token verification failed:', error)
      
      // Redirect to appropriate error page based on type
      if (type === 'recovery') {
        // For failed password reset, redirect to password reset page with error
        return NextResponse.redirect(
          new URL('/password-reset?error=invalid_token', requestUrl.origin)
        )
      }
      
      // For other failures, redirect to login with error
      return NextResponse.redirect(
        new URL('/login?error=invalid_token', requestUrl.origin)
      )
    }
  }

  // No token_hash or type provided, redirect to home
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}