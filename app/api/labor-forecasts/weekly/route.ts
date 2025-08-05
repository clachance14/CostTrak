import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  weeklyLaborEntrySchema,
  calculateForecastedCost,
  calculateVariance,
  getWeekEndingDate,
  formatWeekEnding,
  getProjectCraftRate
} from '@/lib/validations/labor-forecast'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/weekly - Get weekly view of labor forecasts
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
    // Parse query parameters
    const projectId = request.nextUrl.searchParams.get('project_id')
    const weekEnding = request.nextUrl.searchParams.get('week_ending')

    if (!projectId || !weekEnding) {
      return NextResponse.json(
        { error: 'project_id and week_ending are required' },
        { status: 400 }
      )
    }

    // Ensure week ending is Sunday
    const weekEndingDate = getWeekEndingDate(new Date(weekEnding))
    const formattedWeekEnding = weekEndingDate.toISOString()

    // Check project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, name, project_manager_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check access
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

    // Get all craft types
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('id, name, code, category')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    // Get existing forecasts for this week
    const { data: existingForecasts } = await supabase
      .from('labor_forecasts')
      .select('*')
      .eq('project_id', projectId)
      .eq('week_ending', formattedWeekEnding)
      .is('deleted_at', null)

    // Build response with all craft types
    const weeklyData = await Promise.all(
      (craftTypes || []).map(async (craft) => {
        const existing = existingForecasts?.find(f => f.craft_type_id === craft.id)
        
        // Get default rate for this project/craft if no existing data
        let defaultRate = null
        if (!existing) {
          defaultRate = await getProjectCraftRate(supabase, projectId, craft.id)
        }

        if (existing) {
          const hourVariance = calculateVariance(existing.forecasted_hours, existing.actual_hours)
          const costVariance = calculateVariance(existing.forecasted_cost, existing.actual_cost)
          
          return {
            id: existing.id,
            craftType: craft,
            forecastedHours: existing.forecasted_hours,
            forecastedRate: existing.forecasted_rate,
            forecastedCost: existing.forecasted_cost,
            actualHours: existing.actual_hours,
            actualCost: existing.actual_cost,
            variance: {
              hours: hourVariance,
              cost: costVariance,
              exceedsThreshold: hourVariance.exceeds_threshold || costVariance.exceeds_threshold
            },
            updatedAt: existing.updated_at
          }
        } else {
          return {
            id: null,
            craftType: craft,
            forecastedHours: 0,
            forecastedRate: defaultRate || 0,
            forecastedCost: 0,
            actualHours: 0,
            actualCost: 0,
            variance: {
              hours: { amount: 0, percentage: 0, exceeds_threshold: false },
              cost: { amount: 0, percentage: 0, exceeds_threshold: false },
              exceedsThreshold: false
            },
            updatedAt: null
          }
        }
      })
    )

    // Calculate weekly totals
    const totals = weeklyData.reduce((acc, entry) => ({
      forecastedHours: acc.forecastedHours + entry.forecastedHours,
      forecastedCost: acc.forecastedCost + entry.forecastedCost,
      actualHours: acc.actualHours + entry.actualHours,
      actualCost: acc.actualCost + entry.actualCost
    }), {
      forecastedHours: 0,
      forecastedCost: 0,
      actualHours: 0,
      actualCost: 0
    })

    const totalHourVariance = calculateVariance(totals.forecastedHours, totals.actualHours)
    const totalCostVariance = calculateVariance(totals.forecastedCost, totals.actualCost)

    return NextResponse.json({
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      weekEnding: formatWeekEnding(weekEndingDate),
      entries: weeklyData,
      totals: {
        ...totals,
        variance: {
          hours: totalHourVariance,
          cost: totalCostVariance,
          exceedsThreshold: totalHourVariance.exceeds_threshold || totalCostVariance.exceeds_threshold
        }
      }
    })
  } catch (error) {
    console.error('Weekly labor fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly labor data' },
      { status: 500 }
    )
  }
}

// POST /api/labor-forecasts/weekly - Create/update weekly batch
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

  // Check permissions
  if (['viewer', 'executive', 'accounting'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = weeklyLaborEntrySchema.parse(body)

    // Ensure week ending is Sunday
    const weekEndingDate = getWeekEndingDate(new Date(validatedData.week_ending))
    const formattedWeekEnding = weekEndingDate.toISOString()

    // Check project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_manager_id')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Project managers can only update their own projects
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results = []
    const errors = []
    const notifications = []

    // Process each entry
    for (const entry of validatedData.entries) {
      try {
        // Check if entry exists
        const { data: existing } = await supabase
          .from('labor_forecasts')
          .select('*')
          .eq('project_id', validatedData.project_id)
          .eq('craft_type_id', entry.craft_type_id)
          .eq('week_ending', formattedWeekEnding)
          .is('deleted_at', null)
          .single()

        const forecastedCost = calculateForecastedCost(
          entry.forecasted_hours,
          entry.forecasted_rate
        )

        if (existing) {
          // Update existing entry
          const updateData = {
            forecasted_hours: entry.forecasted_hours,
            forecasted_rate: entry.forecasted_rate,
            forecasted_cost: forecastedCost,
            actual_hours: entry.actual_hours ?? existing.actual_hours,
            actual_cost: entry.actual_cost ?? existing.actual_cost
          }

          const { data: updated } = await supabase
            .from('labor_forecasts')
            .update(updateData)
            .eq('id', existing.id)
            .select()
            .single()

          // Check for new variance
          const newVariance = calculateVariance(updated.forecasted_hours, updated.actual_hours)
          const oldVariance = calculateVariance(existing.forecasted_hours, existing.actual_hours)

          if (newVariance.exceeds_threshold && !oldVariance.exceeds_threshold) {
            notifications.push({
              forecast_id: updated.id,
              craft_type_id: entry.craft_type_id,
              variance: newVariance.percentage
            })
          }

          // Log update
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'update',
            entity_type: 'labor_forecast',
            entity_id: existing.id,
            changes: { 
              from: existing,
              to: updateData
            }
          })

          results.push({ 
            action: 'updated', 
            id: existing.id,
            craft_type_id: entry.craft_type_id 
          })
        } else {
          // Create new entry
          const { data: created } = await supabase
            .from('labor_forecasts')
            .insert({
              project_id: validatedData.project_id,
              craft_type_id: entry.craft_type_id,
              week_ending: formattedWeekEnding,
              forecasted_hours: entry.forecasted_hours,
              forecasted_rate: entry.forecasted_rate,
              forecasted_cost: forecastedCost,
              actual_hours: entry.actual_hours || 0,
              actual_cost: entry.actual_cost || 0,
              created_by: user.id
            })
            .select()
            .single()

          // Check variance on new entry
          if (entry.actual_hours || entry.actual_cost) {
            const variance = calculateVariance(
              entry.forecasted_hours,
              entry.actual_hours || 0
            )
            if (variance.exceeds_threshold) {
              notifications.push({
                forecast_id: created.id,
                craft_type_id: entry.craft_type_id,
                variance: variance.percentage
              })
            }
          }

          // Log creation
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'create',
            entity_type: 'labor_forecast',
            entity_id: created.id,
            changes: { created }
          })

          results.push({ 
            action: 'created', 
            id: created.id,
            craft_type_id: entry.craft_type_id 
          })
        }
      } catch (error) {
        errors.push({
          craft_type_id: entry.craft_type_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Notifications removed in simplification

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        created: results.filter(r => r.action === 'created').length,
        updated: results.filter(r => r.action === 'updated').length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('Weekly labor batch error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to process weekly labor batch' },
      { status: 500 }
    )
  }
}