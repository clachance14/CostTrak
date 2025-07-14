import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  laborForecastUpdateSchema,
  calculateForecastedCost,
  calculateVariance,
  formatWeekEnding
} from '@/lib/validations/labor-forecast'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/[id] - Get single labor forecast
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const forecastId = params.id
  
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
    // Fetch labor forecast with related data
    const { data: laborForecast, error } = await supabase
      .from('labor_forecasts')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name,
          project_manager_id,
          division:divisions!inner(id, name, code),
          client:clients!inner(id, name)
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
          last_name,
          email
        )
      `)
      .eq('id', forecastId)
      .is('deleted_at', null)
      .single()

    if (error || !laborForecast) {
      return NextResponse.json({ error: 'Labor forecast not found' }, { status: 404 })
    }

    // Check access for project managers and viewers
    if (userDetails.role === 'project_manager' && 
        laborForecast.project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (userDetails.role === 'viewer') {
      const { data: access } = await supabase
        .from('user_project_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', laborForecast.project_id)
        .single()

      if (!access) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get audit log for this forecast
    const { data: auditLogs } = await supabase
      .from('audit_log')
      .select(`
        *,
        user:profiles!audit_log_user_id_fkey(first_name, last_name)
      `)
      .eq('entity_type', 'labor_forecast')
      .eq('entity_id', forecastId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate variances
    const hourVariance = calculateVariance(
      laborForecast.forecasted_hours,
      laborForecast.actual_hours
    )
    const costVariance = calculateVariance(
      laborForecast.forecasted_cost,
      laborForecast.actual_cost
    )

    // Format response
    const response = {
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
        createdAt: laborForecast.created_at,
        updatedAt: laborForecast.updated_at,
        project: {
          id: laborForecast.project.id,
          jobNumber: laborForecast.project.job_number,
          name: laborForecast.project.name,
          division: {
            id: laborForecast.project.division.id,
            name: laborForecast.project.division.name,
            code: laborForecast.project.division.code
          },
          client: {
            id: laborForecast.project.client.id,
            name: laborForecast.project.client.name
          }
        },
        craftType: {
          id: laborForecast.craft_type.id,
          name: laborForecast.craft_type.name,
          code: laborForecast.craft_type.code,
          category: laborForecast.craft_type.category
        },
        createdBy: laborForecast.created_by_user ? {
          id: laborForecast.created_by_user.id,
          name: `${laborForecast.created_by_user.first_name} ${laborForecast.created_by_user.last_name}`,
          email: laborForecast.created_by_user.email
        } : null,
        variance: {
          hours: hourVariance,
          cost: costVariance,
          exceedsThreshold: hourVariance.exceeds_threshold || costVariance.exceeds_threshold
        }
      },
      auditTrail: auditLogs?.map(log => ({
        action: log.action,
        changes: log.changes,
        timestamp: log.created_at,
        user: log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'
      })) || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Labor forecast fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labor forecast' },
      { status: 500 }
    )
  }
}

// PATCH /api/labor-forecasts/[id] - Update labor forecast
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const forecastId = params.id
  
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
    const validatedData = laborForecastUpdateSchema.parse(body)

    // Get existing forecast
    const { data: existingForecast, error: fetchError } = await supabase
      .from('labor_forecasts')
      .select(`
        *,
        project:projects!inner(project_manager_id)
      `)
      .eq('id', forecastId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingForecast) {
      return NextResponse.json({ error: 'Labor forecast not found' }, { status: 404 })
    }

    // Check access for project managers
    if (userDetails.role === 'project_manager' && 
        existingForecast.project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { ...validatedData }
    
    // If hours or rate changed, recalculate cost
    if (validatedData.forecasted_hours !== undefined || validatedData.forecasted_rate !== undefined) {
      const hours = validatedData.forecasted_hours ?? existingForecast.forecasted_hours
      const rate = validatedData.forecasted_rate ?? existingForecast.forecasted_rate
      updateData.forecasted_cost = calculateForecastedCost(hours, rate)
    }

    // Update the forecast
    const { data: updatedForecast, error: updateError } = await supabase
      .from('labor_forecasts')
      .update(updateData)
      .eq('id', forecastId)
      .select()
      .single()

    if (updateError) throw updateError

    // Check for variance after update
    const newHourVariance = calculateVariance(
      updatedForecast.forecasted_hours,
      updatedForecast.actual_hours
    )
    const newCostVariance = calculateVariance(
      updatedForecast.forecasted_cost,
      updatedForecast.actual_cost
    )

    const oldHourVariance = calculateVariance(
      existingForecast.forecasted_hours,
      existingForecast.actual_hours
    )
    const oldCostVariance = calculateVariance(
      existingForecast.forecasted_cost,
      existingForecast.actual_cost
    )

    // Create notification if variance now exceeds threshold
    if ((newHourVariance.exceeds_threshold || newCostVariance.exceeds_threshold) &&
        (!oldHourVariance.exceeds_threshold && !oldCostVariance.exceeds_threshold)) {
      
      const { data: projectData } = await supabase
        .from('projects')
        .select('name, project_manager_id')
        .eq('id', existingForecast.project_id)
        .single()

      const { data: craftData } = await supabase
        .from('craft_types')
        .select('name')
        .eq('id', existingForecast.craft_type_id)
        .single()

      if (projectData) {
        await supabase.from('notifications').insert({
          user_id: projectData.project_manager_id,
          type: 'labor_variance',
          title: 'Labor Variance Alert',
          message: `Labor forecast variance now exceeds 10% for ${craftData?.name} in week ${formatWeekEnding(new Date(existingForecast.week_ending))}`,
          priority: 'medium',
          related_entity_type: 'labor_forecast',
          related_entity_id: forecastId,
          data: {
            project_id: existingForecast.project_id,
            hour_variance: newHourVariance.percentage,
            cost_variance: newCostVariance.percentage
          }
        })
      }
    }

    // Log changes to audit trail
    const changes: Record<string, unknown> = {}
    Object.keys(validatedData).forEach(key => {
      if ((existingForecast as Record<string, unknown>)[key] !== updateData[key]) {
        changes[key] = {
          from: (existingForecast as Record<string, unknown>)[key],
          to: updateData[key]
        }
      }
    })

    if (Object.keys(changes).length > 0) {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'labor_forecast',
        entity_id: forecastId,
        changes
      })
    }

    return NextResponse.json({
      laborForecast: {
        id: updatedForecast.id,
        projectId: updatedForecast.project_id,
        craftTypeId: updatedForecast.craft_type_id,
        weekEnding: updatedForecast.week_ending,
        forecastedHours: updatedForecast.forecasted_hours,
        forecastedRate: updatedForecast.forecasted_rate,
        forecastedCost: updatedForecast.forecasted_cost,
        actualHours: updatedForecast.actual_hours,
        actualCost: updatedForecast.actual_cost,
        variance: {
          hours: newHourVariance,
          cost: newCostVariance,
          exceedsThreshold: newHourVariance.exceeds_threshold || newCostVariance.exceeds_threshold
        }
      }
    })
  } catch (error) {
    console.error('Labor forecast update error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update labor forecast' },
      { status: 500 }
    )
  }
}

// DELETE /api/labor-forecasts/[id] - Soft delete labor forecast
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const forecastId = params.id
  
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

  // Only controllers and ops managers can delete
  if (!['controller', 'ops_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get existing forecast
    const { data: existingForecast, error: fetchError } = await supabase
      .from('labor_forecasts')
      .select('id, week_ending, project_id, craft_type_id')
      .eq('id', forecastId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingForecast) {
      return NextResponse.json({ error: 'Labor forecast not found' }, { status: 404 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('labor_forecasts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', forecastId)

    if (deleteError) throw deleteError

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'delete',
      entity_type: 'labor_forecast',
      entity_id: forecastId,
      changes: { 
        deleted: true,
        week_ending: existingForecast.week_ending
      }
    })

    return NextResponse.json({ 
      message: 'Labor forecast deleted successfully' 
    })
  } catch (error) {
    console.error('Labor forecast deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete labor forecast' },
      { status: 500 }
    )
  }
}