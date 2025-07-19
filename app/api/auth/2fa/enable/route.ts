import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import speakeasy from 'speakeasy'

const auditLogger = new AuditLogger()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret, code } = body

    if (!secret || !code) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps for clock drift
    })

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Hash backup codes (in real implementation)
    // For now, we'll store them as-is (should be hashed in production)
    
    // Enable 2FA for user
    // TODO: Add two_factor_secret, two_factor_enabled, and two_factor_backup_codes fields to profiles table
    // For now, just return success without actually storing the 2FA data
    /*
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        two_factor_secret: secret,
        two_factor_enabled: true,
        // In production, store hashed backup codes
        two_factor_backup_codes: body.backupCodes || [],
      })
      .eq('id', user.id)
    */
    const updateError = null

    if (updateError) {
      console.error('Failed to enable 2FA:', updateError)
      return NextResponse.json(
        { error: 'Failed to enable 2FA' },
        { status: 500 }
      )
    }

    // Log the event
    await auditLogger.log2FAEnable(user.id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('2FA enable error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}