import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeekEndingDate } from '@/lib/validations/labor-forecast-v2'
import { addWeeks } from 'date-fns'

export const dynamic = 'force-dynamic'

// POST /api/labor-forecasts/calculate - Calculate forecast from headcount
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { project_id, start_date, weeks_ahead = 12 } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Get the start date (default to next Sunday if not provided)
    const startDate = start_date ? new Date(start_date) : new Date()
    const firstWeekEnding = getWeekEndingDate(startDate)

    // Get running averages for the project
    const { data: runningAverages, error: avgError } = await supabase
      .from('labor_running_averages')
      .select('*')
      .eq('project_id', project_id)

    if (avgError) throw avgError

    // Get headcount forecasts for the project
    const { data: headcountForecasts, error: hcError } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        *,
        craft_types (
          id,
          name,
          code,
          category
        )
      `)
      .eq('project_id', project_id)
      .gte('week_ending', firstWeekEnding.toISOString())
      .lte('week_ending', addWeeks(firstWeekEnding, weeks_ahead - 1).toISOString())
      .order('week_ending')
      .order('craft_type_id')

    if (hcError) throw hcError

    // Create a map of craft type running averages
    const avgRateMap = new Map<string, number>(
      runningAverages?.map(ra => [ra.craft_type_id, Number(ra.avg_rate)]) || []
    )

    // Standard work week hours (40 hours per person)
    const HOURS_PER_PERSON_PER_WEEK = 40

    // Process the headcount data to calculate forecasted hours and costs
    const processedData = headcountForecasts?.map(hc => {
      const avgRate = avgRateMap.get(hc.craft_type_id) || 0
      const totalHours = hc.headcount * HOURS_PER_PERSON_PER_WEEK
      const totalCost = totalHours * avgRate

      return {
        week_ending: hc.week_ending,
        craft_type_id: hc.craft_type_id,
        craft_name: hc.craft_types?.name || '',
        craft_code: hc.craft_types?.code || '',
        labor_category: hc.craft_types?.category || '',
        headcount: hc.headcount,
        hours_per_person: HOURS_PER_PERSON_PER_WEEK,
        avg_rate: avgRate,
        total_hours: totalHours,
        total_cost: totalCost
      }
    }) || []

    // Group by week for easier consumption
    interface WeekData {
      weekEnding: string
      entries: Array<{
        craftTypeId: string
        craftName: string
        craftCode: string
        laborCategory: string
        headcount: number
        hours: number
        cost: number
      }>
      totals: {
        headcount: number
        totalHours: number
        totalCost: number
        byCategory?: Record<string, { headcount: number; hours: number; cost: number }>
      }
    }
    const weeklyData = new Map<string, WeekData>()
    
    processedData.forEach((row) => {
      const weekKey = row.week_ending
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekEnding: weekKey,
          entries: [],
          totals: {
            headcount: 0,
            totalHours: 0,
            totalCost: 0
          }
        })
      }
      
      const week = weeklyData.get(weekKey)
      if (!week) return
      
      week.entries.push({
        craftTypeId: row.craft_type_id,
        craftName: row.craft_name,
        craftCode: row.craft_code,
        laborCategory: row.labor_category,
        headcount: row.headcount,
        hours: row.total_hours,
        cost: row.total_cost
      })
      
      week.totals.headcount += row.headcount
      week.totals.totalHours += row.total_hours
      week.totals.totalCost += row.total_cost
    })

    // Convert to array and sort by week
    const weeks = Array.from(weeklyData.values()).sort((a, b) => 
      new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
    )

    // Calculate grand totals
    const grandTotals = weeks.reduce((totals, week) => ({
      headcount: totals.headcount + week.totals.headcount,
      totalHours: totals.totalHours + week.totals.totalHours,
      totalCost: totals.totalCost + week.totals.totalCost
    }), { headcount: 0, totalHours: 0, totalCost: 0 })

    // Get labor categories summary
    const categorySummary = new Map<string, {
      craftCount: number
      totalHeadcount: number
      totalHours: number
      totalCost: number
    }>()
    
    processedData.forEach((row) => {
      const category = row.labor_category
      if (!categorySummary.has(category)) {
        categorySummary.set(category, {
          craftCount: 0,
          totalHeadcount: 0,
          totalHours: 0,
          totalCost: 0
        })
      }
      
      const cat = categorySummary.get(category)
      if (!cat) return
      
      cat.totalHours += row.total_hours
      cat.totalCost += row.total_cost
      cat.craftCount += 1
    })

    return NextResponse.json({
      projectId: project_id,
      startDate: start_date || new Date().toISOString(),
      weeksAhead: weeks_ahead,
      weeks,
      grandTotals,
      categorySummary: Array.from(categorySummary.values()),
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Labor forecast calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate labor forecast' },
      { status: 500 }
    )
  }
}