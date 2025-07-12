import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import speakeasy from 'speakeasy'

const auditLogger = new AuditLogger()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, sessionId } = body

    if (!code || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // TODO: In production, validate the sessionId from temporary session storage
    // For now, we'll get the user from the current session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Get user's 2FA secret
    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single()

    if (!profile?.two_factor_enabled || !profile.two_factor_secret) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      )
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: profile.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps for clock drift
    })

    if (!verified) {
      // Check if it's a backup code
      // TODO: Implement backup code verification
      
      await auditLogger.log2FAVerify(user.id, false)
      
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Log successful 2FA verification
    await auditLogger.log2FAVerify(user.id, true)

    // In production, you would create a full session here
    // For now, return success
    return NextResponse.json({
      success: true,
      user,
    })

  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}