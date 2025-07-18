import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Get project with all related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        division:divisions!projects_division_id_fkey(id, name, code),
        client:clients!projects_client_id_fkey(id, name),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        change_orders(id, amount, status),
        purchase_orders(
          id,
          po_number,
          total_amount,
          committed_amount,
          forecasted_final_cost,
          risk_status,
          invoiced_amount
        )
      `)
      .eq('id', id)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      console.error('Error fetching project:', projectError)
      return NextResponse.json({ error: projectError.message }, { status: 500 })
    }

    // Calculate financial metrics
    const approvedChangeOrders = project.change_orders
      ?.filter((co: any) => co.status === 'approved')
      .reduce((sum: number, co: any) => sum + Number(co.amount), 0) || 0

    const revisedContract = Number(project.original_contract) + approvedChangeOrders

    const totalPoCommitted = project.purchase_orders
      ?.reduce((sum: number, po: any) => sum + Number(po.committed_amount || po.total_amount), 0) || 0

    const totalPoForecasted = project.purchase_orders
      ?.reduce((sum: number, po: any) => sum + Number(po.forecasted_final_cost || po.committed_amount || po.total_amount), 0) || 0

    const totalInvoiced = project.purchase_orders
      ?.reduce((sum: number, po: any) => sum + Number(po.invoiced_amount || 0), 0) || 0

    // Get labor costs
    const { data: laborCosts } = await supabase
      .from('labor_actuals')
      .select('actual_cost')
      .eq('project_id', id)

    const totalLaborCost = laborCosts
      ?.reduce((sum, record) => sum + Number(record.actual_cost), 0) || 0

    // Calculate totals
    const actualCostToDate = totalLaborCost + totalInvoiced
    const forecastedFinalCost = totalLaborCost + totalPoForecasted
    const costToComplete = Math.max(0, forecastedFinalCost - actualCostToDate)
    const profitForecast = revisedContract - forecastedFinalCost
    const marginPercent = revisedContract > 0 ? (profitForecast / revisedContract) * 100 : 0
    const varianceAtCompletion = revisedContract - forecastedFinalCost

    // Get recent imports
    const { data: recentImports } = await supabase
      .from('data_imports')
      .select(`
        id,
        import_type,
        import_status,
        imported_at,
        imported_by_user:profiles!imported_by(id, first_name, last_name)
      `)
      .eq('project_id', id)
      .in('import_status', ['success', 'completed_with_errors'])
      .order('imported_at', { ascending: false })
      .limit(5)

    // Identify POs at risk
    const riskyPOs = project.purchase_orders?.filter((po: any) => {
      const invoicePercentage = Number(po.committed_amount) > 0 
        ? (Number(po.invoiced_amount) / Number(po.committed_amount)) * 100 
        : 0
      const hasOverrun = Number(po.forecasted_final_cost) > Number(po.committed_amount)
      return po.risk_status === 'critical' || po.risk_status === 'warning' || invoicePercentage > 90 || hasOverrun
    }) || []

    // Determine overall project status
    let overallStatus = 'green'
    const marginThresholdYellow = 10
    const marginThresholdRed = 5
    
    if (marginPercent < marginThresholdRed || project.data_health_status === 'missing') {
      overallStatus = 'red'
    } else if (marginPercent < marginThresholdYellow || project.data_health_status === 'stale') {
      overallStatus = 'yellow'
    }

    return NextResponse.json({
      project: {
        id: project.id,
        job_number: project.job_number,
        name: project.name,
        status: project.status,
        division: project.division,
        client: project.client,
        project_manager: project.project_manager,
        start_date: project.start_date,
        end_date: project.end_date,
        percent_complete: project.percent_complete,
        physical_percent_complete: project.physical_percent_complete
      },
      financial: {
        original_contract: Number(project.original_contract),
        approved_change_orders: approvedChangeOrders,
        revised_contract: revisedContract,
        actual_cost_to_date: actualCostToDate,
        forecasted_final_cost: forecastedFinalCost,
        cost_to_complete: costToComplete,
        profit_forecast: profitForecast,
        margin_percent: marginPercent,
        variance_at_completion: varianceAtCompletion,
        total_po_committed: totalPoCommitted,
        total_labor_cost: totalLaborCost,
        total_invoiced: totalInvoiced
      },
      data_health: {
        status: project.data_health_status,
        last_labor_import: project.last_labor_import_at,
        last_po_import: project.last_po_import_at,
        last_checked: project.data_health_checked_at
      },
      alerts: {
        overall_status: overallStatus,
        risky_pos: riskyPOs.map((po: any) => ({
          id: po.id,
          po_number: po.po_number,
          risk_status: po.risk_status,
          committed: Number(po.committed_amount || po.total_amount),
          forecasted: Number(po.forecasted_final_cost),
          overrun: Number(po.forecasted_final_cost) - Number(po.committed_amount || po.total_amount),
          invoice_percentage: Number(po.committed_amount) > 0 
            ? (Number(po.invoiced_amount) / Number(po.committed_amount)) * 100 
            : 0
        })),
        data_freshness_issues: project.data_health_status !== 'current'
      },
      recent_activity: {
        imports: recentImports || [],
        last_updated: project.updated_at
      }
    })
  } catch (error) {
    console.error('Error in project dashboard summary GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}