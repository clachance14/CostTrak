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
        percent_complete,
        project_budgets (
          labor_budget
        )
      `)
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get labor actuals with craft type information
    let laborActuals: any[] = []
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
            category,
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
    let laborForecasts: any[] = []
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
            category,
            billing_rate
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

    // Get running averages for rate calculations
    const { data: runningAverages, error: avgError } = await adminSupabase
      .from('labor_running_averages')
      .select(`
        craft_type_id,
        avg_rate,
        avg_hours,
        avg_cost
      `)
      .eq('project_id', projectId)

    if (avgError) throw avgError

    // Get weekly aggregated actuals from employee actuals table FIRST (for KPI calculations)
    let weeklyActuals: any[] = []
    try {
      // Query from labor_employee_actuals which is where the import puts data
      const { data, error } = await adminSupabase
        .from('labor_employee_actuals')
        .select('week_ending, total_hours, total_cost, total_cost_with_burden')
        .eq('project_id', projectId)
        .order('week_ending')

      console.log('Early weekly employee data query for KPIs:', {
        error,
        dataCount: data?.length || 0
      })

      if (!error && data) {
        // Aggregate by week
        const weekMap = new Map<string, { hours: number; cost: number }>()
        data.forEach(record => {
          const week = record.week_ending
          if (!weekMap.has(week)) {
            weekMap.set(week, { hours: 0, cost: 0 })
          }
          const totals = weekMap.get(week)!
          totals.hours += record.total_hours || 0
          totals.cost += record.total_cost_with_burden || record.total_cost || 0
        })

        weeklyActuals = Array.from(weekMap.entries()).map(([week, totals]) => ({
          week_ending: week,
          actual_hours: totals.hours,
          actual_cost: totals.cost
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

    // Calculate forecasted costs using headcount and rates
    let totalForecastedHours = 0
    let totalForecastedCost = 0

    laborForecasts?.forEach(forecast => {
      const hours = forecast.headcount * forecast.avg_weekly_hours
      const rate = forecast.craft_types?.billing_rate || 85 // Use billing rate or default
      const cost = hours * rate
      
      totalForecastedHours += hours
      totalForecastedCost += cost
    })

    const totalBudgetedCost = project.project_budgets?.labor_budget || 0
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
          .select('id, code, name, category')
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
              category: craftType.category,
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
          category: forecast.craft_types.category,
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
      const rate = forecast.craft_types.billing_rate || 85
      
      craft.forecastedHours += hours
      craft.forecastedCost += hours * rate
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
          compositeRate: 0
        })
      }
      
      const weekData = weeklyMap.get(week)!
      // Fix: use the correct property names from weeklyActuals
      weekData.actualCost = actual.actual_cost_with_burden || actual.actual_cost || 0
      weekData.actualHours = actual.actual_hours || 0
      
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
          compositeRate: 0
        })
      }
      
      const weekData = weeklyMap.get(week)!
      const hours = forecast.headcount * forecast.avg_weekly_hours
      const rate = forecast.craft_types.billing_rate || 85
      
      weekData.forecastedHours += hours
      weekData.forecastedCost += hours * rate
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
    let employeeActuals: any[] = []
    try {
      // First get the employee actuals
      const { data: actualsData, error: empError } = await adminSupabase
        .from('labor_employee_actuals')
        .select('*')
        .eq('project_id', projectId)
        .order('week_ending', { ascending: false })
        .limit(100) // Last ~10 weeks of data

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
            craft_type_id
          `)
          .in('id', employeeIds)

        if (empDetailsError) {
          console.error('Employee details error:', empDetailsError)
        }

        // Fetch craft types
        const craftTypeIds = [...new Set(employees?.map(e => e.craft_type_id).filter(Boolean) || [])]
        const { data: craftTypes, error: craftError } = await adminSupabase
          .from('craft_types')
          .select('id, code, name, category')
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
        category: record.employees.craft_types.category,
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

    // Validate response data
    const response = {
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
      periodBreakdown: recentPeriods,
      lastUpdated: new Date().toISOString()
    }

    // Debug logging
    console.log('Labor Analytics API Response:', {
      projectId,
      weeklyTrendsCount: response.weeklyTrends.length,
      sampleWeeklyTrend: response.weeklyTrends[0],
      craftBreakdownCount: response.craftBreakdown.length,
      periodBreakdownCount: response.periodBreakdown.length,
      kpisValid: Object.values(response.kpis).every(v => isFinite(v))
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Labor analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labor analytics' },
      { status: 500 }
    )
  }
}