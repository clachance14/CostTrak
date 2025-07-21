import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { divisionBusinessRules } from '@/lib/division-business-rules'

// GET /api/projects/[id]/divisions/analytics - Get division performance analytics
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const divisionId = searchParams.get('division_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get project divisions
    const { data: divisions, error: divisionsError } = await supabase
      .from('project_divisions')
      .select(`
        division_id,
        division:divisions (
          id,
          name,
          code
        )
      `)
      .eq('project_id', id)

    if (divisionsError) throw divisionsError

    // Filter by specific division if requested
    const targetDivisions = divisionId 
      ? divisions?.filter(d => d.division_id === divisionId) || []
      : divisions || []

    // Collect analytics for each division
    const analytics = []
    
    for (const div of targetDivisions) {
      // Get performance metrics
      const metrics = await divisionBusinessRules.getDivisionPerformanceMetrics(id, div.division_id)
      
      if (!metrics) continue

      // Get historical cost trend
      let costTrendQuery = supabase
        .from('purchase_orders')
        .select('created_at, total_amount')
        .eq('project_id', id)
        .eq('division_id', div.division_id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (startDate) {
        costTrendQuery = costTrendQuery.gte('created_at', startDate)
      }
      if (endDate) {
        costTrendQuery = costTrendQuery.lte('created_at', endDate)
      }

      const { data: costTrend } = await costTrendQuery

      // Get labor trend
      let laborTrendQuery = supabase
        .from('labor_actuals')
        .select('week_ending, actual_cost, actual_hours')
        .eq('project_id', id)
        .eq('division_id', div.division_id)
        .order('week_ending', { ascending: true })

      if (startDate) {
        laborTrendQuery = laborTrendQuery.gte('week_ending', startDate)
      }
      if (endDate) {
        laborTrendQuery = laborTrendQuery.lte('week_ending', endDate)
      }

      const { data: laborTrend } = await laborTrendQuery

      // Get change order impact
      const { data: changeOrders } = await supabase
        .from('change_orders')
        .select('created_at, amount')
        .eq('project_id', id)
        .eq('division_id', div.division_id)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })

      // Calculate cumulative values
      let cumulativeCost = 0
      const cumulativeCostTrend = costTrend?.map(item => {
        cumulativeCost += item.total_amount
        return {
          date: item.created_at,
          value: cumulativeCost
        }
      }) || []

      let cumulativeLabor = 0
      const cumulativeLaborTrend = laborTrend?.map(item => {
        cumulativeLabor += item.actual_cost
        return {
          date: item.week_ending,
          cost: cumulativeLabor,
          hours: item.actual_hours
        }
      }) || []

      // Calculate burn rate (cost per week)
      const burnRate = calculateBurnRate(cumulativeCostTrend, cumulativeLaborTrend)

      // Get forecast accuracy trend
      const { data: forecasts } = await supabase
        .from('division_forecasts')
        .select('forecast_date, forecasted_cost, actual_cost_at_forecast')
        .eq('project_id', id)
        .eq('division_id', div.division_id)
        .order('forecast_date', { ascending: false })
        .limit(10)

      analytics.push({
        division_id: div.division_id,
        division_name: div.division?.name,
        division_code: div.division?.code,
        performance_metrics: metrics,
        trends: {
          cost_trend: cumulativeCostTrend,
          labor_trend: cumulativeLaborTrend,
          change_orders: changeOrders || [],
          burn_rate: burnRate
        },
        forecast_accuracy: calculateForecastAccuracy(forecasts || []),
        health_score: calculateHealthScore(metrics)
      })
    }

    // Calculate cross-division insights
    const insights = generateCrossDivisionInsights(analytics)

    return NextResponse.json({ 
      analytics,
      insights,
      generated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Get division analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions
function calculateBurnRate(costTrend: any[], laborTrend: any[]) {
  if (costTrend.length < 2 && laborTrend.length < 2) return null

  // Combine and sort all cost data points
  const allCosts = [
    ...costTrend.map(c => ({ date: c.date, cost: c.value })),
    ...laborTrend.map(l => ({ date: l.date, cost: l.cost }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (allCosts.length < 2) return null

  // Calculate weekly burn rate
  const firstDate = new Date(allCosts[0].date)
  const lastDate = new Date(allCosts[allCosts.length - 1].date)
  const weeksDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
  
  if (weeksDiff < 1) return null

  const totalBurn = allCosts[allCosts.length - 1].cost - allCosts[0].cost
  const weeklyBurnRate = totalBurn / weeksDiff

  return {
    weekly_rate: weeklyBurnRate,
    total_burn: totalBurn,
    weeks_analyzed: Math.round(weeksDiff),
    trend: weeklyBurnRate > 0 ? 'increasing' : 'stable'
  }
}

function calculateForecastAccuracy(forecasts: any[]) {
  if (forecasts.length === 0) return null

  const accuracies = forecasts
    .filter(f => f.actual_cost_at_forecast > 0)
    .map(f => {
      const variance = Math.abs(f.forecasted_cost - f.actual_cost_at_forecast)
      const accuracy = 100 - (variance / f.actual_cost_at_forecast * 100)
      return {
        date: f.forecast_date,
        accuracy: Math.max(0, Math.min(100, accuracy))
      }
    })

  if (accuracies.length === 0) return null

  const avgAccuracy = accuracies.reduce((sum, a) => sum + a.accuracy, 0) / accuracies.length

  return {
    average_accuracy: avgAccuracy,
    trend: accuracies,
    rating: avgAccuracy >= 90 ? 'excellent' : 
            avgAccuracy >= 80 ? 'good' :
            avgAccuracy >= 70 ? 'fair' : 'needs_improvement'
  }
}

function calculateHealthScore(metrics: any) {
  if (!metrics) return null

  let score = 100
  let factors = []

  // Budget utilization factor
  if (metrics.budget_utilization > 90) {
    score -= 20
    factors.push({ factor: 'high_budget_utilization', impact: -20 })
  } else if (metrics.budget_utilization > 80) {
    score -= 10
    factors.push({ factor: 'moderate_budget_utilization', impact: -10 })
  }

  // Cost performance factor
  if (metrics.cost_performance_index < 0.9) {
    score -= 15
    factors.push({ factor: 'poor_cost_performance', impact: -15 })
  } else if (metrics.cost_performance_index < 1.0) {
    score -= 5
    factors.push({ factor: 'below_target_cost_performance', impact: -5 })
  }

  // Budget variance factor
  if (metrics.budget_variance < 0) {
    const variancePercent = Math.abs(metrics.budget_variance / metrics.total_budget * 100)
    if (variancePercent > 10) {
      score -= 20
      factors.push({ factor: 'significant_budget_overrun', impact: -20 })
    } else if (variancePercent > 5) {
      score -= 10
      factors.push({ factor: 'moderate_budget_overrun', impact: -10 })
    }
  }

  // Forecast accuracy factor
  if (metrics.forecast_accuracy && metrics.forecast_accuracy < 80) {
    score -= 10
    factors.push({ factor: 'poor_forecast_accuracy', impact: -10 })
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    rating: score >= 90 ? 'excellent' :
            score >= 75 ? 'good' :
            score >= 60 ? 'fair' : 'needs_attention',
    factors
  }
}

function generateCrossDivisionInsights(analytics: any[]) {
  if (analytics.length === 0) return []

  const insights = []

  // Find divisions with budget concerns
  const budgetConcerns = analytics.filter(a => 
    a.performance_metrics?.budget_utilization > 85
  )
  
  if (budgetConcerns.length > 0) {
    insights.push({
      type: 'budget_risk',
      severity: 'high',
      message: `${budgetConcerns.length} division(s) approaching budget limits`,
      affected_divisions: budgetConcerns.map(d => d.division_name)
    })
  }

  // Find divisions with poor health scores
  const poorHealth = analytics.filter(a => 
    a.health_score?.score < 70
  )

  if (poorHealth.length > 0) {
    insights.push({
      type: 'performance_concern',
      severity: 'medium',
      message: `${poorHealth.length} division(s) showing performance concerns`,
      affected_divisions: poorHealth.map(d => d.division_name)
    })
  }

  // Compare burn rates
  const burnRates = analytics
    .filter(a => a.trends?.burn_rate?.weekly_rate)
    .map(a => ({
      division: a.division_name,
      rate: a.trends.burn_rate.weekly_rate
    }))
    .sort((a, b) => b.rate - a.rate)

  if (burnRates.length > 1) {
    const highestBurn = burnRates[0]
    const lowestBurn = burnRates[burnRates.length - 1]
    const variance = (highestBurn.rate - lowestBurn.rate) / lowestBurn.rate * 100

    if (variance > 50) {
      insights.push({
        type: 'burn_rate_variance',
        severity: 'low',
        message: `Significant burn rate variance between divisions`,
        details: {
          highest: `${highestBurn.division}: $${Math.round(highestBurn.rate).toLocaleString()}/week`,
          lowest: `${lowestBurn.division}: $${Math.round(lowestBurn.rate).toLocaleString()}/week`
        }
      })
    }
  }

  // Overall project health
  const avgHealthScore = analytics.reduce((sum, a) => 
    sum + (a.health_score?.score || 0), 0
  ) / analytics.length

  insights.push({
    type: 'overall_health',
    severity: avgHealthScore >= 75 ? 'info' : 'medium',
    message: `Overall project health score: ${Math.round(avgHealthScore)}/100`,
    rating: avgHealthScore >= 90 ? 'excellent' :
            avgHealthScore >= 75 ? 'good' :
            avgHealthScore >= 60 ? 'fair' : 'needs_attention'
  })

  return insights
}