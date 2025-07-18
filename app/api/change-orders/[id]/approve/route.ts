import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/change-orders/[id]/approve
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

  // Only controllers and ops managers can approve change orders
  if (!['controller', 'ops_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get the change order details
    const { data: changeOrder, error: fetchError } = await supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(
          id,
          original_contract,
          revised_contract
        )
      `)
      .eq('id', changeOrderId)
      .single()

    if (fetchError || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Check if already approved
    if (changeOrder.status === 'approved') {
      return NextResponse.json({ error: 'Change order already approved' }, { status: 400 })
    }

    // Only pending change orders can be approved
    if (changeOrder.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot approve change order with status: ${changeOrder.status}` 
      }, { status: 400 })
    }

    // Start a transaction-like operation
    // 1. Update change order status
    const { error: updateCOError } = await supabase
      .from('change_orders')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_date: new Date().toISOString()
      })
      .eq('id', changeOrderId)

    if (updateCOError) throw updateCOError

    // 2. Calculate the correct revised contract amount
    // Get all approved change orders for this project to ensure correct total
    const { data: allApprovedCOs } = await supabase
      .from('change_orders')
      .select('amount')
      .eq('project_id', changeOrder.project_id)
      .eq('status', 'approved')
    
    // Sum all approved change orders (including the one we're about to approve)
    const totalApprovedCOs = (allApprovedCOs || []).reduce((sum, co) => sum + co.amount, 0) + changeOrder.amount
    
    // Revised contract = original contract + all approved change orders
    const newRevisedContract = (changeOrder.project.original_contract || 0) + totalApprovedCOs
    
    const { error: updateProjectError } = await supabase
      .from('projects')
      .update({
        revised_contract: newRevisedContract
      })
      .eq('id', changeOrder.project_id)

    if (updateProjectError) throw updateProjectError

    // 3. Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'change_order',
      entity_id: changeOrderId,
      action: 'approve',
      changes: {
        status: { from: changeOrder.status, to: 'approved' },
        approved_by: user.id,
        approved_date: new Date().toISOString(),
        contract_impact: {
          previous_revised_contract: changeOrder.project.revised_contract || changeOrder.project.original_contract,
          new_revised_contract: newRevisedContract,
          change_amount: changeOrder.amount
        }
      },
      performed_by: user.id
    })

    // Also log the project contract update
    await supabase.from('audit_log').insert({
      entity_type: 'project',
      entity_id: changeOrder.project_id,
      action: 'update_contract',
      changes: {
        revised_contract: {
          from: changeOrder.project.revised_contract || changeOrder.project.original_contract,
          to: newRevisedContract
        },
        change_order_id: changeOrderId,
        change_order_number: changeOrder.co_number
      },
      performed_by: user.id
    })

    return NextResponse.json({
      success: true,
      changeOrder: {
        id: changeOrder.id,
        co_number: changeOrder.co_number,
        status: 'approved',
        approved_by: user.id,
        approved_date: new Date().toISOString()
      },
      project: {
        id: changeOrder.project_id,
        revised_contract: newRevisedContract
      }
    })
  } catch (error) {
    console.error('Change order approval error:', error)
    return NextResponse.json(
      { error: 'Failed to approve change order' },
      { status: 500 }
    )
  }
}