import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  headcountBatchSchema,
  getWeekEndingDate
} from '@/lib/validations/labor-forecast-v2'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/headcount - Get headcount forecast data
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
    const weeksAhead = parseInt(request.nextUrl.searchParams.get('weeks_ahead') || '12', 10)
    const startDateParam = request.nextUrl.searchParams.get('start_date')

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

    // Calculate date range
    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    const weeks = []
    for (let i = 0; i < weeksAhead; i++) {
      const weekDate = new Date(startDate)
      weekDate.setDate(startDate.getDate() + i * 7)
      weeks.push(getWeekEndingDate(weekDate))
    }

    // Get all craft types
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('id, name, code, category')
      .eq('is_active', true)
      .order('labor_category')
      .order('name')

    // Get existing headcount forecasts
    const { data: headcounts } = await supabase
      .from('labor_headcount_forecasts')
      .select('*')
      .eq('project_id', projectId)
      .gte('week_starting', weeks[0].toISOString())
      .lte('week_starting', weeks[weeks.length - 1].toISOString())

    // Get running averages for cost calculations
    const { data: runningAverages } = await supabase
      .from('labor_running_averages')
      .select('craft_type_id, avg_rate')
      .eq('project_id', projectId)

    const avgMap = new Map(
      runningAverages?.map(ra => [ra.craft_type_id, ra.avg_rate]) || []
    )

    // Create headcount map for easy lookup
    const headcountMap = new Map<string, number>()
    headcounts?.forEach(hc => {
      const key = `${hc.week_starting}_${hc.craft_type_id}`
      headcountMap.set(key, hc.headcount)
    })

    // Build response structure
    const weeklyData = weeks.map(weekEndingDate => {
      const weekString = weekEndingDate.toISOString()
      
      const entries = craftTypes?.map(craft => {
        const key = `${weekString}_${craft.id}`
        const headcount = headcountMap.get(key) || 0
        const avgRate = avgMap.get(craft.id) || 0
        const hoursPerPerson = 50 // Standard work week
        const totalHours = headcount * hoursPerPerson
        const forecastedCost = totalHours * avgRate

        return {
          craftTypeId: craft.id,
          craftName: craft.name,
          craftCode: craft.code,
          laborCategory: craft.category,
          headcount,
          hoursPerPerson,
          totalHours,
          avgRate,
          forecastedCost
        }
      }) || []

      // Calculate week totals
      const weekTotals = entries.reduce((totals, entry) => ({
        headcount: totals.headcount + entry.headcount,
        totalHours: totals.totalHours + entry.totalHours,
        forecastedCost: totals.forecastedCost + entry.forecastedCost
      }), { headcount: 0, totalHours: 0, forecastedCost: 0 })

      return {
        weekEnding: weekString,
        entries,
        totals: weekTotals
      }
    })

    // Calculate grand totals
    const grandTotals = weeklyData.reduce((totals, week) => ({
      headcount: totals.headcount + week.totals.headcount,
      totalHours: totals.totalHours + week.totals.totalHours,
      forecastedCost: totals.forecastedCost + week.totals.forecastedCost
    }), { headcount: 0, totalHours: 0, forecastedCost: 0 })

    return NextResponse.json({
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      weeks: weeklyData,
      grandTotals,
      craftTypes: craftTypes?.map(ct => ({
        id: ct.id,
        name: ct.name,
        code: ct.code,
        laborCategory: ct.category,
        avgRate: avgMap.get(ct.id) || 0
      })) || []
    })
  } catch (error) {
    console.error('Headcount forecast fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch headcount forecast' },
      { status: 500 }
    )
  }
}

// POST /api/labor-forecasts/headcount - Save headcount forecast batch
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
    const validatedData = headcountBatchSchema.parse(body)

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

    // Process each week
    for (const week of validatedData.weeks) {
      const weekEndingDate = getWeekEndingDate(new Date(week.week_ending))
      const formattedWeekEnding = weekEndingDate.toISOString()

      for (const entry of week.entries) {
        try {
          // Skip if headcount is 0 (delete existing if any)
          if (entry.headcount === 0) {
            const { error: deleteError } = await supabase
              .from('labor_headcount_forecasts')
              .delete()
              .eq('project_id', validatedData.project_id)
              .eq('craft_type_id', entry.craft_type_id)
              .eq('week_ending', formattedWeekEnding)

            if (deleteError && deleteError.code !== 'PGRST116') {
              throw deleteError
            }

            results.push({
              action: 'deleted',
              week_ending: formattedWeekEnding,
              craft_type_id: entry.craft_type_id
            })
            continue
          }

          // Check if entry exists
          const { data: existing } = await supabase
            .from('labor_headcount_forecasts')
            .select('*')
            .eq('project_id', validatedData.project_id)
            .eq('craft_type_id', entry.craft_type_id)
            .eq('week_ending', formattedWeekEnding)
            .single()

          if (existing) {
            // Update existing entry
            const { error: updateError } = await supabase
              .from('labor_headcount_forecasts')
              .update({
                headcount: entry.headcount,
                hours_per_person: entry.hours_per_person || 50,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)

            if (updateError) throw updateError

            results.push({
              action: 'updated',
              id: existing.id,
              week_ending: formattedWeekEnding,
              craft_type_id: entry.craft_type_id
            })
          } else {
            // Create new entry
            const { data: created, error: createError } = await supabase
              .from('labor_headcount_forecasts')
              .insert({
                project_id: validatedData.project_id,
                craft_type_id: entry.craft_type_id,
                week_ending: formattedWeekEnding,
                headcount: entry.headcount,
                hours_per_person: entry.hours_per_person || 50,
                created_by: user.id
              })
              .select()
              .single()

            if (createError) throw createError

            results.push({
              action: 'created',
              id: created.id,
              week_ending: formattedWeekEnding,
              craft_type_id: entry.craft_type_id
            })
          }
        } catch (error) {
          console.error('Entry processing error:', error)
          errors.push({
            week_ending: formattedWeekEnding,
            craft_type_id: entry.craft_type_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Log batch update to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'batch_update',
      entity_type: 'labor_headcount_forecast',
      entity_id: validatedData.project_id,
      changes: {
        weeks_updated: validatedData.weeks.length,
        results_summary: {
          created: results.filter(r => r.action === 'created').length,
          updated: results.filter(r => r.action === 'updated').length,
          deleted: results.filter(r => r.action === 'deleted').length
        }
      }
    })

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        created: results.filter(r => r.action === 'created').length,
        updated: results.filter(r => r.action === 'updated').length,
        deleted: results.filter(r => r.action === 'deleted').length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('Headcount batch error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to save headcount forecast' },
      { status: 500 }
    )
  }
}