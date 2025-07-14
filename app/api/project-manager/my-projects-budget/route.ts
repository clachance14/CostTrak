import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProjectBudgetSummary {
  projectId: string
  jobNumber: string
  projectName: string
  status: string
  originalContract: number
  revisedContract: number
  budgetTotal: number
  poCommitted: number
  actualSpent: number
  budgetVariance: number
  budgetVariancePercent: number
  utilizationPercent: number
  riskStatus: 'normal' | 'at-risk' | 'over-budget'
  lastUpdated: string
  disciplineCount: number
  totalManhours: number
}

// GET /api/project-manager/my-projects-budget - Get budget summary for PM's assigned projects
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is project manager
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'project_manager') {
      return NextResponse.json({ error: 'Access denied - must be project manager' }, { status: 403 })
    }

    // Get projects assigned to this PM
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        job_number,
        name,
        status,
        original_contract,
        revised_contract,
        start_date,
        end_date
      `)
      .or(`project_manager_id.eq.${user.id},superintendent_id.eq.${user.id}`)
      .in('status', ['planning', 'active'])
      .is('deleted_at', null)
      .order('job_number')

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json({ 
        error: 'Failed to fetch projects',
        details: projectsError.message 
      }, { status: 400 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        summary: {
          projectCount: 0,
          totalBudget: 0,
          totalCommitted: 0,
          totalActual: 0,
          averageUtilization: 0,
          projectsAtRisk: 0
        },
        projects: []
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
          discipline_count: 0,
          last_updated: null
        }
      }
    })

    const budgetResults = await Promise.all(budgetPromises)
    const budgetMap = new Map(budgetResults.map(r => [r.projectId, r.budgetData]))

    // Get PO commitments and actuals for all projects
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('project_id, total_amount, invoiced_amount, status')
      .in('project_id', projectIds)

    // Calculate PO commitments and actuals by project
    const poByProject = new Map<string, { committed: number; actual: number }>()
    poData?.forEach(po => {
      const existing = poByProject.get(po.project_id) || { committed: 0, actual: 0 }
      poByProject.set(po.project_id, {
        committed: existing.committed + (po.status === 'approved' ? (po.total_amount || 0) : 0),
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
        revisedContract: project.revised_contract || 0,
        budgetTotal,
        poCommitted: po.committed,
        actualSpent: po.actual,
        budgetVariance,
        budgetVariancePercent,
        utilizationPercent,
        riskStatus,
        lastUpdated: budget?.last_updated || project.start_date,
        disciplineCount: budget?.discipline_count || 0,
        totalManhours: budget?.total_manhours || 0
      }
    })

    // Calculate overall summary
    const projectsAtRisk = projectSummaries.filter(p => p.riskStatus !== 'normal').length
    
    const summary = {
      projectCount: projectSummaries.length,
      totalBudget: projectSummaries.reduce((sum, p) => sum + p.budgetTotal, 0),
      totalCommitted: projectSummaries.reduce((sum, p) => sum + p.poCommitted, 0),
      totalActual: projectSummaries.reduce((sum, p) => sum + p.actualSpent, 0),
      averageUtilization: projectSummaries.length > 0 
        ? projectSummaries.reduce((sum, p) => sum + p.utilizationPercent, 0) / projectSummaries.length 
        : 0,
      projectsAtRisk
    }

    return NextResponse.json({
      summary,
      projects: projectSummaries
    })
  } catch (error) {
    console.error('Get PM projects budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}