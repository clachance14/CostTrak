import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/running-averages - Get running average rates by category
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Single query to check project and get category rates
    const { data: categoryRates, error: ratesError } = await supabase
      .rpc('get_labor_category_rates', {
        p_project_id: projectId,
        p_weeks_back: weeksBack
      })

    if (ratesError) {
      // If error is about project not found, return 404
      if (ratesError.message?.includes('project')) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      throw ratesError
    }

    // Get project info for response
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Transform data for frontend compatibility
    const averages = (categoryRates || []).map(rate => ({
      laborCategory: rate.category,
      avgRate: Number(rate.avg_rate) || 0,
      totalHours: Number(rate.total_hours) || 0,
      totalCost: Number(rate.total_cost) || 0,
      weeksOfData: rate.week_count || 0
    }))

    // Calculate summary
    const summary = {
      totalCategories: averages.length,
      categoriesWithData: averages.filter(a => a.weeksOfData > 0).length,
      avgWeeksOfData: averages.length 
        ? Math.round(averages.reduce((sum, a) => sum + a.weeksOfData, 0) / averages.length)
        : 0,
      totalHours: averages.reduce((sum, a) => sum + a.totalHours, 0),
      totalCost: averages.reduce((sum, a) => sum + a.totalCost, 0),
      overallAvgRate: averages.reduce((sum, a) => sum + a.totalHours, 0) > 0
        ? averages.reduce((sum, a) => sum + a.totalCost, 0) / averages.reduce((sum, a) => sum + a.totalHours, 0)
        : 0
    }

    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      averages,
      summary,
      parameters: {
        weeksBack,
        dateRange: {
          start: new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Running averages fetch error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch running averages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}