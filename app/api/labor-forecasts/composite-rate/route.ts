import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/composite-rate - Get composite labor rate for project
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details
  const { data: userDetails } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    const weeksBack = parseInt(request.nextUrl.searchParams.get('weeks_back') || '12', 10)
    const includeCategories = request.nextUrl.searchParams.get('categories')?.split(',') || ['direct', 'indirect', 'staff']

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name, project_manager_id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check access permissions
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (userDetails.role === 'viewer') {
      const { data: access } = await supabase
        .from('user_project_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .single()

      if (!access) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeksBack * 7)

    // Get historical actuals with craft type info
    const { data: actuals, error } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        actual_hours,
        actual_cost,
        craft_type:craft_types(
          id,
          name,
          category
        )
      `)
      .eq('project_id', projectId)
      .gte('week_ending', startDate.toISOString())
      .lte('week_ending', endDate.toISOString())
      .in('craft_type.category', includeCategories)
      .gt('actual_hours', 0)
      .order('week_ending', { ascending: true })

    if (error) throw error

    // Calculate composite rates by week
    const weeklyRates: { [key: string]: { hours: number; cost: number; rate: number } } = {}
    let totalHours = 0
    let totalCost = 0

    actuals?.forEach(actual => {
      const week = actual.week_ending
      if (!weeklyRates[week]) {
        weeklyRates[week] = { hours: 0, cost: 0, rate: 0 }
      }
      
      weeklyRates[week].hours += actual.actual_hours
      weeklyRates[week].cost += actual.actual_cost
      
      totalHours += actual.actual_hours
      totalCost += actual.actual_cost
    })

    // Calculate rates for each week
    Object.keys(weeklyRates).forEach(week => {
      const data = weeklyRates[week]
      data.rate = data.hours > 0 ? data.cost / data.hours : 0
    })

    // Calculate overall composite rate
    const overallCompositeRate = totalHours > 0 ? totalCost / totalHours : 0

    // Calculate by category
    const categoryRates: { [key: string]: { hours: number; cost: number; rate: number } } = {
      direct: { hours: 0, cost: 0, rate: 0 },
      indirect: { hours: 0, cost: 0, rate: 0 },
      staff: { hours: 0, cost: 0, rate: 0 }
    }

    actuals?.forEach(actual => {
      const category = actual.craft_type.category
      categoryRates[category].hours += actual.actual_hours
      categoryRates[category].cost += actual.actual_cost
    })

    // Calculate rates by category
    Object.keys(categoryRates).forEach(category => {
      const data = categoryRates[category]
      data.rate = data.hours > 0 ? data.cost / data.hours : 0
    })

    // Get recent trend (last 4 weeks)
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    
    let recentHours = 0
    let recentCost = 0
    
    actuals?.filter(a => new Date(a.week_ending) >= fourWeeksAgo).forEach(actual => {
      recentHours += actual.actual_hours
      recentCost += actual.actual_cost
    })
    
    const recentCompositeRate = recentHours > 0 ? recentCost / recentHours : 0

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      compositeRate: {
        overall: overallCompositeRate,
        recent: recentCompositeRate,
        totalHours,
        totalCost,
        weeksOfData: Object.keys(weeklyRates).length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      categoryRates: Object.entries(categoryRates).map(([category, data]) => ({
        category,
        rate: data.rate,
        hours: data.hours,
        cost: data.cost
      })),
      weeklyTrend: Object.entries(weeklyRates)
        .map(([week, data]) => ({
          weekEnding: week,
          rate: data.rate,
          hours: data.hours,
          cost: data.cost
        }))
        .sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Composite rate calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate composite rate' },
      { status: 500 }
    )
  }
}