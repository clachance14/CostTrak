import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface LaborKPIs {
  totalActualCost: number
  totalForecastedCost: number
  totalBudgetedCost: number
  varianceDollars: number
  variancePercent: number
  totalActualHours: number
  totalForecastedHours: number
  averageActualRate: number
  averageForecastRate: number
  laborBurnPercent: number
  projectCompletionPercent: number
}

interface CraftBreakdown {
  craftCode: string
  craftName: string
  category: string
  actualHours: number
  forecastedHours: number
  actualCost: number
  forecastedCost: number
  varianceDollars: number
  variancePercent: number
}

interface WeeklyTrend {
  weekEnding: string
  actualCost: number
  forecastedCost: number
  actualHours: number
  forecastedHours: number
  compositeRate: number
  directCost: number
  indirectCost: number
  staffCost: number
  overtimeHours: number
  isForecast?: boolean
}

interface EmployeeDetail {
  employeeId: string
  employeeNumber: string
  employeeName: string
  craftCode: string
  craftName: string
  category: string
  stHours: number
  otHours: number
  totalHours: number
  actualCost: number
  rate: number
}

interface PeriodBreakdown {
  weekEnding: string
  employees: EmployeeDetail[]
  totalActualHours: number
  totalActualCost: number
  totalForecastedHours: number
  totalForecastedCost: number
  varianceDollars: number
  variancePercent: number
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        job_number,
        name,
        percent_complete
      `)
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      console.error('Project query error:', projectError)
      console.error('Project ID:', projectId)
      return NextResponse.json({ error: 'Project not found', projectId }, { status: 404 })
    }

    // Get labor budget from budget_line_items
    let laborBudget = 0
    try {
      const { data: budgetItems, error: budgetError } = await supabase
        .from('budget_line_items')
        .select('amount')
        .eq('project_id', projectId)
        .or('category.eq.labor,cost_type.ilike.%labor%')
      
      if (!budgetError && budgetItems) {
        laborBudget = budgetItems.reduce((sum, item) => sum + (item.amount || 0), 0)
      }
      console.log('Labor budget calculated:', laborBudget)
    } catch (error) {
      console.error('Error fetching labor budget:', error)
      // Continue with 0 budget if error
    }

    // Get labor actuals with craft type information
    let laborActuals: Array<{
      week_ending: string
      actual_hours: number | null
      actual_cost: number | null
      burden_rate: number | null
      burden_amount: number | null
      actual_cost_with_burden: number | null
      craft_type_id: string | null
      craft_types: {
        code: string
        name: string
        billing_rate: number | null
      } | null
    }> = []
    try {
      // First, check if this project has any labor data at all
      const { count: laborCount } = await adminSupabase
        .from('labor_actuals')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        
      const { count: empCount } = await adminSupabase
        .from('labor_employee_actuals')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
      
      console.log(`Project ${projectId} has ${laborCount} labor_actuals records and ${empCount} labor_employee_actuals records`)

      const { data, error: actualsError } = await adminSupabase
        .from('labor_actuals')
        .select(`
          week_ending,
          actual_hours,
          actual_cost,
          burden_rate,
          burden_amount,
          actual_cost_with_burden,
          craft_type_id,
          craft_types (
            code,
            name,
            billing_rate
          )
        `)
        .eq('project_id', projectId)
        .order('week_ending', { ascending: true })

      if (actualsError) {
        console.error('Labor actuals query error:', actualsError)
        throw actualsError
      }
      laborActuals = data || []
      console.log('Labor actuals fetched:', {
        count: laborActuals.length,
        sample: laborActuals[0],
        dates: laborActuals.map(la => la.week_ending).slice(0, 5)
      })
    } catch (error) {
      console.error('Failed to fetch labor actuals:', error)
      // Continue with empty data rather than failing completely
      laborActuals = []
    }

    // Get labor forecasts (headcount-based)
    let laborForecasts: Array<{
      week_starting: string
      headcount: number
      avg_weekly_hours: number
      craft_type_id: string
      craft_types: {
        code: string
        name: string
        billing_rate: number | null
        category: string | null
      } | null
    }> = []
    try {
      const { data, error: forecastsError } = await adminSupabase
        .from('labor_headcount_forecasts')
        .select(`
          week_starting,
          headcount,
          avg_weekly_hours,
          craft_type_id,
          craft_types (
            code,
            name,
            billing_rate,
            category
          )
        `)
        .eq('project_id', projectId)
        .order('week_starting', { ascending: true })

      if (forecastsError) {
        console.error('Labor forecasts query error:', forecastsError)
        throw forecastsError
      }
      laborForecasts = data || []
    } catch (error) {
      console.error('Failed to fetch labor forecasts:', error)
      // Continue with empty data
      laborForecasts = []
    }

    // Calculate running averages for rate calculations (labor_running_averages table was removed)
    // This is now handled on-the-fly from labor_actuals data

    // Get weekly aggregated actuals from employee actuals table FIRST (for KPI calculations)
    let weeklyActuals: Array<{
      week_ending: string
      actual_hours: number
      actual_cost: number
      direct_cost: number
      indirect_cost: number
      staff_cost: number
      overtime_hours: number
    }> = []
    const weeklyDetailedMap = new Map<string, { 
      hours: number; 
      cost: number; 
      directHours: number;
      indirectHours: number;
      staffHours: number;
      directCost: number; 
      indirectCost: number; 
      staffCost: number;
      overtimeHours: number 
    }>()
    
    try {
      // Query from labor_employee_actuals which is where the import puts data
      const { data, error } = await adminSupabase
        .from('labor_employee_actuals')
        .select(`
          week_ending, 
          total_hours, 
          total_cost, 
          total_cost_with_burden,
          ot_hours,
          employee_id,
          employees!inner (
            craft_type_id,
            category
          )
        `)
        .eq('project_id', projectId)
        .order('week_ending')

      if (!error && data) {
        
        // Aggregate by week with category breakdown
        data.forEach(record => {
          const week = record.week_ending
          if (!weeklyDetailedMap.has(week)) {
            weeklyDetailedMap.set(week, { 
              hours: 0, 
              cost: 0, 
              directHours: 0,
              indirectHours: 0,
              staffHours: 0,
              directCost: 0, 
              indirectCost: 0, 
              staffCost: 0,
              overtimeHours: 0 
            })
          }
          const totals = weeklyDetailedMap.get(week)!
          const totalCost = record.total_cost_with_burden || record.total_cost || 0
          const category = record.employees?.category?.toLowerCase() || 'direct'
          
          totals.hours += record.total_hours || 0
          totals.cost += totalCost
          totals.overtimeHours += record.ot_hours || 0
          
          // Split costs and hours by category
          if (category === 'direct') {
            totals.directHours += record.total_hours || 0
            totals.directCost += totalCost
          } else if (category === 'indirect') {
            totals.indirectHours += record.total_hours || 0
            totals.indirectCost += totalCost
          } else if (category === 'staff') {
            totals.staffHours += record.total_hours || 0
            totals.staffCost += totalCost
          }
        })

        weeklyActuals = Array.from(weeklyDetailedMap.entries()).map(([week, totals]) => ({
          week_ending: week,
          actual_hours: totals.hours,
          actual_cost: totals.cost,
          direct_cost: totals.directCost,
          indirect_cost: totals.indirectCost,
          staff_cost: totals.staffCost,
          overtime_hours: totals.overtimeHours
        }))
        
      }
    } catch (error) {
      console.error('Failed to get early weekly actuals:', error)
    }

    // Calculate KPIs from employee actuals (using burdened costs)
    const totalActualCost = weeklyActuals.reduce((sum, week) => sum + (week.actual_cost || 0), 0)
    const totalActualHours = weeklyActuals.reduce((sum, week) => sum + (week.actual_hours || 0), 0)
    const averageActualRate = totalActualHours > 0 ? totalActualCost / totalActualHours : 0
    
    console.log('KPI calculations:', {
      totalActualCost,
      totalActualHours,
      averageActualRate,
      weeklyActualsUsed: weeklyActuals.length
    })

    // Calculate category-based burdened rates from actuals
    const categoryBurdenedRates: Record<string, number> = {
      direct: 0,
      indirect: 0,
      staff: 0
    }
    
    const categoryHours: Record<string, number> = {
      direct: 0,
      indirect: 0,
      staff: 0
    }
    
    const categoryCosts: Record<string, number> = {
      direct: 0,
      indirect: 0,
      staff: 0
    }
    
    // Sum up actual hours and costs by category from weekly actuals
    const weeklyDetailedData = Array.from(weeklyDetailedMap.values())
    weeklyDetailedData.forEach(week => {
      // Direct
      categoryHours.direct += week.directHours
      categoryCosts.direct += week.directCost
      
      // Indirect
      categoryHours.indirect += week.indirectHours
      categoryCosts.indirect += week.indirectCost
      
      // Staff
      categoryHours.staff += week.staffHours
      categoryCosts.staff += week.staffCost
    })
    
    // Calculate weighted average burdened rate per category
    Object.keys(categoryBurdenedRates).forEach(cat => {
      if (categoryHours[cat] > 0) {
        categoryBurdenedRates[cat] = categoryCosts[cat] / categoryHours[cat]
      } else {
        // Fallback to overall average rate if no data for category
        categoryBurdenedRates[cat] = averageActualRate
      }
    })
    
    console.log('Category burdened rates:', {
      direct: { hours: categoryHours.direct, cost: categoryCosts.direct, rate: categoryBurdenedRates.direct },
      indirect: { hours: categoryHours.indirect, cost: categoryCosts.indirect, rate: categoryBurdenedRates.indirect },
      staff: { hours: categoryHours.staff, cost: categoryCosts.staff, rate: categoryBurdenedRates.staff }
    })

    // Calculate forecasted costs using headcount and rates
    let totalForecastedHours = 0
    let totalForecastedCost = 0

    laborForecasts?.forEach(forecast => {
      const hours = forecast.headcount * forecast.avg_weekly_hours
      const category = forecast.craft_types?.category || 'direct'
      const burdenedRate = categoryBurdenedRates[category] || averageActualRate
      const cost = hours * burdenedRate
      
      totalForecastedHours += hours
      totalForecastedCost += cost
    })

    const totalBudgetedCost = laborBudget
    const varianceDollars = totalActualCost - totalBudgetedCost
    const variancePercent = totalBudgetedCost > 0 ? (varianceDollars / totalBudgetedCost) * 100 : 0
    const averageForecastRate = totalForecastedHours > 0 ? totalForecastedCost / totalForecastedHours : 0
    const laborBurnPercent = totalBudgetedCost > 0 ? (totalActualCost / totalBudgetedCost) * 100 : 0

    const kpis: LaborKPIs = {
      totalActualCost,
      totalForecastedCost,
      totalBudgetedCost,
      varianceDollars,
      variancePercent,
      totalActualHours,
      totalForecastedHours,
      averageActualRate,
      averageForecastRate,
      laborBurnPercent,
      projectCompletionPercent: project.percent_complete || 0
    }

    // Calculate craft breakdown from employee actuals
    const craftMap = new Map<string, CraftBreakdown>()

    // Get craft breakdown from employee actuals
    try {
      const { data: empCraftData } = await adminSupabase
        .from('labor_employee_actuals')
        .select(`
          total_hours,
          total_cost,
          total_cost_with_burden,
          employee_id,
          employees!inner (
            craft_type_id
          )
        `)
        .eq('project_id', projectId)

      if (empCraftData) {
        // Get craft type details
        const craftTypeIds = [...new Set(empCraftData.map(d => d.employees?.craft_type_id).filter(Boolean))]
        const { data: craftTypes } = await adminSupabase
          .from('craft_types')
          .select('id, code, name')
          .in('id', craftTypeIds)

        const craftTypeMap = new Map(craftTypes?.map(c => [c.id, c]) || [])

        // Aggregate by craft
        empCraftData.forEach(record => {
          const craftTypeId = record.employees?.craft_type_id
          if (!craftTypeId) return

          const craftType = craftTypeMap.get(craftTypeId)
          if (!craftType) return

          const key = craftType.code
          if (!craftMap.has(key)) {
            craftMap.set(key, {
              craftCode: craftType.code,
              craftName: craftType.name,
              category: 'direct', // Default category for craft types
              actualHours: 0,
              forecastedHours: 0,
              actualCost: 0,
              forecastedCost: 0,
              varianceDollars: 0,
              variancePercent: 0
            })
          }

          const craft = craftMap.get(key)!
          craft.actualHours += record.total_hours || 0
          craft.actualCost += record.total_cost_with_burden || record.total_cost || 0
        })
      }
    } catch (error) {
      console.error('Failed to get craft breakdown:', error)
    }

    // Process forecasts
    laborForecasts?.forEach(forecast => {
      if (!forecast.craft_types) return
      
      const key = forecast.craft_types.code
      if (!craftMap.has(key)) {
        craftMap.set(key, {
          craftCode: forecast.craft_types.code,
          craftName: forecast.craft_types.name,
          category: 'direct', // Default to direct for craft types
          actualHours: 0,
          forecastedHours: 0,
          actualCost: 0,
          forecastedCost: 0,
          varianceDollars: 0,
          variancePercent: 0
        })
      }
      
      const craft = craftMap.get(key)!
      const hours = forecast.headcount * forecast.avg_weekly_hours
      const category = forecast.craft_types.category || 'direct'
      const burdenedRate = categoryBurdenedRates[category] || averageActualRate
      
      craft.forecastedHours += hours
      craft.forecastedCost += hours * burdenedRate
    })

    // Calculate variances
    const craftBreakdown = Array.from(craftMap.values()).map(craft => {
      craft.varianceDollars = craft.actualCost - craft.forecastedCost
      craft.variancePercent = craft.forecastedCost > 0 
        ? (craft.varianceDollars / craft.forecastedCost) * 100 
        : 0
      return craft
    })

    // Calculate weekly trends - use the weeklyActuals we already calculated
    const weeklyMap = new Map<string, WeeklyTrend>()

    // Process aggregated actuals
    console.log('Processing weeklyActuals:', JSON.stringify(weeklyActuals.slice(0, 2), null, 2)) // Debug log with full structure
    
    weeklyActuals.forEach(actual => {
      const week = actual.week_ending
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, {
          weekEnding: week,
          actualCost: 0,
          forecastedCost: 0,
          actualHours: 0,
          forecastedHours: 0,
          compositeRate: 0,
          directCost: 0,
          indirectCost: 0,
          staffCost: 0,
          overtimeHours: 0,
          isForecast: false
        })
      }
      
      const weekData = weeklyMap.get(week)!
      // Fix: use the correct property names from weeklyActuals
      weekData.actualCost = actual.actual_cost || 0
      weekData.actualHours = actual.actual_hours || 0
      weekData.directCost = actual.direct_cost || 0
      weekData.indirectCost = actual.indirect_cost || 0
      weekData.staffCost = actual.staff_cost || 0
      weekData.overtimeHours = actual.overtime_hours || 0
      
      console.log(`Week ${week}: actual object keys:`, Object.keys(actual), 'values:', actual) // Debug to see exact structure
    })

    // Add forecast data to weekly trends
    laborForecasts?.forEach(forecast => {
      if (!forecast.craft_types) return
      
      const week = forecast.week_starting
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, {
          weekEnding: week,
          actualCost: 0,
          forecastedCost: 0,
          actualHours: 0,
          forecastedHours: 0,
          compositeRate: 0,
          directCost: 0,
          indirectCost: 0,
          staffCost: 0,
          overtimeHours: 0,
          isForecast: true
        })
      }
      
      const weekData = weeklyMap.get(week)!
      const hours = forecast.headcount * forecast.avg_weekly_hours
      const category = forecast.craft_types.category || 'direct'
      const burdenedRate = categoryBurdenedRates[category] || averageActualRate
      const cost = hours * burdenedRate
      
      weekData.forecastedHours += hours
      weekData.forecastedCost += cost
      
      // For weeks with no actual data, also populate the category costs from forecasts
      if (weekData.actualCost === 0 && weekData.actualHours === 0) {
        // Add forecast costs to the appropriate category
        if (category === 'direct') {
          weekData.directCost += cost
        } else if (category === 'indirect') {
          weekData.indirectCost += cost
        } else if (category === 'staff') {
          weekData.staffCost += cost
        }
      }
    })

    // Calculate composite rates and validate data
    const weeklyTrends = Array.from(weeklyMap.values())
      .filter(week => {
        // Validate data - ensure no NaN or Infinity values
        return (week.actualCost >= 0 && isFinite(week.actualCost)) ||
               (week.actualHours >= 0 && isFinite(week.actualHours)) ||
               (week.forecastedCost >= 0 && isFinite(week.forecastedCost)) ||
               (week.forecastedHours >= 0 && isFinite(week.forecastedHours))
      })
      .map(week => {
        // Calculate composite rate safely
        week.compositeRate = week.actualHours > 0 && isFinite(week.actualCost)
          ? Math.round((week.actualCost / week.actualHours) * 100) / 100
          : 0
        
        // Round all values to prevent floating point issues
        week.actualCost = Math.round(week.actualCost * 100) / 100
        week.forecastedCost = Math.round(week.forecastedCost * 100) / 100
        week.actualHours = Math.round(week.actualHours * 100) / 100
        week.forecastedHours = Math.round(week.forecastedHours * 100) / 100
        
        return week
      })
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))

    // Log sample data for debugging
    console.log('Weekly trends final data:', {
      count: weeklyTrends.length,
      firstWeek: weeklyTrends[0],
      lastWeek: weeklyTrends[weeklyTrends.length - 1],
      allWeeks: weeklyTrends.slice(0, 3) // Show first 3 weeks
    })

    // Get employee-level actuals for period breakdown
    let employeeActuals: Array<{
      week_ending: string
      employee_id: string
      total_hours: number | null
      total_cost: number | null
      total_cost_with_burden: number | null
      st_hours: number | null
      ot_hours: number | null
      st_wages: number | null
      ot_wages: number | null
      employees: {
        id: string
        employee_number: string
        first_name: string
        last_name: string
        base_rate: number | null
        craft_type_id: string | null
        category: string | null
        craft_types: {
          id: string
          code: string
          name: string
        } | null
      } | null
    }> = []
    try {
      // First get the employee actuals
      const { data: actualsData, error: empError } = await adminSupabase
        .from('labor_employee_actuals')
        .select('*')
        .eq('project_id', projectId)
        .order('week_ending', { ascending: false })

      if (empError) {
        console.error('Employee actuals query error:', empError)
      } else if (actualsData && actualsData.length > 0) {
        // Get unique employee IDs
        const employeeIds = [...new Set(actualsData.map(a => a.employee_id))]
        
        // Fetch employee details with craft types
        const { data: employees, error: empDetailsError } = await adminSupabase
          .from('employees')
          .select(`
            id,
            employee_number,
            first_name,
            last_name,
            base_rate,
            craft_type_id,
            category
          `)
          .in('id', employeeIds)

        if (empDetailsError) {
          console.error('Employee details error:', empDetailsError)
        }

        // Fetch craft types
        const craftTypeIds = [...new Set(employees?.map(e => e.craft_type_id).filter(Boolean) || [])]
        const { data: craftTypes, error: craftError } = await adminSupabase
          .from('craft_types')
          .select('id, code, name')
          .in('id', craftTypeIds)

        if (craftError) {
          console.error('Craft types error:', craftError)
        }

        // Create lookup maps
        const employeeMap = new Map(employees?.map(e => [e.id, e]) || [])
        const craftTypeMap = new Map(craftTypes?.map(c => [c.id, c]) || [])

        // Combine the data
        employeeActuals = actualsData.map(record => {
          const employee = employeeMap.get(record.employee_id)
          const craftType = employee?.craft_type_id ? craftTypeMap.get(employee.craft_type_id) : null
          
          return {
            ...record,
            employees: employee ? {
              ...employee,
              craft_types: craftType
            } : null
          }
        }).filter(record => record.employees) // Filter out records without employee data
      }
    } catch (error) {
      console.error('Failed to fetch employee actuals:', error)
      employeeActuals = []
    }

    // Group employee data by week
    const employeesByWeek = new Map<string, EmployeeDetail[]>()
    
    employeeActuals?.forEach(record => {
      if (!record.employees || !record.employees.craft_types) return
      
      const employee: EmployeeDetail = {
        employeeId: record.employees.id,
        employeeNumber: record.employees.employee_number,
        employeeName: `${record.employees.first_name} ${record.employees.last_name}`,
        craftCode: record.employees.craft_types.code,
        craftName: record.employees.craft_types.name,
        category: record.employees.category || 'Direct',
        stHours: record.st_hours || 0,
        otHours: record.ot_hours || 0,
        totalHours: record.total_hours || 0,
        actualCost: record.total_cost_with_burden || record.total_cost || 0,
        rate: record.employees.base_rate || 0
      }
      
      const week = record.week_ending
      if (!employeesByWeek.has(week)) {
        employeesByWeek.set(week, [])
      }
      employeesByWeek.get(week)!.push(employee)
    })

    // Create period breakdown with employee details
    const periodBreakdown: PeriodBreakdown[] = []
    
    // Get all unique weeks
    const allWeeks = new Set<string>()
    employeesByWeek.forEach((_, week) => allWeeks.add(week))
    laborForecasts?.forEach(f => allWeeks.add(f.week_starting))
    
    // Build period breakdown for each week
    Array.from(allWeeks).forEach(week => {
      const employees = employeesByWeek.get(week) || []
      
      // Calculate actual totals
      const totalActualHours = employees.reduce((sum, emp) => sum + emp.totalHours, 0)
      const totalActualCost = employees.reduce((sum, emp) => sum + emp.actualCost, 0)
      
      // Calculate forecast totals for this week
      let totalForecastedHours = 0
      let totalForecastedCost = 0
      
      laborForecasts?.forEach(forecast => {
        if (forecast.week_starting === week && forecast.craft_types) {
          const hours = forecast.headcount * forecast.avg_weekly_hours
          const rate = forecast.craft_types.billing_rate || 85
          totalForecastedHours += hours
          totalForecastedCost += hours * rate
        }
      })
      
      const varianceDollars = totalActualCost - totalForecastedCost
      const variancePercent = totalForecastedCost > 0 
        ? (varianceDollars / totalForecastedCost) * 100 
        : 0
      
      periodBreakdown.push({
        weekEnding: week,
        employees,
        totalActualHours,
        totalActualCost,
        totalForecastedHours,
        totalForecastedCost,
        varianceDollars,
        variancePercent
      })
    })
    
    // Sort by week descending and limit to last 8 weeks
    periodBreakdown.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding))
    const recentPeriods = periodBreakdown.slice(0, 8)

    // Get the most recent week with actual data (not forecast)
    const currentWeek = weeklyActuals.length > 0 ? weeklyActuals[weeklyActuals.length - 1].week_ending : null
    
    // Calculate FTE for the most recent week (using 50 hours per week standard)
    const STANDARD_HOURS_PER_WEEK = 50
    const currentWeekStats = {
      totalFTE: 0,
      directFTE: 0,
      indirectFTE: 0,
      staffFTE: 0,
      totalHours: 0,
      directHours: 0,
      indirectHours: 0,
      staffHours: 0,
      categoryRates: categoryBurdenedRates
    }
    
    // Find the most recent week with actual data
    if (weeklyDetailedData.length > 0) {
      const latestWeekData = weeklyDetailedData[weeklyDetailedData.length - 1]
      
      // Use actual hours by category from our tracking
      currentWeekStats.directHours = latestWeekData.directHours
      currentWeekStats.indirectHours = latestWeekData.indirectHours
      currentWeekStats.staffHours = latestWeekData.staffHours
      currentWeekStats.totalHours = latestWeekData.hours
      
      // Calculate FTE
      currentWeekStats.totalFTE = currentWeekStats.totalHours / STANDARD_HOURS_PER_WEEK
      currentWeekStats.directFTE = currentWeekStats.directHours / STANDARD_HOURS_PER_WEEK
      currentWeekStats.indirectFTE = currentWeekStats.indirectHours / STANDARD_HOURS_PER_WEEK
      currentWeekStats.staffFTE = currentWeekStats.staffHours / STANDARD_HOURS_PER_WEEK
      
    }

    // Transform employee details for the frontend
    const allEmployeeDetails: Array<{
      weekEnding: string
      employee_id: string
      employeeNumber: string
      firstName: string
      lastName: string
      craft: string
      craftCode: string
      category: string
      st_hours: number
      ot_hours: number
      st_wages: number
      ot_wages: number
      hourlyRate: number
      totalCostWithBurden: number
    }> = []
    employeeActuals.forEach(record => {
      if (!record.employees || !record.employees.craft_types) return
      
      allEmployeeDetails.push({
        weekEnding: record.week_ending,
        employee_id: record.employee_id,
        employeeNumber: record.employees.employee_number,
        firstName: record.employees.first_name,
        lastName: record.employees.last_name,
        craft: record.employees.craft_types.name,
        craftCode: record.employees.craft_types.code,
        category: record.employees.category || 'Direct',
        st_hours: record.st_hours || 0,
        ot_hours: record.ot_hours || 0,
        st_wages: record.st_wages || 0,
        ot_wages: record.ot_wages || 0,
        hourlyRate: record.employees.base_rate || 0,
        totalCostWithBurden: record.total_cost_with_burden || record.total_cost || 0
      })
    })

    // Transform weekly data for the new UI
    const weeklyData = weeklyTrends.map(week => ({
      weekEnding: week.weekEnding,
      directCost: week.directCost || 0,
      indirectCost: week.indirectCost || 0,
      staffCost: week.staffCost || 0,
      actualCost: week.actualCost || 0,
      actualHours: week.actualHours || 0,
      overtimeHours: week.overtimeHours || 0,
      variance: week.variance || 0,
      isForecast: week.isForecast || false
    }))

    // Validate response data
    const response = {
      project: {
        id: projectId,
        job_number: project.job_number,
        name: project.name
      },
      currentWeek,
      currentWeekStats,
      kpis: {
        totalActualCost: isFinite(kpis.totalActualCost) ? kpis.totalActualCost : 0,
        totalForecastedCost: isFinite(kpis.totalForecastedCost) ? kpis.totalForecastedCost : 0,
        totalBudgetedCost: isFinite(kpis.totalBudgetedCost) ? kpis.totalBudgetedCost : 0,
        varianceDollars: isFinite(kpis.varianceDollars) ? kpis.varianceDollars : 0,
        variancePercent: isFinite(kpis.variancePercent) ? kpis.variancePercent : 0,
        totalActualHours: isFinite(kpis.totalActualHours) ? kpis.totalActualHours : 0,
        totalForecastedHours: isFinite(kpis.totalForecastedHours) ? kpis.totalForecastedHours : 0,
        averageActualRate: isFinite(kpis.averageActualRate) ? kpis.averageActualRate : 0,
        averageForecastRate: isFinite(kpis.averageForecastRate) ? kpis.averageForecastRate : 0,
        laborBurnPercent: isFinite(kpis.laborBurnPercent) ? kpis.laborBurnPercent : 0,
        projectCompletionPercent: isFinite(kpis.projectCompletionPercent) ? kpis.projectCompletionPercent : 0
      },
      craftBreakdown: craftBreakdown.filter(c => 
        isFinite(c.actualCost) && isFinite(c.actualHours) && 
        isFinite(c.forecastedCost) && isFinite(c.forecastedHours)
      ),
      weeklyTrends: weeklyTrends.filter(w => 
        isFinite(w.actualCost) && isFinite(w.actualHours) && 
        isFinite(w.forecastedCost) && isFinite(w.forecastedHours) &&
        isFinite(w.compositeRate)
      ),
      weeklyData,
      employeeDetails: allEmployeeDetails,
      periodBreakdown: recentPeriods,
      lastUpdated: new Date().toISOString()
    }


    return NextResponse.json(response)

  } catch (error) {
    console.error('Labor analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labor analytics' },
      { status: 500 }
    )
  }
}