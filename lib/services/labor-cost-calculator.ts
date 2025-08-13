import { createClient } from '@/lib/supabase/server'

export interface LaborCostSummary {
  totalHours: number
  totalLaborCost: number  // Labor wages + burden
  totalPerDiem: number
  totalCost: number  // Labor + per diem
  breakdown: {
    direct: {
      hours: number
      laborCost: number
      perDiem: number
      total: number
    }
    indirect: {
      hours: number
      laborCost: number
      perDiem: number
      total: number
    }
    staff: {
      hours: number
      laborCost: number
      perDiem: number
      total: number
    }
  }
}

/**
 * Calculate total labor costs including per diem for a project
 * @param projectId - The project ID to calculate costs for
 * @param divisionId - Optional division filter
 * @returns Labor cost summary with breakdown by category
 */
export async function calculateProjectLaborCosts(
  projectId: string,
  divisionId?: string
): Promise<LaborCostSummary> {
  const supabase = await createClient()
  
  // Initialize summary
  const summary: LaborCostSummary = {
    totalHours: 0,
    totalLaborCost: 0,
    totalPerDiem: 0,
    totalCost: 0,
    breakdown: {
      direct: { hours: 0, laborCost: 0, perDiem: 0, total: 0 },
      indirect: { hours: 0, laborCost: 0, perDiem: 0, total: 0 },
      staff: { hours: 0, laborCost: 0, perDiem: 0, total: 0 }
    }
  }

  // Query labor actuals
  let laborQuery = supabase
    .from('labor_employee_actuals')
    .select(`
      total_hours,
      total_cost_with_burden,
      employees!inner(category)
    `)
    .eq('project_id', projectId)
  
  if (divisionId) {
    laborQuery = laborQuery.eq('division_id', divisionId)
  }
  
  const { data: laborActuals, error: laborError } = await laborQuery
  
  if (laborError) {
    console.error('Error fetching labor actuals:', laborError)
  }

  // Process labor actuals
  laborActuals?.forEach(labor => {
    const hours = labor.total_hours || 0
    const cost = labor.total_cost_with_burden || 0
    const category = labor.employees?.category?.toLowerCase() || 'direct'
    
    summary.totalHours += hours
    summary.totalLaborCost += cost
    
    if (category === 'indirect') {
      summary.breakdown.indirect.hours += hours
      summary.breakdown.indirect.laborCost += cost
    } else if (category === 'staff') {
      summary.breakdown.staff.hours += hours
      summary.breakdown.staff.laborCost += cost
    } else {
      summary.breakdown.direct.hours += hours
      summary.breakdown.direct.laborCost += cost
    }
  })

  // Query per diem costs
  let perDiemQuery = supabase
    .from('per_diem_costs')
    .select('employee_type, amount')
    .eq('project_id', projectId)
  
  if (divisionId) {
    // If filtering by division, need to join with labor_employee_actuals
    perDiemQuery = supabase
      .from('per_diem_costs')
      .select(`
        employee_type,
        amount,
        labor_employee_actuals!inner(division_id)
      `)
      .eq('project_id', projectId)
      .eq('labor_employee_actuals.division_id', divisionId)
  }
  
  const { data: perDiemCosts, error: perDiemError } = await perDiemQuery
  
  if (perDiemError) {
    console.error('Error fetching per diem costs:', perDiemError)
  }

  // Process per diem costs
  perDiemCosts?.forEach(perDiem => {
    const amount = perDiem.amount || 0
    summary.totalPerDiem += amount
    
    if (perDiem.employee_type === 'Direct') {
      summary.breakdown.direct.perDiem += amount
    } else if (perDiem.employee_type === 'Indirect') {
      summary.breakdown.indirect.perDiem += amount
    }
    // Note: Staff doesn't have per diem in the current schema
  })

  // Calculate totals for each category
  summary.breakdown.direct.total = 
    summary.breakdown.direct.laborCost + summary.breakdown.direct.perDiem
  summary.breakdown.indirect.total = 
    summary.breakdown.indirect.laborCost + summary.breakdown.indirect.perDiem
  summary.breakdown.staff.total = 
    summary.breakdown.staff.laborCost + summary.breakdown.staff.perDiem
  
  // Calculate grand total
  summary.totalCost = summary.totalLaborCost + summary.totalPerDiem

  return summary
}

