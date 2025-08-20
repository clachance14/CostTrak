import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// GET /api/users - List users with optional role filter
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MVP: All authenticated users can list project managers
    // Future: Add role-based permissions

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')

    // Build query - include additional status fields
    let query = supabase
      .from('profiles')
      .select(`
        id, 
        email, 
        first_name, 
        last_name, 
        role,
        created_at,
        last_login_at,
        is_active,
        force_password_change,
        division_id
      `)
      .order('first_name')

    // Apply role filter if provided
    if (role) {
      query = query.eq('role', role)
    }

    const { data: users, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fetch invite status for users
    const adminClient = createAdminClient()
    const userIds = users?.map(u => u.id) || []
    
    let inviteStatuses = new Map()
    if (userIds.length > 0) {
      const { data: invites } = await adminClient
        .from('user_invites')
        .select('user_id, status, invited_at, accepted_at')
        .in('user_id', userIds)

      invites?.forEach(invite => {
        inviteStatuses.set(invite.user_id, {
          invite_status: invite.status,
          invited_at: invite.invited_at,
          accepted_at: invite.accepted_at,
        })
      })
    }

    // Combine user data with invite status
    const usersWithStatus = users?.map(user => ({
      ...user,
      ...(inviteStatuses.get(user.id) || { invite_status: user.last_login_at ? 'active' : 'unknown' }),
    }))

    return NextResponse.json({ users: usersWithStatus || [] })
  } catch (error) {
    console.error('Users API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create new user (for autocomplete)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's role
    const { data: currentUser } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Project managers can create users (simplified permission model)
    if (currentUser?.role !== 'project_manager') {
      return NextResponse.json({ error: 'Only project managers can create users' }, { status: 403 })
    }

    // Validate request body
    const userSchema = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      role: z.enum(['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer']).default('project_manager')
    })

    const body = await request.json()
    const validatedData = userSchema.parse(body)
    
    // Split name into first and last name
    const nameParts = validatedData.name.trim().split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || firstName

    // Generate email if not provided
    const email = validatedData.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@temp.ics.ac`

    // Create user profile
    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email,
        role: validatedData.role
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: newUser }, { status: 201 })
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