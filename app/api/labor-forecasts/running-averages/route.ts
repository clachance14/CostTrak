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

    // Try to get running averages from the table first
    let { data: runningAverages, error } = await supabase
      .from('labor_running_averages')
      .select(`
        *,
        craft_type:craft_types(
          id,
          name,
          code,
          category
        )
      `)
      .eq('project_id', projectId)

    // If no data or error, calculate from labor_actuals
    if (error || !runningAverages || runningAverages.length === 0) {
      console.log('No running averages found, calculating from actuals...')
      
      // Get all craft types
      const { data: craftTypes } = await supabase
        .from('craft_types')
        .select('*')
        .eq('is_active', true)
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - weeksBack * 7)
      
      // Get labor actuals for the period
      const { data: laborActuals } = await supabase
        .from('labor_actuals')
        .select('*')
        .eq('project_id', projectId)
        .gte('week_ending', startDate.toISOString())
        .lte('week_ending', endDate.toISOString())
        .gt('actual_hours', 0)
      
      // Calculate running averages from actuals
      runningAverages = craftTypes?.map(craft => {
        const craftActuals = laborActuals?.filter(a => a.craft_type_id === craft.id) || []
        const totalHours = craftActuals.reduce((sum, a) => sum + (a.actual_hours || 0), 0)
        const totalCost = craftActuals.reduce((sum, a) => sum + (a.actual_cost || 0), 0)
        const avgRate = totalHours > 0 ? totalCost / totalHours : 0
        
        return {
          craft_type_id: craft.id,
          craft_type: craft,
          avg_rate: avgRate,
          total_hours: totalHours,
          total_cost: totalCost,
          week_count: craftActuals.length,
          last_updated: craftActuals.length > 0 
            ? craftActuals.sort((a, b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime())[0].week_ending
            : null
        }
      }) || []
    }

    // Also get historical data for trend analysis
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeksBack * 7)

    const { data: historicalData } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        craft_type_id,
        actual_hours,
        actual_cost
      `)
      .eq('project_id', projectId)
      .gte('week_ending', startDate.toISOString())
      .gt('actual_hours', 0)
      .order('week_ending', { ascending: true })

    // Group historical data by craft type
    interface TrendData {
      weekEnding: string
      rate: number
      hours: number
      cost: number
    }
    const trendsMap = new Map<string, TrendData[]>()
    historicalData?.forEach(row => {
      if (!trendsMap.has(row.craft_type_id)) {
        trendsMap.set(row.craft_type_id, [])
      }
      trendsMap.get(row.craft_type_id)?.push({
        weekEnding: row.week_ending,
        rate: row.actual_hours > 0 ? row.actual_cost / row.actual_hours : 0,
        hours: row.actual_hours,
        cost: row.actual_cost
      })
    })

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      averages: (runningAverages || []).map(avg => ({
        craftTypeId: avg.craft_type_id,
        craftName: avg.craft_type?.name || 'Unknown',
        laborCategory: avg.craft_type?.category || 'direct',
        avgRate: avg.avg_rate || (avg.total_hours > 0 ? avg.total_cost / avg.total_hours : 0),
        weeksOfData: avg.week_count || 0,
        lastActualWeek: avg.last_updated,
        trends: trendsMap.get(avg.craft_type_id) || []
      })) || [],
      summary: {
        totalCraftTypes: runningAverages?.length || 0,
        craftTypesWithData: runningAverages?.filter(a => a.week_count > 0).length || 0,
        avgWeeksOfData: runningAverages?.length 
          ? Math.round(runningAverages.reduce((sum, a) => sum + (a.week_count || 0), 0) / runningAverages.length)
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