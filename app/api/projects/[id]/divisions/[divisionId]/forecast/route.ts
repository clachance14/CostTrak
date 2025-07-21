import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects/[id]/divisions/[divisionId]/forecast - Get division forecast
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const forecast_date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get division forecast
    const { data: forecast, error } = await supabase
      .from('division_forecasts')
      .select(`
        *,
        division:divisions!division_forecasts_division_id_fkey(id, name, code),
        created_by_user:profiles!division_forecasts_created_by_fkey(id, first_name, last_name)
      `)
      .eq('project_id', id)
      .eq('division_id', divisionId)
      .eq('forecast_date', forecast_date)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get actual costs from division cost summary
    const { data: costSummary } = await supabase
      .from('division_cost_summary')
      .select('*')
      .eq('project_id', id)
      .eq('division_id', divisionId)
      .single()

    // Get division budget
    const { data: budget } = await supabase
      .from('division_budgets')
      .select('total_budget')
      .eq('project_id', id)
      .eq('division_id', divisionId)
      .single()

    // Calculate forecast if not exists
    if (!forecast && costSummary) {
      const calculatedForecast = {
        project_id: id,
        division_id: divisionId,
        forecast_date,
        forecasted_cost: costSummary.total_committed * 1.1, // 10% contingency
        cost_to_complete: Math.max(0, (budget?.total_budget || 0) - costSummary.total_committed),
        percent_complete: budget?.total_budget > 0 
          ? Math.min(100, (costSummary.total_committed / budget.total_budget) * 100)
          : 0,
        notes: 'Auto-calculated forecast'
      }
      
      return NextResponse.json({ 
        forecast: calculatedForecast,
        costSummary,
        budget,
        isCalculated: true
      })
    }

    return NextResponse.json({ 
      forecast,
      costSummary,
      budget,
      isCalculated: false
    })
  } catch (error) {
    console.error('Get division forecast error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/divisions/[divisionId]/forecast - Create/update division forecast
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    const canForecast = 
      userProfile?.role === 'controller' ||
      userProfile?.role === 'executive' ||
      (userProfile?.role === 'ops_manager' && userProfile?.division_id === divisionId)

    if (!canForecast) {
      // Check if user is the division PM
      const { data: projectDivision } = await supabase
        .from('project_divisions')
        .select('division_pm_id')
        .eq('project_id', id)
        .eq('division_id', divisionId)
        .single()

      if (projectDivision?.division_pm_id !== user.id) {
        return NextResponse.json(
          { error: 'Insufficient permissions to update division forecast' },
          { status: 403 }
        )
      }
    }

    // Validate request body
    const forecastSchema = z.object({
      forecast_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      forecasted_cost: z.number().min(0),
      cost_to_complete: z.number().min(0),
      percent_complete: z.number().min(0).max(100),
      notes: z.string().optional()
    })

    const body = await request.json()
    const validatedData = forecastSchema.parse(body)

    // Upsert forecast
    const { data: forecast, error } = await supabase
      .from('division_forecasts')
      .upsert({
        project_id: id,
        division_id: divisionId,
        ...validatedData,
        created_by: user.id
      }, {
        onConflict: 'project_id,division_id,forecast_date'
      })
      .select(`
        *,
        division:divisions!division_forecasts_division_id_fkey(id, name, code)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log audit trail
    await supabase
      .from('audit_log')
      .insert({
        entity_type: 'division_forecast',
        entity_id: forecast.id,
        action: 'update',
        changes: validatedData,
        performed_by: user.id
      })

    return NextResponse.json({ forecast })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update division forecast error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/divisions/[divisionId]/forecast/history - Get forecast history
export async function GET_HISTORY(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; divisionId: string }> }
) {
  const { id, divisionId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '12')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    // Build query
    let query = supabase
      .from('division_forecasts')
      .select(`
        *,
        division:divisions!division_forecasts_division_id_fkey(id, name, code),
        created_by_user:profiles!division_forecasts_created_by_fkey(id, first_name, last_name)
      `)
      .eq('project_id', id)
      .eq('division_id', divisionId)
      .order('forecast_date', { ascending: false })
      .limit(limit)

    if (start_date) {
      query = query.gte('forecast_date', start_date)
    }

    if (end_date) {
      query = query.lte('forecast_date', end_date)
    }

    const { data: forecasts, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate trends
    const trends = {
      cost_trend: 'stable',
      completion_trend: 'stable',
      accuracy_trend: 'stable'
    }

    if (forecasts && forecasts.length >= 2) {
      const latest = forecasts[0]
      const previous = forecasts[1]

      // Cost trend
      if (latest.forecasted_cost > previous.forecasted_cost * 1.05) {
        trends.cost_trend = 'increasing'
      } else if (latest.forecasted_cost < previous.forecasted_cost * 0.95) {
        trends.cost_trend = 'decreasing'
      }

      // Completion trend
      if (latest.percent_complete > previous.percent_complete) {
        trends.completion_trend = 'progressing'
      } else if (latest.percent_complete < previous.percent_complete) {
        trends.completion_trend = 'delayed'
      }
    }

    return NextResponse.json({ 
      forecasts: forecasts || [],
      trends
    })
  } catch (error) {
    console.error('Get division forecast history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}