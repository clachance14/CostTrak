import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Use the database function to calculate forecast
    const { data, error } = await supabase
      .rpc('calculate_labor_forecast', {
        p_project_id: project_id,
        p_start_date: start_date || new Date().toISOString(),
        p_weeks_ahead: weeks_ahead
      })

    if (error) throw error

    // Group by week for easier consumption
    const weeklyData = new Map<string, any>()
    
    data?.forEach((row: any) => {
      const weekKey = row.week_ending
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekEnding: weekKey,
          entries: [],
          totals: {
            headcount: 0,
            totalHours: 0,
            forecastedCost: 0
          }
        })
      }
      
      const week = weeklyData.get(weekKey)
      week.entries.push({
        craftTypeId: row.craft_type_id,
        craftName: row.craft_name,
        laborCategory: row.labor_category,
        headcount: row.headcount,
        totalHours: row.total_hours,
        avgRate: row.avg_rate,
        forecastedCost: row.forecasted_cost
      })
      
      week.totals.headcount += row.headcount
      week.totals.totalHours += parseFloat(row.total_hours)
      week.totals.forecastedCost += parseFloat(row.forecasted_cost)
    })

    // Convert to array and sort by week
    const weeks = Array.from(weeklyData.values()).sort((a, b) => 
      new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
    )

    // Calculate grand totals
    const grandTotals = weeks.reduce((totals, week) => ({
      headcount: totals.headcount + week.totals.headcount,
      totalHours: totals.totalHours + week.totals.totalHours,
      forecastedCost: totals.forecastedCost + week.totals.forecastedCost
    }), { headcount: 0, totalHours: 0, forecastedCost: 0 })

    // Get labor categories summary
    const categorySummary = new Map<string, any>()
    data?.forEach((row: any) => {
      const category = row.labor_category
      if (!categorySummary.has(category)) {
        categorySummary.set(category, {
          category,
          totalHours: 0,
          totalCost: 0,
          avgRate: 0,
          craftCount: 0
        })
      }
      
      const cat = categorySummary.get(category)
      cat.totalHours += parseFloat(row.total_hours)
      cat.totalCost += parseFloat(row.forecasted_cost)
      cat.avgRate += parseFloat(row.avg_rate)
      cat.craftCount += 1
    })

    // Calculate average rates
    categorySummary.forEach(cat => {
      if (cat.craftCount > 0) {
        cat.avgRate = cat.avgRate / cat.craftCount
      }
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