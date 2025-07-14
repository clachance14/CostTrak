import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  weeklyActualBatchSchema,
  getWeekEndingDate
} from '@/lib/validations/labor-forecast-v2'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/weekly-actuals - Get weekly actual data
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

    // Build query
    let query = supabase
      .from('labor_actuals')
      .select(`
        *,
        craft_type:craft_types!inner(
          id,
          name,
          code,
          labor_category
        )
      `)
      .eq('project_id', projectId)
      .order('week_ending', { ascending: false })

    if (weekEnding) {
      const weekEndingDate = getWeekEndingDate(new Date(weekEnding))
      query = query.eq('week_ending', weekEndingDate.toISOString())
    } else {
      // Default to last 8 weeks
      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
      query = query.gte('week_ending', eightWeeksAgo.toISOString())
    }

    const { data: actuals, error } = await query

    if (error) throw error

    // Get all craft types for the form
    const { data: allCraftTypes } = await supabase
      .from('craft_types')
      .select('id, name, code, labor_category')
      .eq('is_active', true)
      .order('labor_category')
      .order('name')

    // Get running averages
    const { data: runningAverages } = await supabase
      .from('labor_running_averages')
      .select('craft_type_id, avg_rate, weeks_of_data')
      .eq('project_id', projectId)

    const avgMap = new Map(
      runningAverages?.map(ra => [ra.craft_type_id, ra.avg_rate]) || []
    )

    // Format response
    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      weekEnding: weekEnding ? getWeekEndingDate(new Date(weekEnding)).toISOString() : null,
      actuals: actuals?.map(actual => ({
        id: actual.id,
        craftTypeId: actual.craft_type_id,
        craftName: actual.craft_type.name,
        craftCode: actual.craft_type.code,
        laborCategory: actual.craft_type.labor_category,
        weekEnding: actual.week_ending,
        totalCost: actual.total_cost,
        totalHours: actual.total_hours,
        ratePerHour: actual.rate_per_hour,
        runningAvgRate: avgMap.get(actual.craft_type_id) || 0
      })) || [],
      craftTypes: allCraftTypes?.map(ct => ({
        id: ct.id,
        name: ct.name,
        code: ct.code,
        laborCategory: ct.labor_category,
        runningAvgRate: avgMap.get(ct.id) || 0
      })) || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Weekly actuals fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly actuals' },
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
    const validatedData = weeklyActualBatchSchema.parse(body)

    // Ensure week ending is Sunday
    const weekEndingDate = getWeekEndingDate(new Date(validatedData.week_ending))
    const formattedWeekEnding = weekEndingDate.toISOString()

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id, project_manager_id')
      .eq('id', validatedData.project_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Project managers can only update their own projects
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results = []
    const errors = []

    // Process each entry
    for (const entry of validatedData.entries) {
      try {
        // Check if entry exists
        const { data: existing } = await supabase
          .from('labor_actuals')
          .select('*')
          .eq('project_id', validatedData.project_id)
          .eq('craft_type_id', entry.craft_type_id)
          .eq('week_ending', formattedWeekEnding)
          .single()

        if (existing) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('labor_actuals')
            .update({
              total_cost: entry.total_cost,
              total_hours: entry.total_hours,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (updateError) throw updateError

          // Log update to audit trail
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'update',
            entity_type: 'labor_actual',
            entity_id: existing.id,
            changes: {
              before: {
                total_cost: existing.total_cost,
                total_hours: existing.total_hours
              },
              after: {
                total_cost: entry.total_cost,
                total_hours: entry.total_hours
              }
            }
          })

          results.push({
            action: 'updated',
            id: existing.id,
            craft_type_id: entry.craft_type_id
          })
        } else {
          // Create new entry
          const { data: created, error: createError } = await supabase
            .from('labor_actuals')
            .insert({
              project_id: validatedData.project_id,
              craft_type_id: entry.craft_type_id,
              week_ending: formattedWeekEnding,
              total_cost: entry.total_cost,
              total_hours: entry.total_hours,
              created_by: user.id
            })
            .select()
            .single()

          if (createError) throw createError

          // Log creation to audit trail
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'create',
            entity_type: 'labor_actual',
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
        console.error('Entry processing error:', error)
        errors.push({
          craft_type_id: entry.craft_type_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

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