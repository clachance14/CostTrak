import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { changeOrderActionSchema } from '@/lib/validations/change-order'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// POST /api/change-orders/[id]/reject - Reject a change order
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

  // Only controllers and ops managers can reject
  if (!['controller', 'ops_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = changeOrderActionSchema.parse({ ...body, action: 'reject' })

    // Reason is required for rejections
    if (!validatedData.reason) {
      return NextResponse.json(
        { error: 'Reason is required for rejections' },
        { status: 400 }
      )
    }

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
        { error: `Cannot reject change order with status: ${changeOrder.status}` },
        { status: 400 }
      )
    }

    // Update change order status
    const { data: updatedCO, error: updateError } = await supabase
      .from('change_orders')
      .update({
        status: 'rejected',
        approved_by: user.id, // Track who rejected it
        approved_date: null // Clear any approved date
      })
      .eq('id', changeOrderId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log to audit trail with reason
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'reject',
      entity_type: 'change_order',
      entity_id: changeOrderId,
      changes: {
        status: { from: 'pending', to: 'rejected' },
        rejected_by: user.id,
        rejection_reason: validatedData.reason
      }
    })

    // Create notification for project manager
    if (changeOrder.project.project_manager_id && 
        changeOrder.project.project_manager_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: changeOrder.project.project_manager_id,
        type: 'large_change_order',
        title: 'Change Order Rejected',
        message: `Change order ${changeOrder.co_number} for ${changeOrder.project.name} has been rejected. Reason: ${validatedData.reason}`,
        priority: 'high',
        related_entity_type: 'change_order',
        related_entity_id: changeOrderId
      })
    }

    return NextResponse.json({
      message: 'Change order rejected successfully',
      changeOrder: {
        id: updatedCO.id,
        coNumber: updatedCO.co_number,
        status: updatedCO.status,
        rejectionReason: validatedData.reason
      }
    })
  } catch (error) {
    console.error('Change order rejection error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to reject change order' },
      { status: 500 }
    )
  }
}