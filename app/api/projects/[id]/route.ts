import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects/[id] - Get single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name, contact_name, contact_email, contact_phone),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        created_by_user:profiles!projects_created_by_fkey(id, first_name, last_name),
        purchase_orders(
          id,
          po_number,
          vendor_name,
          description,
          amount,
          status,
          created_at
        ),
        change_orders(
          id,
          co_number,
          description,
          amount,
          status,
          created_at
        ),
        labor_forecasts(
          id,
          week_ending,
          forecasted_cost,
          actual_cost,
          created_at
        ),
        financial_snapshots(
          id,
          snapshot_date,
          committed_cost,
          forecasted_cost,
          actual_cost,
          created_at
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fetch project divisions data
    const { data: projectDivisions } = await supabase
      .from('project_divisions')
      .select(`
        *,
        division:divisions!project_divisions_division_id_fkey(id, name, code),
        division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email)
      `)
      .eq('project_id', id)
      .order('is_lead_division', { ascending: false })

    // Add divisions to project object
    if (projectDivisions && projectDivisions.length > 0) {
      project.divisions = projectDivisions.map(pd => ({
        division_id: pd.division_id,
        division_name: pd.division?.name,
        division_code: pd.division?.code,
        is_lead_division: pd.is_lead_division,
        division_pm_id: pd.division_pm_id,
        division_pm_name: pd.division_pm ? `${pd.division_pm.first_name} ${pd.division_pm.last_name}` : null,
        budget_allocated: pd.budget_allocated
      }))
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    // Only certain roles can update projects
    const allowedRoles = ['controller', 'executive', 'ops_manager', 'project_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update projects' },
        { status: 403 }
      )
    }

    // Project managers can only update their own projects
    if (userProfile.role === 'project_manager') {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('project_manager_id')
        .eq('id', id)
        .single()

      if (existingProject?.project_manager_id !== user.id) {
        return NextResponse.json(
          { error: 'You can only update projects you manage' },
          { status: 403 }
        )
      }
    }

    // Validate request body
    const updateSchema = z.object({
      name: z.string().min(1).max(200).optional(),
      project_manager_id: z.string().uuid().optional(),
      original_contract: z.number().min(0).optional(),
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
      status: z.enum(['active', 'on_hold', 'completed', 'cancelled']).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip_code: z.string().max(10).optional(),
      description: z.string().optional()
    })

    const body = await request.json()
    const validatedData = updateSchema.parse(body)

    // Update project
    const { data: project, error } = await supabase
      .from('projects')
      .update(validatedData)
      .eq('id', id)
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id] - Soft delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    // Only controllers can delete projects
    if (userProfile?.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can delete projects' },
        { status: 403 }
      )
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('projects')
      .update({ 
        deleted_at: new Date().toISOString(),
        status: 'cancelled'
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}