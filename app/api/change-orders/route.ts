import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  changeOrderApiSchema, 
  changeOrderQuerySchema,
  generateCoNumber,
  validateChangeOrderAmount
} from '@/lib/validations/change-order'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/change-orders - List all change orders with filtering
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

  // Viewers don't have access to change orders
  if (userDetails.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const query = changeOrderQuerySchema.parse(searchParams)

    // Build the query
    let queryBuilder = supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name,
          division:divisions!inner(id, name)
        ),
        created_by_user:profiles!change_orders_created_by_fkey(
          id,
          first_name,
          last_name
        ),
        approved_by_user:profiles!change_orders_approved_by_fkey(
          id,
          first_name,
          last_name
        )
      `, { count: 'exact' })
      .is('deleted_at', null)

    // Apply filters based on user role
    if (userDetails.role === 'project_manager') {
      // Project managers can only see their projects' change orders
      queryBuilder = queryBuilder.eq('project.project_manager_id', user.id)
    }

    // Apply query filters
    if (query.project_id) {
      queryBuilder = queryBuilder.eq('project_id', query.project_id)
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status)
    }

    if (query.search) {
      queryBuilder = queryBuilder.or(
        `co_number.ilike.%${query.search}%,description.ilike.%${query.search}%`
      )
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(query.sort_by, { ascending: query.sort_order === 'asc' })

    // Apply pagination
    const offset = (query.page - 1) * query.limit
    queryBuilder = queryBuilder.range(offset, offset + query.limit - 1)

    const { data: changeOrders, error, count } = await queryBuilder

    if (error) throw error

    // Format response
    const formattedChangeOrders = changeOrders?.map(co => ({
      id: co.id,
      project_id: co.project_id,
      co_number: co.co_number,
      description: co.description,
      amount: co.amount,
      status: co.status,
      pricing_type: co.pricing_type,
      impact_schedule_days: co.impact_schedule_days,
      reason: co.reason,
      manhours: co.manhours,
      labor_amount: co.labor_amount,
      equipment_amount: co.equipment_amount,
      material_amount: co.material_amount,
      subcontract_amount: co.subcontract_amount,
      markup_amount: co.markup_amount,
      tax_amount: co.tax_amount,
      submitted_date: co.submitted_date,
      approved_date: co.approved_date,
      rejection_reason: co.rejection_reason,
      created_at: co.created_at,
      updated_at: co.updated_at,
      project: {
        id: co.project.id,
        job_number: co.project.job_number,
        name: co.project.name,
        division: co.project.division?.name
      },
      created_by_user: co.created_by_user ? {
        id: co.created_by_user.id,
        first_name: co.created_by_user.first_name,
        last_name: co.created_by_user.last_name
      } : null,
      approved_by_user: co.approved_by_user ? {
        id: co.approved_by_user.id,
        first_name: co.approved_by_user.first_name,
        last_name: co.approved_by_user.last_name
      } : null
    })) || []

    return NextResponse.json({
      changeOrders: formattedChangeOrders,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / query.limit)
      }
    })
  } catch (error) {
    console.error('Change orders list error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch change orders' },
      { status: 500 }
    )
  }
}

// POST /api/change-orders - Create new change order
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

  // Check permissions - viewers and accounting cannot create change orders
  if (['viewer', 'accounting', 'executive'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = changeOrderApiSchema.parse(body)

    // Check if user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, project_manager_id')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Project managers can only create COs for their own projects
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate CO number if not provided
    let coNumber = validatedData.co_number
    if (!coNumber || coNumber === 'AUTO') {
      const { data: existingCOs } = await supabase
        .from('change_orders')
        .select('co_number')
        .eq('project_id', validatedData.project_id)
        .order('co_number', { ascending: false })

      const existingNumbers = existingCOs?.map(co => co.co_number) || []
      coNumber = generateCoNumber(existingNumbers)
    }

    // Check for duplicate CO number
    const { data: existing } = await supabase
      .from('change_orders')
      .select('id')
      .eq('project_id', validatedData.project_id)
      .eq('co_number', coNumber)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'CO number already exists for this project' },
        { status: 409 }
      )
    }

    // Validate amount based on user role
    const amountValidation = validateChangeOrderAmount(validatedData.amount, userDetails.role)
    if (!amountValidation.valid && validatedData.status === 'approved') {
      return NextResponse.json(
        { error: amountValidation.message },
        { status: 403 }
      )
    }

    // Create the change order
    const { data: changeOrder, error: createError } = await supabase
      .from('change_orders')
      .insert({
        project_id: validatedData.project_id,
        co_number: coNumber,
        description: validatedData.description,
        amount: validatedData.amount,
        impact_schedule_days: validatedData.impact_schedule_days,
        submitted_date: validatedData.submitted_date || new Date().toISOString(),
        status: validatedData.status,
        pricing_type: validatedData.pricing_type,
        reason: validatedData.reason || null,
        manhours: validatedData.manhours || 0,
        labor_amount: validatedData.labor_amount || 0,
        equipment_amount: validatedData.equipment_amount || 0,
        material_amount: validatedData.material_amount || 0,
        subcontract_amount: validatedData.subcontract_amount || 0,
        markup_amount: validatedData.markup_amount || 0,
        tax_amount: validatedData.tax_amount || 0,
        created_by: user.id
      })
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name
        )
      `)
      .single()

    if (createError) throw createError

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'create',
      entity_type: 'change_order',
      entity_id: changeOrder.id,
      changes: { created: changeOrder }
    })

    return NextResponse.json(
      {
        changeOrder: {
          id: changeOrder.id,
          project_id: changeOrder.project_id,
          co_number: changeOrder.co_number,
          description: changeOrder.description,
          amount: changeOrder.amount,
          status: changeOrder.status,
          pricing_type: changeOrder.pricing_type,
          impact_schedule_days: changeOrder.impact_schedule_days,
          reason: changeOrder.reason,
          manhours: changeOrder.manhours,
          labor_amount: changeOrder.labor_amount,
          equipment_amount: changeOrder.equipment_amount,
          material_amount: changeOrder.material_amount,
          subcontract_amount: changeOrder.subcontract_amount,
          markup_amount: changeOrder.markup_amount,
          tax_amount: changeOrder.tax_amount,
          submitted_date: changeOrder.submitted_date,
          created_at: changeOrder.created_at,
          updated_at: changeOrder.updated_at,
          project: {
            id: changeOrder.project.id,
            job_number: changeOrder.project.job_number,
            name: changeOrder.project.name
          }
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Change order creation error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create change order' },
      { status: 500 }
    )
  }
}