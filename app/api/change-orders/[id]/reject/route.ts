import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for rejection request
const rejectSchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters')
})

// POST /api/change-orders/[id]/reject
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

  // Only controllers and ops managers can reject change orders
  if (!['controller', 'ops_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedData = rejectSchema.parse(body)

    // Get the change order details
    const { data: changeOrder, error: fetchError } = await supabase
      .from('change_orders')
      .select('*')
      .eq('id', changeOrderId)
      .single()

    if (fetchError || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Check if already rejected
    if (changeOrder.status === 'rejected') {
      return NextResponse.json({ error: 'Change order already rejected' }, { status: 400 })
    }

    // Only pending change orders can be rejected
    if (changeOrder.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot reject change order with status: ${changeOrder.status}` 
      }, { status: 400 })
    }

    // Update change order status
    const { error: updateError } = await supabase
      .from('change_orders')
      .update({
        status: 'rejected',
        rejection_reason: validatedData.reason,
        approved_by: user.id, // Track who rejected it
        approved_date: new Date().toISOString() // Track when it was rejected
      })
      .eq('id', changeOrderId)

    if (updateError) throw updateError

    // Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'change_order',
      entity_id: changeOrderId,
      action: 'reject',
      changes: {
        status: { from: changeOrder.status, to: 'rejected' },
        rejection_reason: validatedData.reason,
        rejected_by: user.id,
        rejected_date: new Date().toISOString()
      },
      performed_by: user.id
    })

    return NextResponse.json({
      success: true,
      changeOrder: {
        id: changeOrder.id,
        co_number: changeOrder.co_number,
        status: 'rejected',
        rejection_reason: validatedData.reason,
        rejected_by: user.id,
        rejected_date: new Date().toISOString()
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