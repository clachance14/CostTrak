import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSecurePassword } from '@/lib/utils/password-generator'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    // Check current user permissions
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only project managers can reset passwords (per simplified permissions)
    if (currentUserProfile?.role !== 'project_manager') {
      return NextResponse.json(
        { error: 'Only project managers can reset user passwords' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validatedData = resetPasswordSchema.parse(body)

    // Use admin client for password reset
    const adminClient = createAdminClient()

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword()

    // Update user's password using admin API
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(
      validatedData.user_id,
      {
        password: temporaryPassword,
      }
    )

    if (updateError) {
      console.error('Password reset error:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 400 }
      )
    }

    // Update profile to force password change on next login
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ 
        force_password_change: true,
        password_changed_at: new Date().toISOString()
      })
      .eq('id', validatedData.user_id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      // Don't fail the request, password was still reset
    }

    // Log the password reset for audit
    await adminClient
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'password_reset_admin',
        entity_type: 'user',
        entity_id: validatedData.user_id,
        details: {
          reset_by: user.id,
          reset_for_email: validatedData.email,
          force_change_required: true
        }
      })
      .select() // Just to execute, we don't need the result

    return NextResponse.json({
      success: true,
      temporary_password: temporaryPassword,
      message: 'Password reset successfully',
      security_note: 'Please share this password securely with the user. They will be required to change it on first login.'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Admin password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}