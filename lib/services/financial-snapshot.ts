import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.generated'

type FinancialSnapshot = Database['public']['Tables']['financial_snapshots']['Insert']

interface SnapshotOptions {
  type: 'project' | 'division' | 'company'
  projectId?: string
  divisionId?: string
  snapshotDate: string
}

interface Metric {
  original_contract?: number
  approved_change_orders?: number
  revised_contract?: number
  total_po_committed?: number
  total_labor_cost?: number
  total_other_cost?: number
  total_committed?: number
  forecasted_cost?: number
  forecasted_profit?: number
  cost_to_complete?: number
}

export async function calculateFinancialSnapshot(
  supabase: SupabaseClient<Database>,
  options: SnapshotOptions
): Promise<Database['public']['Tables']['financial_snapshots']['Row']> {
  const { type, projectId, divisionId, snapshotDate } = options

  let snapshotData: Partial<FinancialSnapshot> = {
    snapshot_type: type,
    snapshot_date: snapshotDate,
    project_id: projectId || null,
    division_id: divisionId || null,
  }

  if (type === 'project' && projectId) {
    snapshotData = await calculateProjectSnapshot(supabase, projectId, snapshotData)
  } else if (type === 'division' && divisionId) {
    snapshotData = await calculateDivisionSnapshot(supabase, divisionId, snapshotData)
  } else if (type === 'company') {
    snapshotData = await calculateCompanySnapshot(supabase, snapshotData)
  }

  // Insert the calculated snapshot
  const { data: snapshot, error } = await supabase
    .from('financial_snapshots')
    .insert(snapshotData as FinancialSnapshot)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create financial snapshot: ${error.message}`)
  }

  return snapshot
}

async function calculateProjectSnapshot(
  supabase: SupabaseClient<Database>,
  projectId: string,
  baseData: Partial<FinancialSnapshot>
): Promise<Partial<FinancialSnapshot>> {
  // Fetch project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) {
    throw new Error('Project not found')
  }

  // Calculate total PO committed
  const { data: poData } = await supabase
    .from('purchase_orders')
    .select('total_amount')
    .eq('project_id', projectId)
    .eq('status', 'approved')

  const totalPoCommitted = poData?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0

  // Calculate approved change orders
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('amount')
    .eq('project_id', projectId)
    .eq('status', 'approved')

  const totalChangeOrders = changeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0

  // Calculate labor costs
  const { data: laborActuals } = await supabase
    .from('labor_actuals')
    .select('total_cost')
    .eq('project_id', projectId)

  const totalLaborCost = laborActuals?.reduce((sum, labor) => sum + (labor.total_cost || 0), 0) || 0

  // Calculate labor forecast
  const { data: laborForecasts } = await supabase
    .from('labor_headcount_forecasts')
    .select('weekly_hours, craft_type_id')
    .eq('project_id', projectId)
    .gte('week_starting', new Date().toISOString())

  // Get running averages for forecast calculation
  const { data: runningAverages } = await supabase
    .from('labor_running_averages')
    .select('craft_type_id, avg_rate')
    .eq('project_id', projectId)

  const avgRateMap = new Map(runningAverages?.map(ra => [ra.craft_type_id, ra.avg_rate]) || [])
  
  const forecastedLaborCost = laborForecasts?.reduce((sum, forecast) => {
    const rate = avgRateMap.get(forecast.craft_type_id || '') || 0
    return sum + (forecast.weekly_hours * rate)
  }, 0) || 0

  // Calculate metrics
  const revisedContract = project.original_contract + totalChangeOrders
  const totalCommitted = totalPoCommitted + totalLaborCost
  const forecastedCost = totalCommitted + forecastedLaborCost
  const forecastedProfit = revisedContract - forecastedCost
  const profitMargin = revisedContract > 0 ? (forecastedProfit / revisedContract) * 100 : 0
  const costToComplete = forecastedCost - totalCommitted
  const percentComplete = totalCommitted > 0 && forecastedCost > 0 
    ? (totalCommitted / forecastedCost) * 100 
    : 0

  return {
    ...baseData,
    division_id: project.division_id,
    original_contract: project.original_contract,
    approved_change_orders: totalChangeOrders,
    revised_contract: revisedContract,
    total_po_committed: totalPoCommitted,
    total_labor_cost: totalLaborCost,
    total_other_cost: 0, // Placeholder for other costs
    total_committed: totalCommitted,
    forecasted_cost: forecastedCost,
    forecasted_profit: forecastedProfit,
    profit_margin: profitMargin,
    cost_to_complete: costToComplete,
    percent_complete: percentComplete,
    metadata: {
      project_name: project.name,
      job_number: project.job_number,
      status: project.status,
      po_count: poData?.length || 0,
      co_count: changeOrders?.length || 0,
    }
  }
}

async function calculateDivisionSnapshot(
  supabase: SupabaseClient<Database>,
  divisionId: string,
  baseData: Partial<FinancialSnapshot>
): Promise<Partial<FinancialSnapshot>> {
  // Get all active projects in division
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('division_id', divisionId)
    .in('status', ['active', 'planning'])

  if (!projects || projects.length === 0) {
    return {
      ...baseData,
      original_contract: 0,
      approved_change_orders: 0,
      revised_contract: 0,
      total_po_committed: 0,
      total_labor_cost: 0,
      total_other_cost: 0,
      total_committed: 0,
      forecasted_cost: 0,
      forecasted_profit: 0,
      profit_margin: 0,
      cost_to_complete: 0,
      percent_complete: 0,
      metadata: { project_count: 0 }
    }
  }

  const projectIds = projects.map(p => p.id)

  // Calculate aggregated metrics for all projects
  const metrics = await Promise.all(
    projectIds.map(pid => 
      calculateProjectSnapshot(supabase, pid, { ...baseData, project_id: pid })
    )
  )

  // Aggregate the metrics
  const aggregated = metrics.reduce((acc: Metric, metric: Metric) => ({
    original_contract: acc.original_contract + (metric.original_contract || 0),
    approved_change_orders: acc.approved_change_orders + (metric.approved_change_orders || 0),
    revised_contract: acc.revised_contract + (metric.revised_contract || 0),
    total_po_committed: acc.total_po_committed + (metric.total_po_committed || 0),
    total_labor_cost: acc.total_labor_cost + (metric.total_labor_cost || 0),
    total_other_cost: acc.total_other_cost + (metric.total_other_cost || 0),
    total_committed: acc.total_committed + (metric.total_committed || 0),
    forecasted_cost: acc.forecasted_cost + (metric.forecasted_cost || 0),
    forecasted_profit: acc.forecasted_profit + (metric.forecasted_profit || 0),
    cost_to_complete: acc.cost_to_complete + (metric.cost_to_complete || 0),
  } as Metric), {
    original_contract: 0,
    approved_change_orders: 0,
    revised_contract: 0,
    total_po_committed: 0,
    total_labor_cost: 0,
    total_other_cost: 0,
    total_committed: 0,
    forecasted_cost: 0,
    forecasted_profit: 0,
    cost_to_complete: 0,
  })

  const profitMargin = aggregated.revised_contract > 0 
    ? (aggregated.forecasted_profit / aggregated.revised_contract) * 100 
    : 0

  const percentComplete = aggregated.total_committed > 0 && aggregated.forecasted_cost > 0
    ? (aggregated.total_committed / aggregated.forecasted_cost) * 100
    : 0

  return {
    ...baseData,
    ...aggregated,
    profit_margin: profitMargin,
    percent_complete: percentComplete,
    metadata: {
      project_count: projects.length,
      division_id: divisionId,
    }
  }
}

async function calculateCompanySnapshot(
  supabase: SupabaseClient<Database>,
  baseData: Partial<FinancialSnapshot>
): Promise<Partial<FinancialSnapshot>> {
  // Get all active divisions
  const { data: divisions } = await supabase
    .from('divisions')
    .select('id')
    .eq('is_active', true)

  if (!divisions || divisions.length === 0) {
    return {
      ...baseData,
      original_contract: 0,
      approved_change_orders: 0,
      revised_contract: 0,
      total_po_committed: 0,
      total_labor_cost: 0,
      total_other_cost: 0,
      total_committed: 0,
      forecasted_cost: 0,
      forecasted_profit: 0,
      profit_margin: 0,
      cost_to_complete: 0,
      percent_complete: 0,
      metadata: { division_count: 0, project_count: 0 }
    }
  }

  const divisionIds = divisions.map(d => d.id)

  // Calculate aggregated metrics for all divisions
  const metrics = await Promise.all(
    divisionIds.map(did => 
      calculateDivisionSnapshot(supabase, did, { ...baseData, division_id: did })
    )
  )

  // Aggregate the metrics
  const aggregated = metrics.reduce((acc: Metric, metric: Metric) => ({
    original_contract: acc.original_contract + (metric.original_contract || 0),
    approved_change_orders: acc.approved_change_orders + (metric.approved_change_orders || 0),
    revised_contract: acc.revised_contract + (metric.revised_contract || 0),
    total_po_committed: acc.total_po_committed + (metric.total_po_committed || 0),
    total_labor_cost: acc.total_labor_cost + (metric.total_labor_cost || 0),
    total_other_cost: acc.total_other_cost + (metric.total_other_cost || 0),
    total_committed: acc.total_committed + (metric.total_committed || 0),
    forecasted_cost: acc.forecasted_cost + (metric.forecasted_cost || 0),
    forecasted_profit: acc.forecasted_profit + (metric.forecasted_profit || 0),
    cost_to_complete: acc.cost_to_complete + (metric.cost_to_complete || 0),
    project_count: acc.project_count + ((metric as { metadata?: { project_count?: number } }).metadata?.project_count || 0),
  } as Metric), {
    original_contract: 0,
    approved_change_orders: 0,
    revised_contract: 0,
    total_po_committed: 0,
    total_labor_cost: 0,
    total_other_cost: 0,
    total_committed: 0,
    forecasted_cost: 0,
    forecasted_profit: 0,
    cost_to_complete: 0,
    project_count: 0,
  })

  const profitMargin = aggregated.revised_contract > 0 
    ? (aggregated.forecasted_profit / aggregated.revised_contract) * 100 
    : 0

  const percentComplete = aggregated.total_committed > 0 && aggregated.forecasted_cost > 0
    ? (aggregated.total_committed / aggregated.forecasted_cost) * 100
    : 0

  return {
    ...baseData,
    ...aggregated,
    profit_margin: profitMargin,
    percent_complete: percentComplete,
    metadata: {
      division_count: divisions.length,
      project_count: aggregated.project_count,
    }
  }
}