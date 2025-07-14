import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check user authentication and role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has appropriate role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['ops_manager', 'executive', 'controller'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const divisionId = searchParams.get('divisionId')

    // Base query for project financial summary
    let query = supabase
      .from('project_financial_summary')
      .select('*')

    // Apply division filter if provided
    if (divisionId) {
      // Need to join with projects to filter by division
      const { data: divisionProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('division_id', divisionId)
        .eq('status', 'active')

      const projectIds = divisionProjects?.map(p => p.id) || []
      query = query.in('id', projectIds)
    }

    const { data: financialSummary, error: summaryError } = await query
      .eq('status', 'active')
      .order('job_number')

    if (summaryError) throw summaryError

    // Calculate aggregated metrics
    const totals = financialSummary?.reduce((acc, project) => ({
      totalProjects: acc.totalProjects + 1,
      totalContractValue: acc.totalContractValue + (project.revised_contract_amount || 0),
      totalActualCost: acc.totalActualCost + (project.actual_cost_to_date || 0),
      totalCommitted: acc.totalCommitted + (project.total_committed || 0),
      totalForecastedCost: acc.totalForecastedCost + (project.total_forecasted_cost || 0),
      totalProfitForecast: acc.totalProfitForecast + (project.profit_forecast || 0),
      totalVariance: acc.totalVariance + (project.variance_at_completion || 0)
    }), {
      totalProjects: 0,
      totalContractValue: 0,
      totalActualCost: 0,
      totalCommitted: 0,
      totalForecastedCost: 0,
      totalProfitForecast: 0,
      totalVariance: 0
    }) || {
      totalProjects: 0,
      totalContractValue: 0,
      totalActualCost: 0,
      totalCommitted: 0,
      totalForecastedCost: 0,
      totalProfitForecast: 0,
      totalVariance: 0
    }

    // Calculate average margin
    const averageMargin = totals.totalContractValue > 0 
      ? (totals.totalProfitForecast / totals.totalContractValue) * 100 
      : 0

    // Get at-risk projects (margin < 10%)
    const atRiskProjects = financialSummary?.filter(p => 
      p.margin_percent < 10 && p.status === 'active'
    ) || []

    // Get overspent POs
    const { data: overspentPOs, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        po_value,
        forecasted_final_cost,
        projects!inner(name, job_number)
      `)
      .gt('forecasted_final_cost', 0)
      .not('po_value', 'is', null)
      .order('po_number')

    if (poError) console.error('Error fetching overspent POs:', poError)

    // Filter POs where forecasted final cost > po value
    const filteredOverspentPOs = overspentPOs?.filter(po => 
      po.forecasted_final_cost && po.po_value && po.forecasted_final_cost > po.po_value
    ) || []

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          ...totals,
          averageMargin
        },
        projects: financialSummary,
        atRiskProjects,
        overspentPOs: filteredOverspentPOs,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching financial summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial summary' },
      { status: 500 }
    )
  }
}