/**
 * Get weekly labor costs including per diem
 * @param projectId - The project ID
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @returns Array of weekly labor costs with per diem
 */
export async function getWeeklyLaborCosts(
  projectId: string,
  startDate?: Date,
  endDate?: Date
) {
  const supabase = await createClient()
  
  // Query weekly labor actuals
  let laborQuery = supabase
    .from('labor_employee_actuals')
    .select(`
      week_ending,
      total_hours,
      total_cost_with_burden,
      employees!inner(category)
    `)
    .eq('project_id', projectId)
    .order('week_ending', { ascending: true })
  
  if (startDate) {
    laborQuery = laborQuery.gte('week_ending', startDate.toISOString())
  }
  if (endDate) {
    laborQuery = laborQuery.lte('week_ending', endDate.toISOString())
  }
  
  const { data: laborActuals } = await laborQuery
  
  // Query per diem costs
  let perDiemQuery = supabase
    .from('per_diem_costs')
    .select('work_date, employee_type, amount')
    .eq('project_id', projectId)
  
  if (startDate) {
    perDiemQuery = perDiemQuery.gte('work_date', startDate.toISOString())
  }
  if (endDate) {
    perDiemQuery = perDiemQuery.lte('work_date', endDate.toISOString())
  }
  
  const { data: perDiemCosts } = await perDiemQuery
  
  // Group by week
  const weeklyData = new Map<string, {
    weekEnding: string
    totalHours: number
    totalLaborCost: number
    directLaborCost: number
    indirectLaborCost: number
    staffLaborCost: number
    directPerDiem: number
    indirectPerDiem: number
    totalPerDiem: number
    totalCost: number
  }>()
  
  // Process labor actuals
  laborActuals?.forEach(labor => {
    const weekKey = labor.week_ending
    const existing = weeklyData.get(weekKey) || {
      weekEnding: weekKey,
      totalHours: 0,
      totalLaborCost: 0,
      directLaborCost: 0,
      indirectLaborCost: 0,
      staffLaborCost: 0,
      directPerDiem: 0,
      indirectPerDiem: 0,
      totalPerDiem: 0,
      totalCost: 0
    }
    
    const hours = labor.total_hours || 0
    const cost = labor.total_cost_with_burden || 0
    const category = labor.employees?.category?.toLowerCase() || 'direct'
    
    existing.totalHours += hours
    existing.totalLaborCost += cost
    
    if (category === 'indirect') {
      existing.indirectLaborCost += cost
    } else if (category === 'staff') {
      existing.staffLaborCost += cost
    } else {
      existing.directLaborCost += cost
    }
    
    weeklyData.set(weekKey, existing)
  })
  
  // Process per diem costs (group by week)
  perDiemCosts?.forEach(perDiem => {
    // Calculate week ending from work date (Sunday)
    const workDate = new Date(perDiem.work_date)
    const dayOfWeek = workDate.getDay()
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const weekEnding = new Date(workDate)
    weekEnding.setDate(workDate.getDate() + daysToSunday)
    const weekKey = weekEnding.toISOString().split('T')[0]
    
    const existing = weeklyData.get(weekKey) || {
      weekEnding: weekKey,
      totalHours: 0,
      totalLaborCost: 0,
      directLaborCost: 0,
      indirectLaborCost: 0,
      staffLaborCost: 0,
      directPerDiem: 0,
      indirectPerDiem: 0,
      totalPerDiem: 0,
      totalCost: 0
    }
    
    const amount = perDiem.amount || 0
    existing.totalPerDiem += amount
    
    if (perDiem.employee_type === 'Direct') {
      existing.directPerDiem += amount
    } else if (perDiem.employee_type === 'Indirect') {
      existing.indirectPerDiem += amount
    }
    
    weeklyData.set(weekKey, existing)
  })
  
  // Calculate total costs for each week
  weeklyData.forEach(week => {
    week.totalCost = week.totalLaborCost + week.totalPerDiem
  })
  
  // Convert to array and sort
  return Array.from(weeklyData.values()).sort((a, b) => 
    a.weekEnding.localeCompare(b.weekEnding)
  )
}