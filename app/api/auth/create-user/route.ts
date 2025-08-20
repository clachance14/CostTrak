import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userRegistrationSchema } from '@/lib/validations/auth'
import { generateSecurePassword } from '@/lib/utils/password-generator'
import { z } from 'zod'

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
        { error: 'Only project managers can create users' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validatedData = userRegistrationSchema.parse(body)

    // Use admin client for user creation
    const adminClient = createAdminClient()

    let authData
    let authError
    let temporaryPassword: string | undefined
    let inviteLink: string | undefined

    if (validatedData.creation_method === 'invite') {
      // Send email invite
      const inviteResult = await adminClient.auth.admin.inviteUserByEmail(
        validatedData.email,
        {
          data: {
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            role: validatedData.role,
          },
          redirectTo: validatedData.redirect_to || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/setup-profile`,
        }
      )
      
      authData = inviteResult.data
      authError = inviteResult.error

      if (authData?.user) {
        // Generate invite link for reference
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'invite',
          email: validatedData.email,
        })
        inviteLink = linkData?.properties?.action_link
      }
    } else {
      // Create user with password
      let password = validatedData.password
      
      // Generate temporary password if not provided
      if (!password) {
        temporaryPassword = generateSecurePassword()
        password = temporaryPassword
      }

      const createResult = await adminClient.auth.admin.createUser({
        email: validatedData.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          first_name: validatedData.first_name,
          last_name: validatedData.last_name,
        },
      })

      authData = createResult.data
      authError = createResult.error
    }

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile using admin client to bypass RLS
    const forcePasswordChange = validatedData.creation_method === 'password' && !!temporaryPassword
    
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: validatedData.email,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        role: validatedData.role,
        division_id: validatedData.division_id,
        created_by: user.id,
        force_password_change: forcePasswordChange,
      })
      .select()
      .single()

    if (profileError) {
      // If profile creation fails, try to delete the auth user
      await adminClient.auth.admin.deleteUser(authData.user.id)
      
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 400 }
      )
    }

    // Track invite if sent
    if (validatedData.creation_method === 'invite') {
      await adminClient
        .from('user_invites')
        .insert({
          user_id: authData.user.id,
          email: validatedData.email,
          invited_by: user.id,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
    }

    // Prepare response based on creation method
    const response: any = {
      user: profile,
      creation_method: validatedData.creation_method,
    }

    if (validatedData.creation_method === 'invite') {
      response.message = 'User invited successfully. An email has been sent with instructions.'
      response.invite_sent = true
    } else {
      response.message = 'User created successfully.'
      if (temporaryPassword) {
        response.temporary_password = temporaryPassword
        response.password_change_required = true
        response.security_note = 'Please share this password securely with the user. They will be required to change it on first login.'
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}