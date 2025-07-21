import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects/[id]/divisions/[divisionId]/budget - Get division budget
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get division budget with breakdown
    const { data: budget, error } = await supabase
      .from('division_budgets')
      .select(`
        *,
        division:divisions!division_budgets_division_id_fkey(id, name, code),
        created_by_user:profiles!division_budgets_created_by_fkey(id, first_name, last_name)
      `)
      .eq('project_id', id)
      .eq('division_id', divisionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Division budget not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get budget breakdowns for this division
    const { data: breakdowns } = await supabase
      .from('project_budget_breakdowns')
      .select('*')
      .eq('project_id', id)
      .in('discipline', (
        await supabase
          .from('division_discipline_mapping')
          .select('discipline_name')
          .eq('division_id', divisionId)
      ).data?.map(d => d.discipline_name) || [])

    return NextResponse.json({ 
      budget,
      breakdowns: breakdowns || []
    })
  } catch (error) {
    console.error('Get division budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id]/divisions/[divisionId]/budget - Update division budget
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update this division's budget
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    const canUpdate = 
      userProfile?.role === 'controller' ||
      userProfile?.role === 'executive' ||
      (userProfile?.role === 'ops_manager' && userProfile?.division_id === divisionId)

    if (!canUpdate) {
      // Check if user is the division PM
      const { data: projectDivision } = await supabase
        .from('project_divisions')
        .select('division_pm_id')
        .eq('project_id', id)
        .eq('division_id', divisionId)
        .single()

      if (projectDivision?.division_pm_id !== user.id) {
        return NextResponse.json(
          { error: 'Insufficient permissions to update this division budget' },
          { status: 403 }
        )
      }
    }

    // Validate request body
    const budgetSchema = z.object({
      labor_budget: z.number().min(0),
      materials_budget: z.number().min(0),
      equipment_budget: z.number().min(0),
      subcontracts_budget: z.number().min(0),
      other_budget: z.number().min(0),
      other_budget_description: z.string().optional().nullable()
    })

    const body = await request.json()
    const validatedData = budgetSchema.parse(body)

    // Update or create division budget
    const { data: budget, error } = await supabase
      .from('division_budgets')
      .upsert({
        project_id: id,
        division_id: divisionId,
        ...validatedData,
        created_by: user.id
      }, {
        onConflict: 'project_id,division_id'
      })
      .select(`
        *,
        division:divisions!division_budgets_division_id_fkey(id, name, code)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update project_divisions budget_allocated
    await supabase
      .from('project_divisions')
      .update({ 
        budget_allocated: budget.total_budget,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', id)
      .eq('division_id', divisionId)

    // Log audit trail
    await supabase
      .from('audit_log')
      .insert({
        entity_type: 'division_budget',
        entity_id: budget.id,
        action: 'update',
        changes: {
          previous: body.previous || {},
          new: validatedData
        },
        performed_by: user.id
      })

    return NextResponse.json({ budget })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update division budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/divisions/[divisionId]/budget/import - Import budget from breakdown
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions (same as PUT)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    const canImport = 
      userProfile?.role === 'controller' ||
      userProfile?.role === 'executive'

    if (!canImport) {
      return NextResponse.json(
        { error: 'Only controllers and executives can import budgets' },
        { status: 403 }
      )
    }

    // Get disciplines mapped to this division
    const { data: mappings } = await supabase
      .from('division_discipline_mapping')
      .select('discipline_name')
      .eq('division_id', divisionId)

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: 'No disciplines mapped to this division' },
        { status: 400 }
      )
    }

    const disciplines = mappings.map(m => m.discipline_name)

    // Calculate budget from breakdowns
    const { data: breakdowns } = await supabase
      .from('project_budget_breakdowns')
      .select('cost_type, value')
      .eq('project_id', id)
      .in('discipline', disciplines)

    if (!breakdowns || breakdowns.length === 0) {
      return NextResponse.json(
        { error: 'No budget breakdowns found for this division' },
        { status: 400 }
      )
    }

    // Aggregate by cost type
    const budgetTotals = breakdowns.reduce((acc, breakdown) => {
      const costType = breakdown.cost_type.toLowerCase()
      if (costType === 'labor') acc.labor_budget += breakdown.value
      else if (costType === 'materials') acc.materials_budget += breakdown.value
      else if (costType === 'equipment') acc.equipment_budget += breakdown.value
      else if (costType === 'subcontracts') acc.subcontracts_budget += breakdown.value
      else acc.other_budget += breakdown.value
      return acc
    }, {
      labor_budget: 0,
      materials_budget: 0,
      equipment_budget: 0,
      subcontracts_budget: 0,
      other_budget: 0
    })

    // Update division budget
    const { data: budget, error } = await supabase
      .from('division_budgets')
      .upsert({
        project_id: id,
        division_id: divisionId,
        ...budgetTotals,
        created_by: user.id
      }, {
        onConflict: 'project_id,division_id'
      })
      .select(`
        *,
        division:divisions!division_budgets_division_id_fkey(id, name, code)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update project_divisions budget_allocated
    await supabase
      .from('project_divisions')
      .update({ 
        budget_allocated: budget.total_budget,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', id)
      .eq('division_id', divisionId)

    return NextResponse.json({ 
      budget,
      message: `Budget imported from ${breakdowns.length} breakdown entries`
    })
  } catch (error) {
    console.error('Import division budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}