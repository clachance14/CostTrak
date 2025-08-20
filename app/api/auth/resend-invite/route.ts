import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const resendInviteSchema = z.object({
  user_id: z.string().uuid(),
  redirect_to: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Use regular client to check current user permissions
    const supabase = await createClient()
    
    // Check if current user is a controller
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

    if (currentUserProfile?.role !== 'project_manager') {
      return NextResponse.json(
        { error: 'Only project managers can resend invites' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validatedData = resendInviteSchema.parse(body)

    // Use admin client
    const adminClient = createAdminClient()

    // Check if user exists and get their email
    const { data: targetUser, error: userError } = await adminClient
      .from('profiles')
      .select('email, first_name, last_name, role')
      .eq('id', validatedData.user_id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if there's an existing invite
    const { data: existingInvite } = await adminClient
      .from('user_invites')
      .select('status, accepted_at')
      .eq('user_id', validatedData.user_id)
      .single()

    if (existingInvite?.status === 'accepted') {
      return NextResponse.json(
        { error: 'User has already accepted the invitation' },
        { status: 400 }
      )
    }

    // Resend the invite
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      targetUser.email,
      {
        data: {
          first_name: targetUser.first_name,
          last_name: targetUser.last_name,
          role: targetUser.role,
        },
        redirectTo: validatedData.redirect_to || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/setup-profile`,
      }
    )

    if (inviteError) {
      // Check if error is because user already exists
      if (inviteError.message.includes('already been registered')) {
        // Generate a password reset link instead
        const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: targetUser.email,
        })

        if (resetError) {
          return NextResponse.json(
            { error: 'Failed to generate password reset link' },
            { status: 400 }
          )
        }

        // Update invite record
        await adminClient
          .from('user_invites')
          .upsert({
            user_id: validatedData.user_id,
            email: targetUser.email,
            invited_by: user.id,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })

        return NextResponse.json({
          message: 'Password reset link sent successfully',
          reset_link_sent: true,
          email: targetUser.email,
        })
      }

      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    // Update or create invite record
    await adminClient
      .from('user_invites')
      .upsert({
        user_id: validatedData.user_id,
        email: targetUser.email,
        invited_by: user.id,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

    return NextResponse.json({
      message: 'Invitation resent successfully',
      invite_sent: true,
      email: targetUser.email,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Resend invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}