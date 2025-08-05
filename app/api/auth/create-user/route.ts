import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userRegistrationSchema } from '@/lib/validations/auth'
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

    if (currentUserProfile?.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can create users' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validatedData = userRegistrationSchema.parse(body)

    // Use admin client for user creation
    const adminClient = createAdminClient()

    // Create auth user with Supabase Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: true,
      user_metadata: {
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile using admin client to bypass RLS
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: validatedData.email,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        role: validatedData.role,
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

    return NextResponse.json({
      user: profile,
      message: 'User created successfully',
    })
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