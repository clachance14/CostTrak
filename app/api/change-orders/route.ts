import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/change-orders - List change orders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const project_id = searchParams.get('project_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query with related data
    let query = supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name
        ),
        created_by_user:profiles!change_orders_created_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        approved_by_user:profiles!change_orders_approved_by_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (project_id) {
      query = query.eq('project_id', project_id)
    }
    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: change_orders, count, error } = await query

    if (error) {
      console.error('Change orders fetch error:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Debug logging
    console.log(`Change orders query - project_id: ${project_id}, found: ${change_orders?.length || 0} records`)
    if (change_orders?.length > 0) {
      console.log('First change order:', change_orders[0])
    }

    return NextResponse.json({
      change_orders: change_orders || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Change orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/change-orders - Create new change order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const changeOrderSchema = z.object({
      project_id: z.string().uuid(),
      co_number: z.string().min(1).max(50),
      description: z.string().min(1),
      pricing_type: z.enum(['LS', 'T&M', 'Estimate', 'Credit']).default('LS'),
      amount: z.number(),
      submitted_date: z.string().optional(),
      status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
      // Cost breakdown fields
      manhours: z.number().nullable().optional().default(0),
      labor_amount: z.number().nullable().optional().default(0),
      equipment_amount: z.number().nullable().optional().default(0),
      material_amount: z.number().nullable().optional().default(0),
      subcontract_amount: z.number().nullable().optional().default(0),
      markup_amount: z.number().nullable().optional().default(0),
      tax_amount: z.number().nullable().optional().default(0),
      impact_schedule_days: z.number().nullable().optional().default(0)
    })

    const body = await request.json()
    const validatedData = changeOrderSchema.parse(body)

    // Transform null values to 0 for numeric fields
    const dataToInsert = {
      ...validatedData,
      manhours: validatedData.manhours ?? 0,
      labor_amount: validatedData.labor_amount ?? 0,
      equipment_amount: validatedData.equipment_amount ?? 0,
      material_amount: validatedData.material_amount ?? 0,
      subcontract_amount: validatedData.subcontract_amount ?? 0,
      markup_amount: validatedData.markup_amount ?? 0,
      tax_amount: validatedData.tax_amount ?? 0,
      impact_schedule_days: validatedData.impact_schedule_days ?? 0,
      created_by: user.id,
      division_id: null  // Explicitly set to null since divisions have been removed
    }

    // Create change order
    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .insert(dataToInsert)
      .select(`
        *,
        project:projects(
          id,
          job_number,
          name
        ),
        created_by_user:profiles!change_orders_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505' && error.message.includes('co_number')) {
        return NextResponse.json(
          { error: 'Change order number already exists for this project' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // If approved, update project revised contract
    if (validatedData.status === 'approved') {
      await updateProjectRevisedContract(supabase, validatedData.project_id)
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'change_order',
      entity_id: changeOrder.id,
      action: 'create',
      changes: changeOrder,
      performed_by: user.id
    })

    return NextResponse.json({ change_order: changeOrder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create change order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to update project revised contract
async function updateProjectRevisedContract(supabase: ReturnType<typeof createClient>, projectId: string) {
  // Get all approved change orders for the project
  const { data: approvedChangeOrders } = await supabase
    .from('change_orders')
    .select('amount')
    .eq('project_id', projectId)
    .eq('status', 'approved')

  if (approvedChangeOrders) {
    const totalChangeOrders = approvedChangeOrders.reduce((sum: number, co: { amount: number }) => sum + (co.amount || 0), 0)
    
    // Get project original contract
    const { data: project } = await supabase
      .from('projects')
      .select('original_contract')
      .eq('id', projectId)
      .single()

    if (project) {
      const revisedContract = (project.original_contract || 0) + totalChangeOrders
      
      // Update project revised contract
      await supabase
        .from('projects')
        .update({ revised_contract: revisedContract })
        .eq('id', projectId)
    }
  }
}