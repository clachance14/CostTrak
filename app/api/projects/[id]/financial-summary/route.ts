import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ForecastCalculationService } from '@/lib/services/forecast-calculations'

// GET /api/projects/[id]/financial-summary - Get comprehensive financial summary
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

    // Get project basic info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        job_number,
        original_contract,
        revised_contract,
        status,
        start_date,
        end_date,
        cost_to_complete_notes,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: projectError.message }, { status: 400 })
    }

    // Get purchase orders with line items
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        vendor_name,
        description,
        committed_amount,
        invoiced_amount,
        forecast_amount,
        forecasted_overrun,
        risk_status,
        status,
        budget_category,
        cost_center,
        created_at,
        cost_code:cost_codes(
          id,
          code,
          description
        ),
        po_line_items(
          id,
          description,
          quantity,
          unit_price,
          total_amount
        )
      `)
      .eq('project_id', id)

    // Get change orders
    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select(`
        id,
        co_number,
        description,
        amount,
        status,
        pricing_type,
        impact_schedule_days,
        reason,
        manhours,
        labor_amount,
        equipment_amount,
        material_amount,
        subcontract_amount,
        markup_amount,
        tax_amount,
        submitted_date,
        approved_date,
        rejection_reason,
        created_at,
        updated_at
      `)
      .eq('project_id', id)

    // Get project budget breakdowns (correct table)
    const { data: budgets, error: budgetsError } = await supabase
      .from('project_budget_breakdowns')
      .select(`
        id,
        discipline,
        cost_type,
        value,
        manhours,
        import_source,
        import_batch_id,
        created_at
      `)
      .eq('project_id', id)


    // Get labor actuals with craft type details
    const { data: laborActuals } = await supabase
      .from('labor_actuals')
      .select(`
        id,
        week_ending,
        actual_cost,
        actual_hours,
        craft_type:craft_types!inner(
          id,
          name,
          code,
          category
        )
      `)
      .eq('project_id', id)
      .order('week_ending', { ascending: false })

    // Get labor forecasts
    const { data: laborForecasts } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        id,
        week_ending,
        craft_type,
        forecasted_headcount,
        notes,
        created_at
      `)
      .eq('project_id', id)
      .order('week_ending', { ascending: true })

    // Get financial snapshots (if any)
    const { data: financialSnapshots } = await supabase
      .from('financial_snapshots')
      .select(`
        id,
        snapshot_date,
        snapshot_type,
        original_contract,
        revised_contract,
        total_committed,
        forecasted_cost,
        cost_to_complete,
        forecasted_profit,
        profit_margin,
        created_at
      `)
      .eq('project_id', id)
      .order('snapshot_date', { ascending: false })

    // Calculate financial metrics using centralized service
    const poTotals = ForecastCalculationService.calculateTotalPOForecast(purchaseOrders || [])
    const totalPOCommitted = poTotals.committed
    const totalPOInvoiced = poTotals.invoiced
    const totalPOForecasted = poTotals.forecasted
    
    const approvedChangeOrders = changeOrders?.filter(co => co.status === 'approved').reduce((sum, co) => sum + co.amount, 0) || 0
    const pendingChangeOrders = changeOrders?.filter(co => co.status === 'pending').reduce((sum, co) => sum + co.amount, 0) || 0
    
    const totalBudget = budgets?.reduce((sum, budget) => sum + (budget.value || 0), 0) || 0
    
    // Use centralized service for all forecast calculations
    const eacCalculation = await ForecastCalculationService.calculateProjectEAC(
      id,
      purchaseOrders || [],
      laborActuals || [],
      laborForecasts || []
    )
    
    const actualCostToDate = eacCalculation.actualCostToDate
    const estimateToComplete = eacCalculation.estimateToComplete
    const estimateAtCompletion = eacCalculation.estimateAtCompletion
    const totalLaborActual = eacCalculation.breakdown.laborActuals
    const futureLaborCost = eacCalculation.breakdown.laborFuture
    const remainingPOCommitments = eacCalculation.breakdown.poRemaining
    
    // Calculate derived metrics
    const revisedContract = project.revised_contract || project.original_contract || 0
    const varianceAtCompletion = revisedContract - estimateAtCompletion
    const forecastedProfit = varianceAtCompletion // Same as variance
    const profitMargin = revisedContract > 0 ? (forecastedProfit / revisedContract) * 100 : 0
    
    // Calculate percentage complete (simple estimate based on costs)
    const percentComplete = estimateAtCompletion > 0 ? Math.min(100, (actualCostToDate / estimateAtCompletion) * 100) : 0

    // Group budgets by category for breakdown
    const budgetBreakdown = budgets?.reduce((acc, budget) => {
      const category = budget.cost_type || 'Other'
      if (!acc[category]) {
        acc[category] = {
          budget: 0,
          committed: 0,
          actual: 0,
          forecasted: 0,
          variance: 0
        }
      }
      acc[category].budget += budget.value || 0
      acc[category].committed += 0 // Will be updated with PO data below
      acc[category].actual += 0 // Will be updated with invoiced amounts below
      acc[category].forecasted += budget.value || 0 // Use budget value as forecast for now
      acc[category].variance = acc[category].budget - acc[category].forecasted
      return acc
    }, {} as Record<string, {
      budget: number
      committed: number
      actual: number
      forecasted: number
      variance: number
    }>) || {}
    
    // Add PO amounts to budget breakdown
    purchaseOrders?.forEach(po => {
      if (po.budget_category && budgetBreakdown[po.budget_category]) {
        // Committed is the total PO value
        budgetBreakdown[po.budget_category].committed += po.committed_amount || 0
        // Actual is the invoiced amount
        budgetBreakdown[po.budget_category].actual += po.invoiced_amount || 0
        // Update forecasted to be the greater of budget, committed, or actuals
        budgetBreakdown[po.budget_category].forecasted = Math.max(
          budgetBreakdown[po.budget_category].budget,
          budgetBreakdown[po.budget_category].committed,
          budgetBreakdown[po.budget_category].actual
        )
        // Update variance (positive means under budget, negative means over budget)
        // Variance is budget minus the greater of committed or actuals
        budgetBreakdown[po.budget_category].variance = 
          budgetBreakdown[po.budget_category].budget - Math.max(
            budgetBreakdown[po.budget_category].committed,
            budgetBreakdown[po.budget_category].actual
          )
      }
    })

    // Add labor actuals to budget breakdown by category using centralized service
    const laborTotals = ForecastCalculationService.calculateTotalLaborActuals(laborActuals || [])
    
    // Initialize labor categories if they don't exist
    const laborCategories = ['DIRECT LABOR', 'INDIRECT LABOR', 'STAFF LABOR']
    laborCategories.forEach(category => {
      if (!budgetBreakdown[category]) {
        budgetBreakdown[category] = {
          budget: 0,
          committed: 0,
          actual: 0,
          forecasted: 0,
          variance: 0
        }
      }
    })
    
    // Update labor actuals by category
    if (laborTotals.byCategory.direct > 0) {
      budgetBreakdown['DIRECT LABOR'].actual = laborTotals.byCategory.direct
      budgetBreakdown['DIRECT LABOR'].committed = laborTotals.byCategory.direct
      budgetBreakdown['DIRECT LABOR'].forecasted = Math.max(
        budgetBreakdown['DIRECT LABOR'].budget,
        laborTotals.byCategory.direct + (eacCalculation.breakdown.laborFuture * 0.6) // Estimate 60% is direct
      )
      budgetBreakdown['DIRECT LABOR'].variance = budgetBreakdown['DIRECT LABOR'].budget - budgetBreakdown['DIRECT LABOR'].forecasted
    }
    
    if (laborTotals.byCategory.indirect > 0) {
      budgetBreakdown['INDIRECT LABOR'].actual = laborTotals.byCategory.indirect
      budgetBreakdown['INDIRECT LABOR'].committed = laborTotals.byCategory.indirect
      budgetBreakdown['INDIRECT LABOR'].forecasted = Math.max(
        budgetBreakdown['INDIRECT LABOR'].budget,
        laborTotals.byCategory.indirect + (eacCalculation.breakdown.laborFuture * 0.3) // Estimate 30% is indirect
      )
      budgetBreakdown['INDIRECT LABOR'].variance = budgetBreakdown['INDIRECT LABOR'].budget - budgetBreakdown['INDIRECT LABOR'].forecasted
    }
    
    if (laborTotals.byCategory.staff > 0) {
      budgetBreakdown['STAFF LABOR'].actual = laborTotals.byCategory.staff
      budgetBreakdown['STAFF LABOR'].committed = laborTotals.byCategory.staff
      budgetBreakdown['STAFF LABOR'].forecasted = Math.max(
        budgetBreakdown['STAFF LABOR'].budget,
        laborTotals.byCategory.staff + (eacCalculation.breakdown.laborFuture * 0.1) // Estimate 10% is staff
      )
      budgetBreakdown['STAFF LABOR'].variance = budgetBreakdown['STAFF LABOR'].budget - budgetBreakdown['STAFF LABOR'].forecasted
    }


    // Identify risk factors
    const riskFactors = []
    if (varianceAtCompletion < 0) {
      riskFactors.push({
        type: 'budget_overrun',
        severity: Math.abs(varianceAtCompletion) > revisedContract * 0.1 ? 'high' : 'medium',
        message: `Project forecasted to exceed budget by ${Math.abs(varianceAtCompletion).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
      })
    }
    
    const overBudgetPOs = purchaseOrders?.filter(po => (po.forecast_amount || 0) > (po.committed_amount || 0)) || []
    if (overBudgetPOs.length > 0) {
      riskFactors.push({
        type: 'po_overrun',
        severity: 'medium',
        message: `${overBudgetPOs.length} purchase order(s) forecasted over committed amount`
      })
    }

    if (profitMargin < 5) {
      riskFactors.push({
        type: 'low_margin',
        severity: profitMargin < 0 ? 'high' : 'medium',
        message: `Low profit margin: ${profitMargin.toFixed(1)}%`
      })
    }

    const summary = {
      project,
      financialMetrics: {
        originalContract: project.original_contract,
        approvedChangeOrders,
        pendingChangeOrders,
        revisedContract,
        budgetAtCompletion: totalBudget,
        actualCostToDate,
        estimateToComplete,
        estimateAtCompletion,
        varianceAtCompletion,
        forecastedProfit,
        profitMargin,
        percentComplete,
        totalPOCommitted,
        totalPOInvoiced,
        totalPOForecasted,
        totalLaborActual,
        futureLaborCost,
        remainingPOCommitments
      },
      budgetBreakdown,
      purchaseOrders: purchaseOrders || [],
      changeOrders: changeOrders || [],
      laborActuals: laborActuals?.slice(0, 10) || [], // Latest 10 weeks
      laborForecasts: laborForecasts?.slice(0, 20) || [], // Next 20 weeks
      financialSnapshots: financialSnapshots?.slice(0, 5) || [], // Latest 5 snapshots
      riskFactors,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Get financial summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}