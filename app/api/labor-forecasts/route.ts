import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  laborForecastApiSchema,
  laborForecastQuerySchema,
  validateUniqueEntry,
  calculateForecastedCost,
  calculateVariance,
  getWeekEndingDate,
  formatWeekEnding
} from '@/lib/validations/labor-forecast'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts - List all labor forecasts with filtering
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
    .select('role, id')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const query = laborForecastQuerySchema.parse(searchParams)

    // Build the query
    let queryBuilder = supabase
      .from('labor_forecasts')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name,
          division:divisions!inner(id, name)
        ),
        craft_type:craft_types!inner(
          id,
          name,
          code,
          category
        ),
        created_by_user:profiles!labor_forecasts_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `, { count: 'exact' })
      .is('deleted_at', null)

    // Apply filters based on user role
    if (userDetails.role === 'project_manager') {
      // Project managers can only see their projects' labor forecasts
      queryBuilder = queryBuilder.eq('project.project_manager_id', user.id)
    } else if (userDetails.role === 'viewer') {
      // Viewers need explicit project access
      const { data: projectAccess } = await supabase
        .from('user_project_access')
        .select('project_id')
        .eq('user_id', user.id)

      if (!projectAccess || projectAccess.length === 0) {
        return NextResponse.json({ 
          laborForecasts: [], 
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } 
        })
      }

      const projectIds = projectAccess.map(access => access.project_id)
      queryBuilder = queryBuilder.in('project_id', projectIds)
    }

    // Apply query filters
    if (query.project_id) {
      queryBuilder = queryBuilder.eq('project_id', query.project_id)
    }

    if (query.craft_type_id) {
      queryBuilder = queryBuilder.eq('craft_type_id', query.craft_type_id)
    }

    if (query.week_start) {
      queryBuilder = queryBuilder.gte('week_ending', query.week_start)
    }

    if (query.week_end) {
      queryBuilder = queryBuilder.lte('week_ending', query.week_end)
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(query.sort_by, { ascending: query.sort_order === 'asc' })

    // Apply pagination
    const offset = (query.page - 1) * query.limit
    queryBuilder = queryBuilder.range(offset, offset + query.limit - 1)

    const { data: laborForecasts, error, count } = await queryBuilder

    if (error) throw error

    // Calculate variances and format response
    const formattedForecasts = laborForecasts?.map(lf => {
      const hourVariance = calculateVariance(lf.forecasted_hours, lf.actual_hours)
      const costVariance = calculateVariance(lf.forecasted_cost, lf.actual_cost)
      
      return {
        id: lf.id,
        projectId: lf.project_id,
        craftTypeId: lf.craft_type_id,
        weekEnding: lf.week_ending,
        forecastedHours: lf.forecasted_hours,
        forecastedRate: lf.forecasted_rate,
        forecastedCost: lf.forecasted_cost,
        actualHours: lf.actual_hours,
        actualCost: lf.actual_cost,
        createdAt: lf.created_at,
        updatedAt: lf.updated_at,
        project: {
          id: lf.project.id,
          jobNumber: lf.project.job_number,
          name: lf.project.name,
          division: lf.project.division?.name
        },
        craftType: {
          id: lf.craft_type.id,
          name: lf.craft_type.name,
          code: lf.craft_type.code,
          category: lf.craft_type.category
        },
        createdBy: lf.created_by_user ? 
          `${lf.created_by_user.first_name} ${lf.created_by_user.last_name}` : null,
        variance: {
          hours: hourVariance,
          cost: costVariance,
          exceedsThreshold: hourVariance.exceeds_threshold || costVariance.exceeds_threshold
        }
      }
    }) || []

    // Filter by variance if requested
    const filteredForecasts = query.has_variance 
      ? formattedForecasts.filter(f => f.variance.exceedsThreshold)
      : formattedForecasts

    return NextResponse.json({
      laborForecasts: filteredForecasts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / query.limit)
      }
    })
  } catch (error) {
    console.error('Labor forecasts list error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch labor forecasts' },
      { status: 500 }
    )
  }
}

// POST /api/labor-forecasts - Create new labor forecast
export async function POST(request: NextRequest) {
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

  // Check permissions - viewers and executives cannot create
  if (['viewer', 'executive', 'accounting'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = laborForecastApiSchema.parse(body)

    // Ensure week ending is Sunday
    const weekEndingDate = getWeekEndingDate(new Date(validatedData.week_ending))
    validatedData.week_ending = weekEndingDate.toISOString()

    // Check if user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, project_manager_id')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Project managers can only create forecasts for their own projects
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate unique constraint
    const uniqueValidation = await validateUniqueEntry(
      supabase,
      validatedData.project_id,
      validatedData.craft_type_id,
      validatedData.week_ending
    )

    if (!uniqueValidation.valid) {
      return NextResponse.json(
        { error: uniqueValidation.message },
        { status: 409 }
      )
    }

    // Calculate forecasted cost
    const forecastedCost = calculateForecastedCost(
      validatedData.forecasted_hours,
      validatedData.forecasted_rate
    )

    // Create the labor forecast
    const { data: laborForecast, error: createError } = await supabase
      .from('labor_forecasts')
      .insert({
        project_id: validatedData.project_id,
        craft_type_id: validatedData.craft_type_id,
        week_ending: validatedData.week_ending,
        forecasted_hours: validatedData.forecasted_hours,
        forecasted_rate: validatedData.forecasted_rate,
        forecasted_cost: forecastedCost,
        actual_hours: validatedData.actual_hours || 0,
        actual_cost: validatedData.actual_cost || 0,
        created_by: user.id
      })
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name
        ),
        craft_type:craft_types!inner(
          id,
          name,
          code
        )
      `)
      .single()

    if (createError) throw createError

    // Notifications removed in simplification

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'create',
      entity_type: 'labor_forecast',
      entity_id: laborForecast.id,
      changes: { created: laborForecast }
    })

    return NextResponse.json(
      {
        laborForecast: {
          id: laborForecast.id,
          projectId: laborForecast.project_id,
          craftTypeId: laborForecast.craft_type_id,
          weekEnding: laborForecast.week_ending,
          forecastedHours: laborForecast.forecasted_hours,
          forecastedRate: laborForecast.forecasted_rate,
          forecastedCost: laborForecast.forecasted_cost,
          actualHours: laborForecast.actual_hours,
          actualCost: laborForecast.actual_cost,
          project: {
            id: laborForecast.project.id,
            jobNumber: laborForecast.project.job_number,
            name: laborForecast.project.name
          },
          craftType: {
            id: laborForecast.craft_type.id,
            name: laborForecast.craft_type.name,
            code: laborForecast.craft_type.code
          }
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Labor forecast creation error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create labor forecast' },
      { status: 500 }
    )
  }
}