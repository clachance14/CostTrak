import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for budget breakdown
const budgetBreakdownSchema = z.object({
  discipline: z.string().min(1).max(100),
  cost_type: z.string().min(1).max(100),
  manhours: z.number().nullable().optional(),
  value: z.number().min(0),
  description: z.string().nullable().optional()
})

// GET /api/project-budget-breakdowns/[projectId] - Get budget breakdowns for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { projectId } = await params
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check project access
    const { data: hasAccess } = await supabase
      .rpc('user_has_project_access', { p_project_id: projectId })
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get query parameters (reserved for future use)
    // const searchParams = request.nextUrl.searchParams
    // const groupBy = searchParams.get('groupBy') || 'discipline'

    // Fetch budget breakdowns
    const { data: breakdowns, error } = await supabase
      .from('project_budget_breakdowns')
      .select('*')
      .eq('project_id', projectId)
      .order('discipline')
      .order('cost_type')

    if (error) {
      console.error('Error fetching budget breakdowns:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch budget breakdowns',
        details: error.message 
      }, { status: 400 })
    }

    // Calculate summary statistics
    const summary = {
      byDiscipline: {} as Record<string, {
        total: number
        byType: Record<string, { manhours?: number; value: number }>
      }>,
      totals: {
        manhours: 0,
        value: 0,
        laborTotal: 0,
        materialsTotal: 0,
        equipmentTotal: 0,
        subcontractTotal: 0,
        otherTotal: 0
      }
    }

    // Process breakdowns
    breakdowns?.forEach(item => {
      // Initialize discipline if not exists
      if (!summary.byDiscipline[item.discipline]) {
        summary.byDiscipline[item.discipline] = {
          total: 0,
          byType: {}
        }
      }

      // Add to discipline totals
      summary.byDiscipline[item.discipline].total += item.value
      summary.byDiscipline[item.discipline].byType[item.cost_type] = {
        manhours: item.manhours,
        value: item.value
      }

      // Add to overall totals
      summary.totals.value += item.value
      summary.totals.manhours += item.manhours || 0

      // Categorize by cost type
      const costTypeUpper = item.cost_type.toUpperCase()
      if (costTypeUpper.includes('LABOR')) {
        summary.totals.laborTotal += item.value
      } else if (costTypeUpper === 'MATERIALS') {
        summary.totals.materialsTotal += item.value
      } else if (costTypeUpper === 'EQUIPMENT') {
        summary.totals.equipmentTotal += item.value
      } else if (costTypeUpper === 'SUBCONTRACT') {
        summary.totals.subcontractTotal += item.value
      } else {
        summary.totals.otherTotal += item.value
      }
    })

    return NextResponse.json({
      breakdowns: breakdowns || [],
      summary,
      count: breakdowns?.length || 0
    })
  } catch (error) {
    console.error('Get budget breakdowns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/project-budget-breakdowns/[projectId] - Create budget breakdown entries
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { projectId } = await params
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is controller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'controller') {
      return NextResponse.json({ error: 'Only controllers can manage budget breakdowns' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { breakdowns, clearExisting = false } = body

    if (!Array.isArray(breakdowns)) {
      return NextResponse.json({ error: 'Breakdowns must be an array' }, { status: 400 })
    }

    // Validate each breakdown
    const validatedBreakdowns = []
    for (let i = 0; i < breakdowns.length; i++) {
      try {
        const validated = budgetBreakdownSchema.parse(breakdowns[i])
        validatedBreakdowns.push({
          ...validated,
          project_id: projectId,
          created_by: user.id,
          import_source: 'api'
        })
      } catch (validationError) {
        return NextResponse.json({ 
          error: `Invalid breakdown at index ${i}`,
          details: validationError
        }, { status: 400 })
      }
    }

    // Clear existing breakdowns if requested
    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from('project_budget_breakdowns')
        .delete()
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('Error clearing existing breakdowns:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to clear existing breakdowns',
          details: deleteError.message 
        }, { status: 400 })
      }
    }

    // Insert new breakdowns
    const { data: inserted, error: insertError } = await supabase
      .from('project_budget_breakdowns')
      .insert(validatedBreakdowns)
      .select()

    if (insertError) {
      console.error('Error inserting breakdowns:', insertError)
      return NextResponse.json({ 
        error: 'Failed to insert breakdowns',
        details: insertError.message 
      }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Budget breakdowns created successfully',
      created: inserted?.length || 0,
      breakdowns: inserted
    })
  } catch (error) {
    console.error('Create budget breakdowns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/project-budget-breakdowns/[projectId] - Delete all budget breakdowns for a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { projectId } = await params
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is controller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'controller') {
      return NextResponse.json({ error: 'Only controllers can delete budget breakdowns' }, { status: 403 })
    }

    // Delete all breakdowns for the project
    const { error } = await supabase
      .from('project_budget_breakdowns')
      .delete()
      .eq('project_id', projectId)

    if (error) {
      console.error('Error deleting budget breakdowns:', error)
      return NextResponse.json({ 
        error: 'Failed to delete budget breakdowns',
        details: error.message 
      }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Budget breakdowns deleted successfully'
    })
  } catch (error) {
    console.error('Delete budget breakdowns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}