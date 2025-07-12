import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/running-averages - Get running average rates
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
    const weeksBack = parseInt(request.nextUrl.searchParams.get('weeks_back') || '8', 10)

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

    // Get running averages from the view
    const { data: runningAverages, error } = await supabase
      .from('labor_running_averages')
      .select('*')
      .eq('project_id', projectId)
      .order('labor_category')
      .order('craft_name')

    if (error) throw error

    // Also get historical data for trend analysis
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeksBack * 7)

    const { data: historicalData } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        craft_type_id,
        rate_per_hour,
        total_hours,
        total_cost
      `)
      .eq('project_id', projectId)
      .gte('week_ending', startDate.toISOString())
      .gt('total_hours', 0)
      .order('week_ending', { ascending: true })

    // Group historical data by craft type
    const trendsMap = new Map<string, any[]>()
    historicalData?.forEach(row => {
      if (!trendsMap.has(row.craft_type_id)) {
        trendsMap.set(row.craft_type_id, [])
      }
      trendsMap.get(row.craft_type_id)?.push({
        weekEnding: row.week_ending,
        rate: row.rate_per_hour,
        hours: row.total_hours,
        cost: row.total_cost
      })
    })

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      averages: runningAverages?.map(avg => ({
        craftTypeId: avg.craft_type_id,
        craftName: avg.craft_name,
        laborCategory: avg.labor_category,
        avgRate: avg.avg_rate,
        weeksOfData: avg.weeks_of_data,
        lastActualWeek: avg.last_actual_week,
        trends: trendsMap.get(avg.craft_type_id) || []
      })) || [],
      summary: {
        totalCraftTypes: runningAverages?.length || 0,
        craftTypesWithData: runningAverages?.filter(a => a.weeks_of_data > 0).length || 0,
        avgWeeksOfData: runningAverages?.length 
          ? Math.round(runningAverages.reduce((sum, a) => sum + a.weeks_of_data, 0) / runningAverages.length)
          : 0
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Running averages fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch running averages' },
      { status: 500 }
    )
  }
}