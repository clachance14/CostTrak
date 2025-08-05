import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/change-orders/[id] - Get single change order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .select(`
        *,
        project:projects(
          id,
          job_number,
          name,
          project_manager_id
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
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ change_order: changeOrder })
  } catch (error) {
    console.error('Get change order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/change-orders/[id] - Update change order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing change order
    const { data: existingCO, error: fetchError } = await supabase
      .from('change_orders')
      .select('*, project:projects(project_manager_id)')
      .eq('id', id)
      .single()

    if (fetchError || !existingCO) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // All authenticated users can edit pending change orders
    if (existingCO.status !== 'pending' && !validatedData.status) {
      return NextResponse.json(
        { error: 'Can only edit pending change orders' },
        { status: 400 }
      )
    }

    // Validate request body
    const updateSchema = z.object({
      description: z.string().min(1).optional(),
      pricing_type: z.enum(['LS', 'T&M', 'Estimate', 'Credit']).optional(),
      amount: z.number().optional(),
      submitted_date: z.string().datetime().optional(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      // Cost breakdown fields
      manhours: z.number().optional(),
      labor_amount: z.number().optional(),
      equipment_amount: z.number().optional(),
      material_amount: z.number().optional(),
      subcontract_amount: z.number().optional(),
      markup_amount: z.number().optional(),
      tax_amount: z.number().optional(),
      impact_schedule_days: z.number().optional()
    })

    const body = await request.json()
    const validatedData = updateSchema.parse(body)

    // Track status changes
    const wasApproved = existingCO.status === 'approved'
    const isNowApproved = validatedData.status === 'approved'
    const isNowRejected = validatedData.status === 'rejected'

    // If approving, set approved_by and approved_date
    if (!wasApproved && isNowApproved) {
      validatedData.approved_by = user.id
      validatedData.approved_date = new Date().toISOString()
    }

    // If rejecting, soft delete by setting deleted_at
    if (isNowRejected) {
      validatedData.deleted_at = new Date().toISOString()
    }

    // Update change order
    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .update(validatedData)
      .eq('id', id)
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
        ),
        approved_by_user:profiles!change_orders_approved_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update project revised contract if status changed
    if (wasApproved !== isNowApproved) {
      await updateProjectRevisedContract(supabase, existingCO.project_id)
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'change_order',
      entity_id: id,
      action: 'update',
      changes: validatedData,
      performed_by: user.id
    })

    return NextResponse.json({ change_order: changeOrder })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update change order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/change-orders/[id] - Soft delete change order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing change order
    const { data: existingCO, error: fetchError } = await supabase
      .from('change_orders')
      .select('*, project:projects(project_manager_id)')
      .eq('id', id)
      .single()

    if (fetchError || !existingCO) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // All authenticated users can delete pending change orders

    // Only allow deletion of pending change orders
    if (existingCO.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only delete pending change orders' },
        { status: 400 }
      )
    }

    // Soft delete by updating status to rejected
    const { error } = await supabase
      .from('change_orders')
      .update({ 
        status: 'rejected',
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'change_order',
      entity_id: id,
      action: 'delete',
      changes: { status: 'rejected' },
      performed_by: user.id
    })

    return NextResponse.json({ message: 'Change order deleted successfully' })
  } catch (error) {
    console.error('Delete change order error:', error)
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