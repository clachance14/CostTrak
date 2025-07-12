import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects - List projects with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const divisionId = searchParams.get('division_id')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('projects')
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        purchase_orders(count),
        change_orders(count),
        labor_forecasts(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (divisionId) {
      query = query.eq('division_id', divisionId)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,job_number.ilike.%${search}%`)
    }

    const { data: projects, error, count } = await query

    if (error) {
      console.error('Projects fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate total pages
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      projects: projects || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only certain roles can create projects
    const allowedRoles = ['controller', 'executive', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create projects' },
        { status: 403 }
      )
    }

    // Validate request body
    const projectSchema = z.object({
      name: z.string().min(1).max(200),
      job_number: z.string().min(1).max(50),
      client_id: z.string().uuid(),
      division_id: z.string().uuid(),
      project_manager_id: z.string().uuid(),
      original_contract: z.number().min(0),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip_code: z.string().max(10).optional(),
      description: z.string().optional()
    })

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        ...validatedData,
        created_by: user.id
      })
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
      `)
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505' && error.message.includes('job_number')) {
        return NextResponse.json(
          { error: 'Job number already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}