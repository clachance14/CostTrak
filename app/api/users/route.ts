import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // Build query
    let query = supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .order('first_name')

    // Apply role filter if provided
    if (role) {
      query = query.eq('role', role)
    }

    const { data: users, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ users: users || [] })
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

    // Only controllers and ops_manager can create users (ops_manager can create project_manager only)
    if (!['controller', 'ops_manager'].includes(currentUser?.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate request body
    const userSchema = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      role: z.enum(['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer']).default('project_manager')
    })

    const body = await request.json()
    const validatedData = userSchema.parse(body)
    
    // Ops managers can only create project managers
    if (currentUser?.role === 'ops_manager' && validatedData.role !== 'project_manager') {
      return NextResponse.json({ error: 'Ops managers can only create project manager users' }, { status: 403 })
    }
    
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