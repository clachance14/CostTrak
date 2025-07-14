import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/project-budget-breakdowns/summary/[projectId] - Get budget breakdown summary by discipline
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

    // Get budget totals using the database function
    const { data: totals, error: totalsError } = await supabase
      .rpc('calculate_project_budget_from_breakdowns', { p_project_id: projectId })
      .single()

    if (totalsError) {
      console.error('Error fetching budget totals:', totalsError)
      return NextResponse.json({ 
        error: 'Failed to fetch budget totals',
        details: totalsError.message 
      }, { status: 400 })
    }

    // Get budget breakdown by discipline
    const { data: byDiscipline, error: disciplineError } = await supabase
      .rpc('get_project_budget_by_discipline', { p_project_id: projectId })

    if (disciplineError) {
      console.error('Error fetching discipline breakdown:', disciplineError)
      return NextResponse.json({ 
        error: 'Failed to fetch discipline breakdown',
        details: disciplineError.message 
      }, { status: 400 })
    }

    // Get project details for context
    const { data: project } = await supabase
      .from('projects')
      .select('job_number, name, original_contract, revised_contract')
      .eq('id', projectId)
      .single()

    // Calculate variance if project has contract values
    const budgetVariance = project?.original_contract 
      ? totals.total_budget - project.original_contract 
      : null

    const budgetVariancePercent = project?.original_contract && project.original_contract > 0
      ? ((totals.total_budget - project.original_contract) / project.original_contract) * 100
      : null

    return NextResponse.json({
      project: {
        id: projectId,
        jobNumber: project?.job_number,
        name: project?.name,
        originalContract: project?.original_contract,
        revisedContract: project?.revised_contract
      },
      summary: {
        totals: {
          budget: totals.total_budget,
          labor: totals.total_labor,
          materials: totals.total_materials,
          equipment: totals.total_equipment,
          subcontract: totals.total_subcontract,
          other: totals.total_other,
          manhours: totals.total_manhours
        },
        disciplineCount: totals.discipline_count,
        lastUpdated: totals.last_updated,
        budgetVariance,
        budgetVariancePercent
      },
      disciplines: byDiscipline?.map((d: {
        discipline: string
        total_value: number
        labor_value: number
        materials_value: number
        equipment_value: number
        subcontract_value: number
        other_value: number
        total_manhours: number
        percentage_of_total: number
      }) => ({
        discipline: d.discipline,
        totalValue: d.total_value,
        laborValue: d.labor_value,
        materialsValue: d.materials_value,
        equipmentValue: d.equipment_value,
        subcontractValue: d.subcontract_value,
        otherValue: d.other_value,
        totalManhours: d.total_manhours,
        percentageOfTotal: d.percentage_of_total
      })) || []
    })
  } catch (error) {
    console.error('Get budget summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}