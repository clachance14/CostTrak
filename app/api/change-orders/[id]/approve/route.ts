import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  changeOrderActionSchema,
  validateChangeOrderAmount 
} from '@/lib/validations/change-order'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// POST /api/change-orders/[id]/approve - Approve a change order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
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

  // Only controllers and ops managers can approve
  if (!['controller', 'ops_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = changeOrderActionSchema.parse({ ...body, action: 'approve' })

    // Get existing change order
    const { data: changeOrder, error: fetchError } = await supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name,
          project_manager_id
        )
      `)
      .eq('id', changeOrderId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Check current status
    if (changeOrder.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve change order with status: ${changeOrder.status}` },
        { status: 400 }
      )
    }

    // Validate amount based on user role
    const amountValidation = validateChangeOrderAmount(changeOrder.amount, userDetails.role)
    if (!amountValidation.valid) {
      return NextResponse.json(
        { error: amountValidation.message },
        { status: 403 }
      )
    }

    // Update change order status
    const approvedDate = validatedData.approved_date || new Date().toISOString()
    
    const { data: updatedCO, error: updateError } = await supabase
      .from('change_orders')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_date: approvedDate
      })
      .eq('id', changeOrderId)
      .select()
      .single()

    if (updateError) throw updateError

    // The database trigger will automatically update the project's revised_contract

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'approve',
      entity_type: 'change_order',
      entity_id: changeOrderId,
      changes: {
        status: { from: 'pending', to: 'approved' },
        approved_by: user.id,
        approved_date: approvedDate,
        reason: validatedData.reason
      }
    })

    // Create notification for project manager
    if (changeOrder.project.project_manager_id && 
        changeOrder.project.project_manager_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: changeOrder.project.project_manager_id,
        type: 'large_change_order',
        title: 'Change Order Approved',
        message: `Change order ${changeOrder.co_number} for ${changeOrder.project.name} has been approved`,
        priority: 'medium',
        related_entity_type: 'change_order',
        related_entity_id: changeOrderId
      })
    }

    // Get updated project info
    const { data: updatedProject } = await supabase
      .from('projects')
      .select('original_contract, revised_contract')
      .eq('id', changeOrder.project_id)
      .single()

    return NextResponse.json({
      message: 'Change order approved successfully',
      changeOrder: {
        id: updatedCO.id,
        coNumber: updatedCO.co_number,
        status: updatedCO.status,
        approvedDate: updatedCO.approved_date,
        approvedBy: user.id
      },
      projectUpdate: {
        originalContract: updatedProject?.original_contract,
        revisedContract: updatedProject?.revised_contract,
        changeOrderImpact: changeOrder.amount
      }
    })
  } catch (error) {
    console.error('Change order approval error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to approve change order' },
      { status: 500 }
    )
  }
}