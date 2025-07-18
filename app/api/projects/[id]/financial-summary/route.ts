import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Calculate financial metrics
    const totalPOCommitted = purchaseOrders?.reduce((sum, po) => sum + (po.committed_amount || 0), 0) || 0
    const totalPOInvoiced = purchaseOrders?.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0) || 0
    const totalPOForecasted = purchaseOrders?.reduce((sum, po) => sum + (po.forecast_amount || po.committed_amount || 0), 0) || 0
    
    const approvedChangeOrders = changeOrders?.filter(co => co.status === 'approved').reduce((sum, co) => sum + co.amount, 0) || 0
    const pendingChangeOrders = changeOrders?.filter(co => co.status === 'pending').reduce((sum, co) => sum + co.amount, 0) || 0
    
    const totalBudget = budgets?.reduce((sum, budget) => sum + (budget.value || 0), 0) || 0
    const totalLaborActual = laborActuals?.reduce((sum, labor) => sum + (labor.actual_cost || 0), 0) || 0
    
    // Step 1: Calculate AC (Actual Cost) - what has been spent
    const actualCostToDate = totalPOInvoiced + totalLaborActual
    
    // Step 2: Calculate future labor forecast costs
    // Get running average rates from latest labor actuals by craft type
    const latestRatesByCraft = laborActuals?.reduce((rates, labor) => {
      const craftTypeId = labor.craft_type?.id
      if (craftTypeId && (!rates[craftTypeId] || new Date(labor.week_ending) > new Date(rates[craftTypeId].week_ending))) {
        rates[craftTypeId] = {
          rate: labor.actual_hours > 0 ? labor.actual_cost / labor.actual_hours : 0,
          week_ending: labor.week_ending
        }
      }
      return rates
    }, {} as Record<string, { rate: number; week_ending: string }>) || {}
    
    // Calculate future labor costs from headcount forecasts
    const futureLaborCost = laborForecasts?.reduce((sum, forecast) => {
      const craftRate = latestRatesByCraft[forecast.craft_type]?.rate || 0
      const weeklyHours = 40 // Standard work week
      const weeklyLaborCost = forecast.forecasted_headcount * craftRate * weeklyHours
      return sum + weeklyLaborCost
    }, 0) || 0
    
    // Step 3: Calculate ETC (Estimate to Complete)
    const remainingPOCommitments = Math.max(0, totalPOCommitted - totalPOInvoiced)
    const estimateToComplete = remainingPOCommitments + futureLaborCost
    
    // Step 4: Calculate EAC (Estimate at Completion)
    const estimateAtCompletion = actualCostToDate + estimateToComplete
    
    // Calculate derived metrics
    const revisedContract = project.revised_contract || project.original_contract
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

    // Add labor actuals to budget breakdown by category
    // Initialize labor categories if they don't exist
    if (!budgetBreakdown['DIRECT LABOR']) {
      budgetBreakdown['DIRECT LABOR'] = {
        budget: 0,
        committed: 0,
        actual: 0,
        forecasted: 0,
        variance: 0
      }
    }
    if (!budgetBreakdown['INDIRECT LABOR']) {
      budgetBreakdown['INDIRECT LABOR'] = {
        budget: 0,
        committed: 0,
        actual: 0,
        forecasted: 0,
        variance: 0
      }
    }
    
    // Sum labor actuals by category
    const directLaborActual = laborActuals?.reduce((sum, labor) => {
      return labor.craft_type?.category === 'direct' ? sum + (labor.actual_cost || 0) : sum
    }, 0) || 0
    
    const indirectLaborActual = laborActuals?.reduce((sum, labor) => {
      return labor.craft_type?.category === 'indirect' ? sum + (labor.actual_cost || 0) : sum
    }, 0) || 0
    
    // Add direct labor costs
    if (directLaborActual > 0) {
      budgetBreakdown['DIRECT LABOR'].actual += directLaborActual
      budgetBreakdown['DIRECT LABOR'].committed += directLaborActual
      budgetBreakdown['DIRECT LABOR'].forecasted = Math.max(
        budgetBreakdown['DIRECT LABOR'].budget,
        budgetBreakdown['DIRECT LABOR'].committed,
        budgetBreakdown['DIRECT LABOR'].actual
      )
      budgetBreakdown['DIRECT LABOR'].variance = budgetBreakdown['DIRECT LABOR'].budget - budgetBreakdown['DIRECT LABOR'].forecasted
    }
    
    // Add indirect labor costs
    if (indirectLaborActual > 0) {
      budgetBreakdown['INDIRECT LABOR'].actual += indirectLaborActual
      budgetBreakdown['INDIRECT LABOR'].committed += indirectLaborActual
      budgetBreakdown['INDIRECT LABOR'].forecasted = Math.max(
        budgetBreakdown['INDIRECT LABOR'].budget,
        budgetBreakdown['INDIRECT LABOR'].committed,
        budgetBreakdown['INDIRECT LABOR'].actual
      )
      budgetBreakdown['INDIRECT LABOR'].variance = budgetBreakdown['INDIRECT LABOR'].budget - budgetBreakdown['INDIRECT LABOR'].forecasted
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