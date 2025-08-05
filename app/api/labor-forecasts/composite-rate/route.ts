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

  // Parse request parameters
  const projectId = request.nextUrl.searchParams.get('project_id')
  const weeksBack = parseInt(request.nextUrl.searchParams.get('weeks_back') || '12', 10)
  const includeCategories = request.nextUrl.searchParams.get('categories')?.split(',') || ['direct', 'indirect', 'staff']

  try {
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Get composite rate using the new database function
    const { data: compositeData, error: compositeError } = await supabase
      .rpc('get_composite_labor_rate', {
        p_project_id: projectId,
        p_weeks_back: weeksBack,
        p_categories: includeCategories
      })
      .single()

    if (compositeError) {
      if (compositeError.message?.includes('project')) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      throw compositeError
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

    // Calculate recent trend (last 4 weeks)
    const { data: recentData, error: recentError } = await supabase
      .rpc('get_composite_labor_rate', {
        p_project_id: projectId,
        p_weeks_back: 4,
        p_categories: includeCategories
      })
      .single()

    if (recentError) {
      console.error('Recent rate calculation error:', recentError)
    }

    // Transform category breakdown for response
    const categoryRates = Object.entries(compositeData?.category_breakdown || {}).map(([category, data]: [string, any]) => ({
      category,
      rate: Number(data.rate) || 0,
      hours: Number(data.hours) || 0,
      cost: Number(data.cost) || 0
    }))

    // Calculate weekly trend (simplified - just show current data)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeksBack * 7)

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      compositeRate: {
        overall: Number(compositeData?.overall_rate) || 0,
        recent: Number(recentData?.overall_rate) || 0,
        totalHours: Number(compositeData?.total_hours) || 0,
        totalCost: Number(compositeData?.total_cost) || 0,
        weeksOfData: weeksBack,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      categoryRates,
      parameters: {
        weeksBack,
        categories: includeCategories
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Composite rate calculation error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      projectId,
      weeksBack,
      includeCategories
    })
    return NextResponse.json(
      { 
        error: 'Failed to calculate composite rate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}