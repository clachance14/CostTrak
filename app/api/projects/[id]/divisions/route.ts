import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects/[id]/divisions - Get divisions for a project
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

    // Get project divisions with related data
    const { data: divisions, error } = await supabase
      .from('project_divisions')
      .select(`
        *,
        division:divisions!project_divisions_division_id_fkey(id, name, code),
        division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email),
        division_budget:division_budgets!inner(
          labor_budget,
          materials_budget,
          equipment_budget,
          subcontracts_budget,
          other_budget,
          total_budget
        )
      `)
      .eq('project_id', id)
      .order('is_lead_division', { ascending: false })
      .order('created_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get division cost summaries
    const { data: costSummaries } = await supabase
      .from('division_cost_summary')
      .select('*')
      .eq('project_id', id)

    // Merge cost summaries with divisions
    const divisionsWithCosts = divisions.map(div => {
      const costSummary = costSummaries?.find(cs => cs.division_id === div.division_id)
      return {
        ...div,
        cost_summary: costSummary || null
      }
    })

    return NextResponse.json({ divisions: divisionsWithCosts })
  } catch (error) {
    console.error('Get project divisions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/divisions - Add division to project
export async function POST(
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

    // Only certain roles can add divisions
    const allowedRoles = ['controller', 'executive', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to add divisions' },
        { status: 403 }
      )
    }

    // Validate request body
    const createSchema = z.object({
      division_id: z.string().uuid(),
      division_pm_id: z.string().uuid().optional(),
      is_lead_division: z.boolean().optional(),
      budget_allocated: z.number().min(0).optional()
    })

    const body = await request.json()
    const validatedData = createSchema.parse(body)

    // If setting as lead division, unset current lead
    if (validatedData.is_lead_division) {
      await supabase
        .from('project_divisions')
        .update({ is_lead_division: false })
        .eq('project_id', id)
    }

    // Create project division
    const { data: projectDivision, error } = await supabase
      .from('project_divisions')
      .insert({
        project_id: id,
        ...validatedData,
        created_by: user.id
      })
      .select(`
        *,
        division:divisions!project_divisions_division_id_fkey(id, name, code),
        division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This division is already assigned to the project' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create initial division budget
    await supabase
      .from('division_budgets')
      .insert({
        project_id: id,
        division_id: validatedData.division_id,
        created_by: user.id
      })

    return NextResponse.json({ projectDivision }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Add project division error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/projects/[id]/divisions - Update division assignment
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

    // Validate request body
    const updateSchema = z.object({
      division_id: z.string().uuid(),
      division_pm_id: z.string().uuid().optional().nullable(),
      is_lead_division: z.boolean().optional(),
      budget_allocated: z.number().min(0).optional()
    })

    const body = await request.json()
    const { division_id, ...updateData } = updateSchema.parse(body)

    // Check if user has permission to update this division
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    const canUpdate = 
      userProfile?.role === 'controller' ||
      userProfile?.role === 'executive' ||
      (userProfile?.role === 'ops_manager' && userProfile?.division_id === division_id)

    if (!canUpdate) {
      // Check if user is the division PM
      const { data: projectDivision } = await supabase
        .from('project_divisions')
        .select('division_pm_id')
        .eq('project_id', id)
        .eq('division_id', division_id)
        .single()

      if (projectDivision?.division_pm_id !== user.id) {
        return NextResponse.json(
          { error: 'Insufficient permissions to update this division' },
          { status: 403 }
        )
      }
    }

    // If setting as lead division, unset current lead
    if (updateData.is_lead_division) {
      await supabase
        .from('project_divisions')
        .update({ is_lead_division: false })
        .eq('project_id', id)
        .neq('division_id', division_id)
    }

    // Update project division
    const { data: updatedDivision, error } = await supabase
      .from('project_divisions')
      .update(updateData)
      .eq('project_id', id)
      .eq('division_id', division_id)
      .select(`
        *,
        division:divisions!project_divisions_division_id_fkey(id, name, code),
        division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ projectDivision: updatedDivision })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update project division error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/divisions - Remove division from project
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

    // Get division_id from query params
    const { searchParams } = new URL(request.url)
    const division_id = searchParams.get('division_id')

    if (!division_id) {
      return NextResponse.json(
        { error: 'division_id is required' },
        { status: 400 }
      )
    }

    // Check user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only controllers can remove divisions
    if (userProfile?.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can remove divisions from projects' },
        { status: 403 }
      )
    }

    // Check if this is the lead division
    const { data: projectDivision } = await supabase
      .from('project_divisions')
      .select('is_lead_division')
      .eq('project_id', id)
      .eq('division_id', division_id)
      .single()

    if (projectDivision?.is_lead_division) {
      return NextResponse.json(
        { error: 'Cannot remove the lead division. Please assign another division as lead first.' },
        { status: 400 }
      )
    }

    // Check if there are any costs associated with this division
    const { data: costSummary } = await supabase
      .from('division_cost_summary')
      .select('total_committed')
      .eq('project_id', id)
      .eq('division_id', division_id)
      .single()

    if (costSummary?.total_committed > 0) {
      return NextResponse.json(
        { error: 'Cannot remove division with committed costs. Please reassign costs first.' },
        { status: 400 }
      )
    }

    // Delete division budget and assignment
    const { error: budgetError } = await supabase
      .from('division_budgets')
      .delete()
      .eq('project_id', id)
      .eq('division_id', division_id)

    if (budgetError) {
      return NextResponse.json({ error: budgetError.message }, { status: 400 })
    }

    const { error } = await supabase
      .from('project_divisions')
      .delete()
      .eq('project_id', id)
      .eq('division_id', division_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Division removed successfully' })
  } catch (error) {
    console.error('Remove project division error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}