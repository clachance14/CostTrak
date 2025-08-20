import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.error('Session exchange error:', sessionError)
      return NextResponse.redirect(
        new URL('/login?error=session_exchange_failed', requestUrl.origin)
      )
    }

    // Check if this is a password recovery flow
    // When user clicks password reset link, Supabase sets up a session
    // and we need to redirect them to the password reset page
    if (data?.user) {
      // Get the user's metadata to check the flow type
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check if this is a recovery flow by looking at session metadata
      // or by checking if user came from password reset email
      const isRecoveryFlow = requestUrl.searchParams.get('type') === 'recovery' ||
                            next.includes('reset-password') ||
                            data.user.app_metadata?.provider === 'email' &&
                            data.user.email_confirmed_at

      if (isRecoveryFlow || data.user.recovery_sent_at) {
        // This is a password recovery - redirect to reset password page
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
      }

      // For signup or regular login, redirect to dashboard
      if (data.user.created_at === data.user.last_sign_in_at) {
        // New user - might want to redirect to profile setup
        return NextResponse.redirect(new URL('/setup-profile', requestUrl.origin))
      }

      // Existing user - redirect to dashboard or next URL
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // No code provided or something went wrong
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}