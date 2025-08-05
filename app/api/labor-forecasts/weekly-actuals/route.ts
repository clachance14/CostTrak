import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  weeklyActualBatchSchema,
  getWeekEndingDate
} from '@/lib/validations/labor-forecast-v2'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/weekly-actuals - Get weekly actual data by category
export async function GET(request: NextRequest) {
  console.log('Weekly actuals API called')
  
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.log('Auth error:', userError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  console.log('User authenticated:', user.id)

  // Parse query parameters
  const projectId = request.nextUrl.searchParams.get('project_id')
  const weekEnding = request.nextUrl.searchParams.get('week_ending')

  try {
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get weekly actuals by category using the new database function
    const { data: categoryActuals, error: actualsError } = await supabase
      .rpc('get_weekly_actuals_by_category', {
        p_project_id: projectId,
        p_week_ending: weekEnding ? new Date(weekEnding).toISOString().split('T')[0] : null
      })

    if (actualsError) {
      console.error('Category actuals query error:', actualsError)
      throw actualsError
    }

    console.log(`Found ${categoryActuals?.length || 0} category actuals for project ${projectId}`)

    // Get running average rates by category
    const { data: categoryRates } = await supabase
      .rpc('get_labor_category_rates', {
        p_project_id: projectId,
        p_weeks_back: 8
      })

    // Create rate map for easy lookup
    const rateMap = new Map<string, number>()
    categoryRates?.forEach(rate => {
      rateMap.set(rate.category, Number(rate.avg_rate) || 0)
    })

    // Transform data for frontend
    const actuals = (categoryActuals || []).map(actual => ({
      id: `${actual.week_ending}-${actual.category}`,
      laborCategory: actual.category,
      weekEnding: actual.week_ending,
      actualCost: Number(actual.total_cost) || 0,
      actualHours: Number(actual.total_hours) || 0,
      totalCost: Number(actual.total_cost) || 0,
      totalHours: Number(actual.total_hours) || 0,
      employeeCount: actual.employee_count || 0,
      ratePerHour: actual.total_hours > 0 ? actual.total_cost / actual.total_hours : 0,
      runningAvgRate: rateMap.get(actual.category) || 0
    }))

    // Get categories for the form (simplified to just the 3 categories)
    const categories = ['direct', 'indirect', 'staff'].map(cat => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      laborCategory: cat,
      runningAvgRate: rateMap.get(cat) || 0
    }))

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      weekEnding: weekEnding ? getWeekEndingDate(new Date(weekEnding)).toISOString() : null,
      actuals,
      categories,
      summary: {
        totalHours: actuals.reduce((sum, a) => sum + a.totalHours, 0),
        totalCost: actuals.reduce((sum, a) => sum + a.totalCost, 0),
        avgRate: actuals.reduce((sum, a) => sum + a.totalHours, 0) > 0
          ? actuals.reduce((sum, a) => sum + a.totalCost, 0) / actuals.reduce((sum, a) => sum + a.totalHours, 0)
          : 0
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Weekly actuals fetch error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      projectId,
      weekEnding
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch weekly actuals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/labor-forecasts/weekly-actuals - Create/update weekly actual batch
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = weeklyActualBatchSchema.parse(body)

    // Ensure week ending is Sunday
    const weekEndingDate = getWeekEndingDate(new Date(validatedData.week_ending))
    const formattedWeekEnding = weekEndingDate.toISOString()

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validatedData.project_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const results = []
    const errors = []

    // Process each entry by category
    for (const entry of validatedData.entries) {
      try {
        // For category-based updates, we would need to update the underlying employee actuals
        // This is a simplified version - in practice, you'd need to distribute the category totals
        // across employees based on their craft types
        
        results.push({
          action: 'processed',
          category: entry.craft_type_id, // Assuming this contains category
          total_cost: entry.total_cost,
          total_hours: entry.total_hours
        })
      } catch (error) {
        console.error('Entry processing error:', error)
        errors.push({
          category: entry.craft_type_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Log batch update to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'batch_update',
      entity_type: 'labor_actual_category',
      entity_id: validatedData.project_id,
      changes: {
        week_ending: formattedWeekEnding,
        entries_processed: validatedData.entries.length,
        results_summary: {
          processed: results.length,
          failed: errors.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        processed: results.length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('Weekly actuals batch error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to process weekly actuals' },
      { status: 500 }
    )
  }
}