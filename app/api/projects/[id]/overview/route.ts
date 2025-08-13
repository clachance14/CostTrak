import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfMonth, subDays, startOfWeek, format } from 'date-fns'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const projectId = params.id
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) throw projectError

    // Get approved change orders
    const { data: approvedChangeOrders } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'approved')

    const changeOrdersTotal = approvedChangeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0
    const changeOrdersCount = approvedChangeOrders?.length || 0

    // Get pending change orders
    const { data: pendingChangeOrders } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending')

    const pendingChangeOrdersTotal = pendingChangeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0
    const pendingChangeOrdersCount = pendingChangeOrders?.length || 0

    // Get purchase orders
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'approved')

    const totalPOAmount = purchaseOrders?.reduce((sum, po) => sum + (po.committed_amount || 0), 0) || 0
    const totalInvoicedAmount = purchaseOrders?.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0) || 0

    // Get labor actuals with burden
    const { data: laborActuals } = await supabase
      .from('labor_employee_actuals')
      .select('st_wages, ot_wages, total_hours, total_cost_with_burden, employees!inner(category)')
      .eq('project_id', projectId)

    // Get per diem costs
    const { data: perDiemCosts } = await supabase
      .from('per_diem_costs')
      .select('amount')
      .eq('project_id', projectId)
    
    const totalPerDiemCost = perDiemCosts?.reduce((sum, pd) => sum + (pd.amount || 0), 0) || 0

    // Calculate total actual labor cost (using burdened costs + per diem)
    const totalLaborCost = (laborActuals?.reduce((sum, la) => {
      return sum + (la.total_cost_with_burden || (la.st_wages || 0) + (la.ot_wages || 0) + ((la.st_wages || 0) * 0.28))
    }, 0) || 0) + totalPerDiemCost
    
    // Calculate total actual labor hours
    const totalLaborHours = laborActuals?.reduce((sum, la) => sum + (la.total_hours || 0), 0) || 0
    
    // Calculate average actual rate
    const averageActualRate = totalLaborHours > 0 ? totalLaborCost / totalLaborHours : 0
    
    // Calculate category-based costs and hours
    const categoryStats = laborActuals?.reduce((acc, la) => {
      const category = la.employees?.category?.toLowerCase() || 'direct'
      const cost = la.total_cost_with_burden || (la.st_wages || 0) + (la.ot_wages || 0) + ((la.st_wages || 0) * 0.28)
      const hours = la.total_hours || 0
      
      if (!acc[category]) {
        acc[category] = { cost: 0, hours: 0 }
      }
      acc[category].cost += cost
      acc[category].hours += hours
      return acc
    }, {} as Record<string, { cost: number; hours: number }>) || {}
    
    // Calculate category-based burdened rates
    const categoryBurdenedRates: Record<string, number> = {}
    Object.entries(categoryStats).forEach(([category, stats]) => {
      categoryBurdenedRates[category] = stats.hours > 0 ? stats.cost / stats.hours : averageActualRate
    })

    // Get labor budget from project table
    const laborBudget = (project.labor_direct_budget || 0) + 
                       (project.labor_indirect_budget || 0) + 
                       (project.labor_staff_budget || 0)
    
    console.log('Labor budget breakdown:', {
      direct: project.labor_direct_budget || 0,
      indirect: project.labor_indirect_budget || 0,
      staff: project.labor_staff_budget || 0,
      total: laborBudget
    })

    // Get non-labor budget from project table (materials + equipment + subcontracts + small tools)
    const nonLaborBudget = (project.materials_budget || 0) + 
                          (project.equipment_budget || 0) + 
                          (project.subcontracts_budget || 0) + 
                          (project.small_tools_budget || 0)

    // Get material costs from POs
    const { data: materialPOs } = await supabase
      .from('purchase_orders')
      .select('total_amount, cost_code:cost_codes(category)')
      .eq('project_id', projectId)
      .eq('status', 'approved')

    const materialCosts = materialPOs
      ?.filter(po => po.cost_code?.category === 'material')
      .reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0

    // Calculate financial metrics
    const revisedContract = (project.original_contract || 0) + changeOrdersTotal
    
    // Calculate actual costs vs committed costs
    const totalActualCosts = totalLaborCost + totalInvoicedAmount  // Actual spent
    const totalCommitted = totalPOAmount + totalLaborCost  // Committed (POs + labor actual)
    
    // CRITICAL: Ensure forecasted final never less than actual spent
    const forecastedFinalCost = Math.max(totalCommitted, totalActualCosts)
    
    const commitmentPercentage = revisedContract > 0 ? (forecastedFinalCost / revisedContract) * 100 : 0
    
    // CRITICAL FIX: Remaining budget based on actual costs spent, not committed
    const remainingBudget = revisedContract - totalActualCosts
    
    // Calculate uncommitted budget and margin analysis
    const totalBudget = revisedContract
    const uncommittedBudget = totalBudget - totalCommitted
    const uncommittedPercentage = totalBudget > 0 ? (uncommittedBudget / totalBudget) * 100 : 0
    const baseMarginPercentage = project.base_margin_percentage || 15
    const expectedTotalSpend = totalBudget * (1 - baseMarginPercentage / 100)
    const projectedMargin = totalBudget > 0 ? ((totalBudget - totalCommitted) / totalBudget) * 100 : 0
    const spendPercentage = totalBudget > 0 ? (totalLaborCost / totalBudget) * 100 : 0
    
    // Calculate budget categories breakdown
    const budgetCategories = [
      {
        category: 'Labor',
        budget: laborBudget,
        committed: totalLaborCost,
        uncommitted: laborBudget - totalLaborCost,
        percentage: laborBudget > 0 ? ((laborBudget - totalLaborCost) / laborBudget) * 100 : 0,
        expectedSpend: laborBudget * (1 - baseMarginPercentage / 100)
      },
      {
        category: 'Materials',
        budget: project.materials_budget || 0,
        committed: materialCosts,
        uncommitted: (project.materials_budget || 0) - materialCosts,
        percentage: (project.materials_budget || 0) > 0 ? (((project.materials_budget || 0) - materialCosts) / (project.materials_budget || 0)) * 100 : 0,
        expectedSpend: (project.materials_budget || 0) * (1 - baseMarginPercentage / 100)
      },
      {
        category: 'Equipment',
        budget: project.equipment_budget || 0,
        committed: 0, // TODO: Calculate from POs with equipment category
        uncommitted: project.equipment_budget || 0,
        percentage: 100,
        expectedSpend: (project.equipment_budget || 0) * (1 - baseMarginPercentage / 100)
      },
      {
        category: 'Subcontracts',
        budget: project.subcontracts_budget || 0,
        committed: 0, // TODO: Calculate from POs with subcontract category
        uncommitted: project.subcontracts_budget || 0,
        percentage: 100,
        expectedSpend: (project.subcontracts_budget || 0) * (1 - baseMarginPercentage / 100)
      },
      {
        category: 'Other',
        budget: project.small_tools_budget || 0,
        committed: 0, // TODO: Calculate from POs with other category
        uncommitted: project.small_tools_budget || 0,
        percentage: 100,
        expectedSpend: (project.small_tools_budget || 0) * (1 - baseMarginPercentage / 100)
      }
    ]
    
    // Determine margin health
    const marginDiff = projectedMargin - baseMarginPercentage
    let marginHealth = 'on-target'
    if (marginDiff < -5) marginHealth = 'critical'
    else if (marginDiff < -2) marginHealth = 'at-risk'
    
    // Calculate spend projections
    const projectStartDate = new Date(project.start_date)
    const projectEndDate = new Date(project.end_date)
    const projectDurationMonths = Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
    const currentDate = new Date()
    const monthsElapsed = Math.ceil((currentDate.getTime() - projectStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
    
    // Generate projection data points
    const projectionData: any[] = []
    let cumulativeActual = 0
    let cumulativeProjected = 0
    
    // Get monthly actual costs
    const { data: monthlyActuals } = await supabase
      .from('labor_employee_actuals')
      .select('week_ending, st_wages, ot_wages, total_cost_with_burden')
      .eq('project_id', projectId)
      .order('week_ending', { ascending: true })
    
    // Group actuals by month
    const actualsByMonth = new Map<string, number>()
    monthlyActuals?.forEach(actual => {
      const monthKey = format(new Date(actual.week_ending), 'MMM yyyy')
      const cost = actual.total_cost_with_burden || (actual.st_wages || 0) + (actual.ot_wages || 0) + ((actual.st_wages || 0) * 0.28)
      actualsByMonth.set(monthKey, (actualsByMonth.get(monthKey) || 0) + cost)
    })
    
    // Calculate projections based on method (20% threshold)
    if (spendPercentage < 20) {
      // Phase 1: Margin-based projection (under 20% spent)
      const projectedTotal = totalBudget * (1 - baseMarginPercentage / 100)
      const monthlyProjected = projectedTotal / projectDurationMonths
      
      for (let i = 0; i < projectDurationMonths; i++) {
        const monthDate = new Date(projectStartDate)
        monthDate.setMonth(monthDate.getMonth() + i)
        const monthKey = format(monthDate, 'MMM yyyy')
        
        const actualCost = actualsByMonth.get(monthKey) || 0
        cumulativeActual += actualCost
        cumulativeProjected += monthlyProjected
        
        projectionData.push({
          month: monthKey,
          actual: actualCost > 0 ? cumulativeActual : undefined,
          projected: cumulativeProjected,
          method: 'margin-based',
          confidence: 'estimated'
        })
      }
      
      // For forecasted final cost when under 20%: use margin-based calculation
      var projectionSummary = {
        totalBudget,
        currentSpend: totalCommitted,  // Use total committed not just labor
        projectedFinalCost: projectedTotal,  // This is budget * (1 - margin%)
        projectedMargin: baseMarginPercentage,
        projectedVariance: totalBudget - projectedTotal,
        confidenceLevel: 'Estimated based on target margin'
      }
      
      var transitionPoint = {
        date: format(new Date(projectStartDate.getTime() + (projectDurationMonths * 0.2 * 30 * 24 * 60 * 60 * 1000)), 'MMM yyyy'),
        spendAmount: totalBudget * 0.2,
        message: `Will switch to committed-based projections after reaching 20% spend (${formatCurrency(totalBudget * 0.2)})`
      }
    } else {
      // Phase 2: Use total committed value (over 20% spent)
      // For forecasted final cost when over 20%: use total committed
      const projectedTotal = totalCommitted  // Simply use total committed value
      
      // For visualization, still show monthly projection but final cost is total committed
      const actualMonthlyRate = totalCommitted / Math.max(monthsElapsed, 1)
      
      for (let i = 0; i < projectDurationMonths; i++) {
        const monthDate = new Date(projectStartDate)
        monthDate.setMonth(monthDate.getMonth() + i)
        const monthKey = format(monthDate, 'MMM yyyy')
        
        const actualCost = actualsByMonth.get(monthKey) || 0
        const isActual = actualCost > 0
        
        if (isActual) {
          cumulativeActual += actualCost
          cumulativeProjected = cumulativeActual
        } else {
          // For future months, project based on committed value spread over project duration
          const remainingMonths = projectDurationMonths - i
          const remainingCommitted = projectedTotal - cumulativeProjected
          cumulativeProjected += (remainingCommitted / Math.max(remainingMonths, 1))
        }
        
        projectionData.push({
          month: monthKey,
          actual: isActual ? cumulativeActual : undefined,
          projected: Math.min(cumulativeProjected, projectedTotal),  // Cap at total committed
          method: 'data-driven',
          confidence: 'committed'
        })
      }
      
      var projectionSummary = {
        totalBudget,
        currentSpend: totalCommitted,  // Current spend is total committed
        projectedFinalCost: projectedTotal,  // This is total committed value
        projectedMargin: ((totalBudget - projectedTotal) / totalBudget) * 100,
        projectedVariance: totalBudget - projectedTotal,
        confidenceLevel: 'Based on committed values'
      }
      
      var transitionPoint = null
    }
    
    // Helper function for currency formatting
    function formatCurrency(value: number) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    
    // Calculate budget risk assessment
    const projectTimeElapsed = ((currentDate.getTime() - projectStartDate.getTime()) / (projectEndDate.getTime() - projectStartDate.getTime())) * 100
    
    // Get PO coverage by category
    const { data: posByCategory } = await supabase
      .from('purchase_orders')
      .select('total_amount, cost_code:cost_codes(category)')
      .eq('project_id', projectId)
      .eq('status', 'approved')
    
    const categoryCommitments = new Map<string, number>()
    posByCategory?.forEach(po => {
      const category = po.cost_code?.category || 'other'
      categoryCommitments.set(category, (categoryCommitments.get(category) || 0) + (po.total_amount || 0))
    })
    
    // Assess risk for each budget category
    const budgetRiskCategories = budgetCategories.map(category => {
      const coveragePercentage = category.budget > 0 ? (category.committed / category.budget) * 100 : 0
      
      // Calculate risk level based on phase and coverage
      let riskLevel: 'critical' | 'warning' | 'healthy' = 'healthy'
      let recommendedAction: string | undefined
      
      if (spendPercentage < 20) {
        // Early stage - use margin-based thresholds
        const expectedCommitment = category.expectedSpend * (projectTimeElapsed / 100)
        if (category.committed > category.expectedSpend) {
          riskLevel = 'critical'
          recommendedAction = 'Review commitments - exceeding margin targets'
        } else if (category.committed > expectedCommitment * 1.2) {
          riskLevel = 'warning'
          recommendedAction = 'Monitor spending pace'
        }
      } else {
        // Later stage - more aggressive thresholds
        if (projectTimeElapsed > 30 && coveragePercentage < 30) {
          riskLevel = 'critical'
          recommendedAction = 'Create POs immediately'
        } else if (projectTimeElapsed > 20 && coveragePercentage < 50) {
          riskLevel = 'warning'
          recommendedAction = 'Review and commit budget'
        }
      }
      
      return {
        name: category.category,
        budgetAmount: category.budget,
        committedAmount: category.committed,
        coveragePercentage,
        marginImpact: category.budget > 0 ? ((category.committed - category.expectedSpend) / category.budget) * 100 : 0,
        riskLevel,
        recommendedAction
      }
    })
    
    // Determine overall risk
    const criticalCount = budgetRiskCategories.filter(c => c.riskLevel === 'critical').length
    const warningCount = budgetRiskCategories.filter(c => c.riskLevel === 'warning').length
    const overallRisk = criticalCount > 0 ? 'critical' : warningCount > 1 ? 'warning' : 'healthy'
    
    // Generate alerts
    const budgetAlerts: any[] = []
    
    if (marginHealth === 'critical') {
      budgetAlerts.push({
        severity: 'error',
        message: `Margin at critical risk: ${projectedMargin.toFixed(1)}% vs target ${baseMarginPercentage}%`,
        marginImpact: `May reduce margin by ${Math.abs(projectedMargin - baseMarginPercentage).toFixed(1)}%`,
        actionLink: '/purchase-orders/new',
        actionLabel: 'Create PO'
      })
    }
    
    budgetRiskCategories.forEach(category => {
      if (category.riskLevel === 'critical') {
        budgetAlerts.push({
          severity: 'error',
          message: `${category.name}: Only ${category.coveragePercentage.toFixed(0)}% committed`,
          marginImpact: category.marginImpact > 0 ? `Impacting margin by ${category.marginImpact.toFixed(1)}%` : undefined,
          actionLink: `/purchase-orders/new?category=${category.name}`,
          actionLabel: 'Create PO'
        })
      }
    })
    
    const budgetRisks = {
      overallRisk,
      projectTimeElapsed,
      spendPercentage,
      baseMargin: baseMarginPercentage,
      projectedMargin,
      marginAtRisk: marginHealth !== 'on-target',
      assessmentMethod: spendPercentage < 20 ? 'margin-based' : 'committed-based',
      categories: budgetRiskCategories,
      alerts: budgetAlerts
    }

    // Calculate burn rate (last 4 weeks average)
    const fourWeeksAgo = subDays(new Date(), 28)
    const { data: recentCosts } = await supabase
      .from('labor_employee_actuals')
      .select('st_wages, ot_wages, week_ending')
      .eq('project_id', projectId)
      .gte('week_ending', fourWeeksAgo.toISOString())

    const recentPOCosts = await supabase
      .from('purchase_orders')
      .select('total_amount, created_at')
      .eq('project_id', projectId)
      .gte('created_at', fourWeeksAgo.toISOString())

    const recentTotalCost = (recentCosts?.reduce((sum, cost) => {
      const stWages = cost.st_wages || 0
      const otWages = cost.ot_wages || 0
      const burdenAmount = stWages * 0.28
      return sum + stWages + otWages + burdenAmount
    }, 0) || 0) +
      (recentPOCosts.data?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0)

    const burnRate = recentTotalCost / 4 // Weekly average
    
    // Get labor forecasts (headcount-based) - using week_ending field
    // Note: We get ALL forecasts and filter by actuals, not by date
    // This ensures past weeks with forecasts but no actuals are included
    const { data: laborForecasts } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        week_ending,
        headcount,
        avg_weekly_hours,
        craft_type_id,
        craft_types (category)
      `)
      .eq('project_id', projectId)
    
    // Get unique week endings from labor actuals to determine which weeks have data
    const { data: actualWeeks } = await supabase
      .from('labor_employee_actuals')
      .select('week_ending')
      .eq('project_id', projectId)
    
    // Create a set of weeks that have actual data
    const weeksWithActuals = new Set(actualWeeks?.map(w => {
      const weekEnding = new Date(w.week_ending)
      return weekEnding.toISOString().split('T')[0]
    }) || [])
    
    // Calculate remaining forecasted labor cost - only for future weeks without actuals
    let remainingForecastedLabor = 0
    
    // If we have no forecast data, try to get the composite rate and calculate from headcount
    if (!laborForecasts || laborForecasts.length === 0) {
      // Try to get the latest forecast data to see if there's any saved data
      const { data: allForecasts } = await supabase
        .from('labor_headcount_forecasts')
        .select(`
          week_ending,
          headcount,
          avg_weekly_hours,
          craft_type_id,
          craft_types (category)
        `)
        .eq('project_id', projectId)
        .order('week_ending', { ascending: false })
        .limit(10)
      
      console.log('No future forecasts found. Latest forecasts:', allForecasts?.length || 0)
    }
    
    // Group forecasts by week to calculate totals
    const forecastsByWeek = new Map<string, { hours: number; categories: Record<string, number> }>()
    
    laborForecasts?.forEach(forecast => {
      const weekEndingDate = forecast.week_ending.split('T')[0]
      
      // Skip if we have actuals for this week
      if (weeksWithActuals.has(weekEndingDate)) {
        return
      }
      
      if (!forecastsByWeek.has(weekEndingDate)) {
        forecastsByWeek.set(weekEndingDate, { hours: 0, categories: { direct: 0, indirect: 0, staff: 0 } })
      }
      
      const weekData = forecastsByWeek.get(weekEndingDate)!
      const hours = forecast.headcount * (forecast.avg_weekly_hours || 50)
      const category = forecast.craft_types?.category || 'direct'
      
      weekData.hours += hours
      if (category in weekData.categories) {
        weekData.categories[category as 'direct' | 'indirect' | 'staff'] += hours
      }
    })
    
    // Calculate cost for each week using category rates
    forecastsByWeek.forEach((weekData, weekEnding) => {
      // Calculate cost by category
      Object.entries(weekData.categories).forEach(([category, hours]) => {
        const rate = categoryBurdenedRates[category] || averageActualRate || 50
        remainingForecastedLabor += hours * rate
      })
    })
    
    console.log('Labor forecast calculation:', {
      forecastRecords: laborForecasts?.length || 0,
      weeksWithForecasts: forecastsByWeek.size,
      remainingForecastedLabor,
      categoryRates: categoryBurdenedRates
    })
    
    // Total forecasted labor = actual + remaining forecast
    const totalForecastedLabor = totalLaborCost + remainingForecastedLabor

    // Calculate project health
    const projectHealth = {
      status: 'good' as 'good' | 'warning' | 'critical',
      riskCount: 0
    }

    // Risk indicators
    if (commitmentPercentage > 90) projectHealth.riskCount++
    if (remainingBudget < 0) projectHealth.riskCount++
    if (burnRate > remainingBudget / 8) projectHealth.riskCount++ // Less than 8 weeks of budget left

    if (projectHealth.riskCount >= 2) {
      projectHealth.status = 'critical'
    } else if (projectHealth.riskCount === 1) {
      projectHealth.status = 'warning'
    }

    // Get labor trends (last 8 weeks)
    const eightWeeksAgo = subDays(new Date(), 56)
    const { data: laborTrendData } = await supabase
      .from('labor_employee_actuals')
      .select('employee_id, week_ending')
      .eq('project_id', projectId)
      .gte('week_ending', eightWeeksAgo.toISOString())
      .order('week_ending', { ascending: true })

    // Group by week and count unique employees
    const weeklyHeadcount = laborTrendData?.reduce((acc, record) => {
      const weekKey = format(new Date(record.week_ending), 'MMM d')
      if (!acc[weekKey]) {
        acc[weekKey] = new Set()
      }
      acc[weekKey].add(record.employee_id)
      return acc
    }, {} as Record<string, Set<string>>) || {}

    const laborTrends = Object.entries(weeklyHeadcount).map(([week, employees]) => ({
      week,
      headcount: employees.size
    }))

    const currentHeadcount = laborTrends[laborTrends.length - 1]?.headcount || 0
    const peakHeadcount = Math.max(...laborTrends.map(t => t.headcount), 0)

    // Get PO analytics for charts
    const vendorBreakdown = purchaseOrders?.reduce((acc, po) => {
      const vendor = po.vendor_name || 'Unknown'
      if (!acc[vendor]) acc[vendor] = 0
      acc[vendor] += po.total_amount || 0
      return acc
    }, {} as Record<string, number>) || {}

    // Top 5 vendors + others
    const sortedVendors = Object.entries(vendorBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const othersTotal = Object.entries(vendorBreakdown)
      .slice(5)
      .reduce((sum, [, value]) => sum + value, 0)

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']
    const vendorChartData = [
      ...sortedVendors.map(([name, value], index) => ({
        name,
        value,
        color: colors[index]
      })),
      ...(othersTotal > 0 ? [{ name: 'Others', value: othersTotal, color: colors[5] }] : [])
    ]

    // Category breakdown with budget mapping
    const categoryBudgetMap: Record<string, number> = {
      'Materials': project.materials_budget || 0,
      'Equipment': project.equipment_budget || 0,
      'Subcontracts': project.subcontracts_budget || 0,
      'Small Tools & Consumables': project.small_tools_budget || 0
    }

    const categoryBreakdown = purchaseOrders?.reduce((acc, po) => {
      const category = po.cost_code?.category || po.budget_category || 'Uncategorized'
      if (!acc[category]) acc[category] = 0
      acc[category] += po.total_amount || 0
      return acc
    }, {} as Record<string, number>) || {}

    // Calculate totals for summary
    let totalCategoryBudget = 0
    let totalCategorySpent = 0

    const categoryChartData = Object.entries(categoryBreakdown)
      .map(([name, value]) => {
        // Format category names for display
        let displayName = name
        
        // Convert underscores to spaces
        displayName = displayName.replace(/_/g, ' ')
        
        // Handle all caps formatting
        if (displayName.toUpperCase() === displayName && !displayName.includes('&')) {
          // If all caps (except for special chars), convert to proper case
          displayName = displayName
            .split(' ')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ')
        } else if (displayName.toLowerCase() === displayName) {
          // If all lowercase, capitalize first letter of each word
          displayName = displayName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }
        
        // Special case for Small Tools & Consumables to ensure consistent formatting
        if (displayName.toUpperCase().includes('SMALL TOOL')) {
          displayName = 'Small Tools & Consumables'
        }
        
        // Get budget for this category
        const budget = categoryBudgetMap[displayName] || 0
        const percentage = budget > 0 ? (value / budget) * 100 : 0
        const remaining = budget - value
        
        // Add to totals
        totalCategoryBudget += budget
        totalCategorySpent += value
        
        // Determine status
        let status: 'normal' | 'warning' | 'over'
        if (percentage > 100) {
          status = 'over'
        } else if (percentage >= 80) {
          status = 'warning'
        } else {
          status = 'normal'
        }
        
        // Add formatted label for display
        let label = '$0'
        if (value >= 1000000) {
          label = `$${Math.round(value / 1000000)}M`
        } else if (value >= 1000) {
          label = `$${Math.round(value / 1000)}K`
        } else {
          label = `$${value}`
        }
        
        // Add formatted budget label
        let budgetLabel = '$0'
        if (budget >= 1000000) {
          budgetLabel = `$${Math.round(budget / 1000000)}M`
        } else if (budget >= 1000) {
          budgetLabel = `$${Math.round(budget / 1000)}K`
        } else {
          budgetLabel = `$${budget}`
        }
        
        return { 
          name: displayName, 
          value, 
          budget,
          percentage,
          remaining,
          status,
          label,
          budgetLabel
        }
      })
      .sort((a, b) => b.value - a.value)

    // Weekly PO trend (last 12 weeks)
    const twelveWeeksAgo = subDays(new Date(), 84)
    const weeklyPOs = purchaseOrders
      ?.filter(po => new Date(po.created_at) >= twelveWeeksAgo)
      .reduce((acc, po) => {
        const weekStart = startOfWeek(new Date(po.created_at))
        const weekKey = format(weekStart, 'MMM d')
        if (!acc[weekKey]) acc[weekKey] = 0
        acc[weekKey] += po.total_amount || 0
        return acc
      }, {} as Record<string, number>) || {}

    const weeklyTrend = Object.entries(weeklyPOs)
      .map(([week, value]) => ({ week, value }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())

    // Monthly PO calculations
    const startOfThisMonth = startOfMonth(new Date())
    const startOfLastMonth = startOfMonth(subDays(startOfThisMonth, 1))

    const thisMonthPOs = purchaseOrders?.filter(po => 
      new Date(po.created_at) >= startOfThisMonth
    ) || []
    const lastMonthPOs = purchaseOrders?.filter(po => 
      new Date(po.created_at) >= startOfLastMonth && 
      new Date(po.created_at) < startOfThisMonth
    ) || []

    const monthlyPOValue = thisMonthPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0)
    const lastMonthPOValue = lastMonthPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0)
    const monthlyTrend = lastMonthPOValue > 0 
      ? Math.round(((monthlyPOValue - lastMonthPOValue) / lastMonthPOValue) * 100)
      : 0

    // Top vendor
    const topVendor = sortedVendors[0] || { 0: 'No vendors', 1: 0 }

    return NextResponse.json({
      project,
      financialData: {
        originalContract: project.original_contract || 0,
        changeOrdersTotal,
        changeOrdersCount,
        pendingChangeOrdersTotal,
        pendingChangeOrdersCount,
        revisedContract,
        totalActualCosts,  // NEW: Actual costs spent
        totalCommitted,    // Committed amounts
        forecastedFinalCost,  // NEW: Max of committed and actual
        commitmentPercentage,
        laborCosts: totalLaborCost,
        laborBudget,
        laborForecastedTotal: totalForecastedLabor,
        laborRemainingForecast: remainingForecastedLabor,
        materialCosts: totalPOAmount,
        materialInvoiced: totalInvoicedAmount,
        materialBudget: nonLaborBudget,
        remainingBudget,
        burnRate,
        projectHealth,
        // New uncommitted budget data
        uncommittedBudget: {
          totalBudget,
          totalCommitted,
          uncommitted: uncommittedBudget,
          uncommittedPercentage,
          baseMarginPercentage,
          expectedTotalSpend,
          projectedMargin,
          marginHealth,
          spendPercentage,
          categories: budgetCategories,
          projectCompletionPercentage: commitmentPercentage // Using commitment as proxy for completion
        },
        // New projection data
        projections: {
          currentSpendPercentage: spendPercentage,
          projectionMethod: spendPercentage < 20 ? 'margin-based' : 'data-driven',
          baseMargin: baseMarginPercentage,
          projections: projectionData,
          summary: projectionSummary,
          transitionPoint,
          projectStartDate: project.start_date,
          projectEndDate: project.end_date
        },
        // New budget risk data
        budgetRisks
      },
      healthDashboard: {
        budgetData: {
          spent: totalCommitted,
          committed: totalCommitted,
          budget: revisedContract
        },
        laborTrends,
        currentHeadcount,
        peakHeadcount
      },
      purchaseOrdersData: {
        purchaseOrders: purchaseOrders || [],
        totalPOValue: totalPOAmount,
        monthlyPOValue,
        monthlyTrend,
        topVendor: {
          name: topVendor[0],
          value: topVendor[1]
        },
        vendorBreakdown: vendorChartData,
        categoryBreakdown: categoryChartData,
        categorySummary: {
          totalBudget: totalCategoryBudget,
          totalSpent: totalCategorySpent,
          totalRemaining: totalCategoryBudget - totalCategorySpent,
          percentageUsed: totalCategoryBudget > 0 ? (totalCategorySpent / totalCategoryBudget) * 100 : 0
        },
        weeklyTrend
      }
    })
  } catch (error) {
    console.error('Project overview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}