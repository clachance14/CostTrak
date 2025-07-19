import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  weeklyActualBatchSchema,
  getWeekEndingDate
} from '@/lib/validations/labor-forecast-v2'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Type definition for employee actual with nested relations
type EmployeeActualWithRelations = {
  week_ending: string
  total_hours: number | null
  total_cost: number | null
  employee_id: string
  employees: {
    craft_type_id: string
    craft_types: {
      id: string
      name: string
      code: string
      category: string
    }
  }
}

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
      // TODO: Implement proper viewer access control when user_project_access table is created
      // For now, viewers are blocked from this endpoint
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch employee actuals (primary data source)
    let employeeActualsQuery = supabase
      .from('labor_employee_actuals')
      .select(`
        week_ending,
        total_hours,
        total_cost,
        employee_id,
        employees!inner (
          craft_type_id,
          craft_types!inner (
            id,
            name,
            code,
            category
          )
        )
      `)
      .eq('project_id', projectId)
      .order('week_ending', { ascending: false })

    if (weekEnding) {
      const weekEndingDate = getWeekEndingDate(new Date(weekEnding))
      employeeActualsQuery = employeeActualsQuery.eq('week_ending', weekEndingDate.toISOString())
    }
    // No date filter - return all historical data for the project

    const { data: employeeActuals, error: empActualsError } = await employeeActualsQuery as { 
      data: EmployeeActualWithRelations[] | null
      error: any 
    }
    
    if (empActualsError) {
      console.error('Employee actuals query error:', JSON.stringify(empActualsError, null, 2))
      throw empActualsError
    }

    console.log(`Found ${employeeActuals?.length || 0} employee actuals for project ${projectId}`)

    // Aggregate employee actuals by craft type and week
    // Using only labor_employee_actuals as the source of truth
    const aggregatedMap = new Map<string, any>()
    
    // Aggregate employee actuals by craft type
    employeeActuals?.forEach(empActual => {
      if (!empActual.employees?.craft_type_id || !empActual.employees?.craft_types) return
      
      const craftType = empActual.employees.craft_types
      const key = `${empActual.week_ending}-${empActual.employees.craft_type_id}`
      
      if (aggregatedMap.has(key)) {
        // Add to existing entry for same week/craft
        const existing = aggregatedMap.get(key)
        existing.totalHours += empActual.total_hours || 0
        existing.totalCost += empActual.total_cost || 0
      } else {
        // Create new entry
        aggregatedMap.set(key, {
          weekEnding: empActual.week_ending,
          craftTypeId: empActual.employees.craft_type_id,
          craftName: craftType.name,
          craftCode: craftType.code,
          laborCategory: craftType.category,
          totalHours: empActual.total_hours || 0,
          totalCost: empActual.total_cost || 0
        })
      }
    })

    // Convert map to array
    const combinedActuals = Array.from(aggregatedMap.values())
      .sort((a, b) => b.weekEnding.localeCompare(a.weekEnding))

    // Get all craft types for the form
    const { data: allCraftTypes } = await supabase
      .from('craft_types')
      .select('id, name, code, category')
      .eq('is_active', true)
      .order('labor_category')
      .order('name')

    // Get running averages
    const { data: runningAverages } = await supabase
      .from('labor_running_averages')
      .select('craft_type_id, avg_rate, week_count')
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
      actuals: combinedActuals.map(actual => ({
        id: `${actual.weekEnding}-${actual.craftTypeId}`, // Generate a composite ID
        craftTypeId: actual.craftTypeId,
        craftName: actual.craftName,
        craftCode: actual.craftCode,
        laborCategory: actual.laborCategory,
        weekEnding: actual.weekEnding,
        actualCost: actual.totalCost,  // Changed from totalCost to actualCost
        actualHours: actual.totalHours, // Changed from totalHours to actualHours
        totalCost: actual.totalCost,
        totalHours: actual.totalHours,
        ratePerHour: actual.totalHours > 0 ? actual.totalCost / actual.totalHours : 0,
        runningAvgRate: avgMap.get(actual.craftTypeId) || 0
      })),
      craftTypes: allCraftTypes?.map(ct => ({
        id: ct.id,
        name: ct.name,
        code: ct.code,
        laborCategory: ct.category,
        runningAvgRate: avgMap.get(ct.id) || 0
      })) || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Weekly actuals fetch error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
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
              actual_cost: entry.total_cost,
              actual_hours: entry.total_hours,
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
                actual_cost: existing.actual_cost,
                actual_hours: existing.actual_hours
              },
              after: {
                actual_cost: entry.total_cost,
                actual_hours: entry.total_hours
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
              actual_cost: entry.total_cost,
              actual_hours: entry.total_hours,
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