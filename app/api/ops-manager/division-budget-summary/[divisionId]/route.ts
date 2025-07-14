import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProjectBudgetSummary {
  projectId: string
  jobNumber: string
  projectName: string
  status: string
  originalContract: number
  budgetTotal: number
  poCommitted: number
  actualSpent: number
  budgetVariance: number
  budgetVariancePercent: number
  utilizationPercent: number
  riskStatus: 'normal' | 'at-risk' | 'over-budget'
}

interface DisciplineSummary {
  discipline: string
  budgetTotal: number
  committed: number
  actual: number
  variance: number
  variancePercent: number
}

// GET /api/ops-manager/division-budget-summary/[divisionId] - Get budget summary for division
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { divisionId } = await params
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is ops manager for this division
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'ops_manager' || profile.division_id !== divisionId) {
      return NextResponse.json({ error: 'Access denied - must be ops manager for this division' }, { status: 403 })
    }

    // Get all active projects in the division
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        job_number,
        name,
        status,
        original_contract,
        revised_contract
      `)
      .eq('division_id', divisionId)
      .in('status', ['planning', 'active'])
      .is('deleted_at', null)

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json({ 
        error: 'Failed to fetch projects',
        details: projectsError.message 
      }, { status: 400 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        division: { id: divisionId, projectCount: 0 },
        summary: {
          totalBudget: 0,
          totalCommitted: 0,
          totalActual: 0,
          totalVariance: 0,
          averageUtilization: 0
        },
        projects: [],
        disciplines: []
      })
    }

    const projectIds = projects.map(p => p.id)

    // Get budget breakdown data for all projects
    const budgetPromises = projectIds.map(async (projectId) => {
      const { data: budgetData } = await supabase
        .rpc('calculate_project_budget_from_breakdowns', { p_project_id: projectId })
        .single()

      return {
        projectId,
        budgetData: budgetData || {
          total_budget: 0,
          total_labor: 0,
          total_materials: 0,
          total_equipment: 0,
          total_subcontract: 0,
          total_other: 0,
          total_manhours: 0,
          discipline_count: 0
        }
      }
    })

    const budgetResults = await Promise.all(budgetPromises)
    const budgetMap = new Map(budgetResults.map(r => [r.projectId, r.budgetData]))

    // Get PO commitments for all projects
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('project_id, total_amount, invoiced_amount')
      .in('project_id', projectIds)
      .eq('status', 'approved')

    // Calculate PO commitments and actuals by project
    const poByProject = new Map<string, { committed: number; actual: number }>()
    poData?.forEach(po => {
      const existing = poByProject.get(po.project_id) || { committed: 0, actual: 0 }
      poByProject.set(po.project_id, {
        committed: existing.committed + (po.total_amount || 0),
        actual: existing.actual + (po.invoiced_amount || 0)
      })
    })

    // Calculate project summaries
    const projectSummaries: ProjectBudgetSummary[] = projects.map(project => {
      const budget = budgetMap.get(project.id)
      const po = poByProject.get(project.id) || { committed: 0, actual: 0 }
      
      const budgetTotal = budget?.total_budget || 0
      const budgetVariance = budgetTotal - (project.original_contract || 0)
      const budgetVariancePercent = project.original_contract > 0 
        ? (budgetVariance / project.original_contract) * 100 
        : 0
      
      const utilizationPercent = budgetTotal > 0 
        ? (po.committed / budgetTotal) * 100 
        : 0

      let riskStatus: 'normal' | 'at-risk' | 'over-budget' = 'normal'
      if (Math.abs(budgetVariancePercent) > 15) {
        riskStatus = 'over-budget'
      } else if (Math.abs(budgetVariancePercent) > 10 || utilizationPercent > 90) {
        riskStatus = 'at-risk'
      }

      return {
        projectId: project.id,
        jobNumber: project.job_number,
        projectName: project.name,
        status: project.status,
        originalContract: project.original_contract || 0,
        budgetTotal,
        poCommitted: po.committed,
        actualSpent: po.actual,
        budgetVariance,
        budgetVariancePercent,
        utilizationPercent,
        riskStatus
      }
    })

    // Get discipline breakdown across all projects
    const { data: disciplineData } = await supabase
      .from('project_budget_breakdowns')
      .select('discipline, cost_type, value')
      .in('project_id', projectIds)

    // Calculate discipline summaries
    const disciplineMap = new Map<string, { budget: number; committed: number; actual: number }>()
    
    disciplineData?.forEach(item => {
      const existing = disciplineMap.get(item.discipline) || { budget: 0, committed: 0, actual: 0 }
      disciplineMap.set(item.discipline, {
        ...existing,
        budget: existing.budget + item.value
      })
    })

    // Add PO data to discipline breakdown (simplified - could be enhanced)
    const disciplines: DisciplineSummary[] = Array.from(disciplineMap.entries()).map(([discipline, data]) => {
      const variance = data.budget - data.committed
      const variancePercent = data.budget > 0 ? (variance / data.budget) * 100 : 0
      
      return {
        discipline,
        budgetTotal: data.budget,
        committed: data.committed,
        actual: data.actual,
        variance,
        variancePercent
      }
    }).sort((a, b) => b.budgetTotal - a.budgetTotal)

    // Calculate overall summary
    const summary = {
      totalBudget: projectSummaries.reduce((sum, p) => sum + p.budgetTotal, 0),
      totalCommitted: projectSummaries.reduce((sum, p) => sum + p.poCommitted, 0),
      totalActual: projectSummaries.reduce((sum, p) => sum + p.actualSpent, 0),
      totalVariance: projectSummaries.reduce((sum, p) => sum + p.budgetVariance, 0),
      averageUtilization: projectSummaries.length > 0 
        ? projectSummaries.reduce((sum, p) => sum + p.utilizationPercent, 0) / projectSummaries.length 
        : 0
    }

    return NextResponse.json({
      division: {
        id: divisionId,
        projectCount: projects.length
      },
      summary,
      projects: projectSummaries,
      disciplines
    })
  } catch (error) {
    console.error('Get division budget summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}