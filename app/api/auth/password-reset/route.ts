import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { passwordResetSchema } from '@/lib/validations/auth'
import { AuditLogger } from '@/lib/security/audit-logger'
import { nanoid } from 'nanoid'
import { hash } from '@node-rs/argon2'

const auditLogger = new AuditLogger()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validation = passwordResetSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const { email } = validation.data
    const supabase = await createClient()

    // Check if user exists
    const { data: user } = await supabase
      .from('profiles')
      .select('id, first_name')
      .eq('email', email.toLowerCase())
      .single()

    // Always return success to prevent email enumeration
    if (!user) {
      await auditLogger.logPasswordResetRequest(email)
      return NextResponse.json({ success: true })
    }

    // Generate secure reset token
    const resetToken = nanoid(32)
    const hashedToken = await hash(resetToken)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry

    // Store hashed token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: hashedToken,
        expires_at: expiresAt.toISOString(),
      })

    if (tokenError) {
      console.error('Failed to create reset token:', tokenError)
      return NextResponse.json(
        { error: 'Failed to create reset token' },
        { status: 500 }
      )
    }

    // Log the request
    await auditLogger.logPasswordResetRequest(email)

    // TODO: Send email with reset link
    // The link should be: https://app.costtrak.com/password-reset/confirm?token={resetToken}
    console.log('Password reset token for', email, ':', resetToken)
    console.log('Reset link:', `${process.env.NEXT_PUBLIC_APP_URL}/password-reset/confirm?token=${resetToken}`)

    // In production, you would send an email here:
    // await sendPasswordResetEmail({
    //   to: email,
    //   firstName: user.first_name,
    //   resetLink: `${process.env.NEXT_PUBLIC_APP_URL}/password-reset/confirm?token=${resetToken}`,
    // })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle password reset confirmation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const hashedToken = await hash(token)

    // Find valid token
    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at')
      .eq('token', hashedToken)
      .is('used_at', null)
      .single()

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    // Update password using Supabase auth
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', hashedToken)

    // Log password reset completion
    await auditLogger.logPasswordResetComplete(resetToken.user_id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Password reset confirmation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}