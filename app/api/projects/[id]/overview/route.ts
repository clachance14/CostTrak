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

    // Get change orders
    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'approved')

    const changeOrdersTotal = changeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0
    const changeOrdersCount = changeOrders?.length || 0

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

    // Calculate total actual labor cost (using burdened costs)
    const totalLaborCost = laborActuals?.reduce((sum, la) => {
      return sum + (la.total_cost_with_burden || (la.st_wages || 0) + (la.ot_wages || 0) + ((la.st_wages || 0) * 0.28))
    }, 0) || 0
    
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

    // Get budget data
    const { data: budgetLineItems } = await supabase
      .from('budget_line_items')
      .select('cost_type, total_cost')
      .eq('project_id', projectId)

    const laborBudget = budgetLineItems
      ?.filter(item => ['Labor', 'Direct Labor', 'Indirect Labor'].includes(item.cost_type))
      .reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0

    const materialBudget = budgetLineItems
      ?.filter(item => item.cost_type === 'Material')
      .reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0

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
    const totalCommitted = totalPOAmount + totalLaborCost
    const commitmentPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
    const remainingBudget = revisedContract - totalCommitted

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
    
    // Get labor forecasts (headcount-based) - fetch all to check against actuals
    const { data: laborForecasts } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        week_starting,
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
      // Convert week_ending (Saturday) to week_starting (Sunday) for comparison
      const weekEnding = new Date(w.week_ending)
      const weekStarting = new Date(weekEnding)
      weekStarting.setDate(weekStarting.getDate() - 6) // Go back 6 days to get Sunday
      return weekStarting.toISOString().split('T')[0]
    }) || [])
    
    // Calculate remaining forecasted labor cost - only for weeks without actuals
    let remainingForecastedLabor = 0
    laborForecasts?.forEach(forecast => {
      const weekStartingDate = forecast.week_starting.split('T')[0]
      
      // Only include forecast if no actuals exist for this week
      if (!weeksWithActuals.has(weekStartingDate)) {
        const hours = forecast.headcount * forecast.avg_weekly_hours
        const category = forecast.craft_types?.category || 'direct'
        const burdenedRate = categoryBurdenedRates[category] || averageActualRate || 50 // fallback rate
        remainingForecastedLabor += hours * burdenedRate
      }
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

    // Category breakdown
    const categoryBreakdown = purchaseOrders?.reduce((acc, po) => {
      const category = po.cost_code?.category || po.budget_category || 'Uncategorized'
      if (!acc[category]) acc[category] = 0
      acc[category] += po.total_amount || 0
      return acc
    }, {} as Record<string, number>) || {}

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
        
        // Add formatted label for display
        let label = '$0'
        if (value >= 1000000) {
          label = `$${Math.round(value / 1000000)}M`
        } else if (value >= 1000) {
          label = `$${Math.round(value / 1000)}K`
        } else {
          label = `$${value}`
        }
        
        return { name: displayName, value, label }
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
        revisedContract,
        totalCommitted,
        commitmentPercentage,
        laborCosts: totalLaborCost,
        laborBudget,
        laborForecastedTotal: totalForecastedLabor,
        laborRemainingForecast: remainingForecastedLabor,
        materialCosts: totalPOAmount,
        materialInvoiced: totalInvoicedAmount,
        materialBudget,
        remainingBudget,
        burnRate,
        projectHealth
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