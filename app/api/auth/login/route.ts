import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validations/auth'
import { RateLimiter } from '@/lib/security/rate-limiter'
import { AuditLogger } from '@/lib/security/audit-logger'
import { headers } from 'next/headers'

const rateLimiter = new RateLimiter()
const auditLogger = new AuditLogger()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Get client IP and user agent
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() || 
               headersList.get('x-real-ip') || 
               undefined
    const userAgent = headersList.get('user-agent') || undefined

    // Check rate limit
    const rateLimitResult = await rateLimiter.checkLoginAttempts(email, ip)
    
    if (!rateLimitResult.allowed) {
      await auditLogger.logAccountLocked(email, 'rate_limit_exceeded')
      
      return NextResponse.json(
        {
          error: 'Too many login attempts',
          lockedUntil: rateLimitResult.lockedUntil,
          requiresCaptcha: true,
        },
        { status: 429 }
      )
    }

    // Check if CAPTCHA is required but not provided
    if (rateLimitResult.requiresCaptcha && !body.captchaToken) {
      return NextResponse.json(
        {
          error: 'CAPTCHA verification required',
          requiresCaptcha: true,
          remainingAttempts: rateLimitResult.remainingAttempts,
        },
        { status: 400 }
      )
    }

    // TODO: Verify CAPTCHA token if provided
    // if (body.captchaToken) {
    //   const captchaValid = await verifyCaptcha(body.captchaToken)
    //   if (!captchaValid) {
    //     return NextResponse.json(
    //       { error: 'Invalid CAPTCHA' },
    //       { status: 400 }
    //     )
    //   }
    // }

    // Attempt login
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Record login attempt
    await rateLimiter.recordLoginAttempt(
      email,
      !error,
      error?.message,
      { ip, userAgent }
    )

    if (error) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          remainingAttempts: rateLimitResult.remainingAttempts - 1,
          requiresCaptcha: rateLimitResult.remainingAttempts <= 3,
        },
        { status: 401 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Login failed' },
        { status: 401 }
      )
    }

    // Check user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    // Log successful login
    await auditLogger.logLogin(data.user.id, {
      email,
      role: userProfile?.role,
    })

    // TODO: Add two_factor_enabled field to profiles table
    // For now, skip 2FA check
    /*
    if (userProfile?.two_factor_enabled) {
      return NextResponse.json({
        requiresTwoFactor: true,
        sessionId: data.session?.access_token, // Temporary session for 2FA
      })
    }
    */

    // Return success with user data
    return NextResponse.json({
      user: data.user,
      session: data.session,
      role: userProfile?.role,
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}