import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/purchase-orders/[id]/forecast - Update PO forecast and risk status
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

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only ops_manager and controller can update forecasts
    if (!profile || !['ops_manager', 'controller'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get request body
    const body = await request.json()
    const { risk_status, reason } = body

    // Validate risk_status
    if (risk_status && !['normal', 'at-risk', 'over-budget'].includes(risk_status)) {
      return NextResponse.json({ error: 'Invalid risk status' }, { status: 400 })
    }

    // Get current PO to record the change
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('risk_status')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Update PO if risk_status provided
    if (risk_status && risk_status !== currentPO.risk_status) {
      // Update the PO
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ 
          risk_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) {
        console.error('Update PO error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      // Log the change to forecast history
      const { error: historyError } = await supabase
        .from('po_forecast_history')
        .insert({
          purchase_order_id: id,
          changed_by: user.id,
          change_date: new Date().toISOString(),
          field_name: 'risk_status',
          old_value: currentPO.risk_status,
          new_value: risk_status,
          reason: reason || null
        })

      if (historyError) {
        console.error('History insert error:', historyError)
        // Don't fail the request if history insert fails
      }
    }

    // Fetch updated PO with all details
    const { data: updatedPO, error: finalError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        project:projects!purchase_orders_project_id_fkey(
          id,
          job_number,
          name
        ),
        po_forecast_history(
          id,
          changed_by,
          change_date,
          field_name,
          old_value,
          new_value,
          reason,
          changed_by_user:profiles!po_forecast_history_changed_by_fkey(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('id', id)
      .single()

    if (finalError) {
      console.error('Final fetch error:', finalError)
      return NextResponse.json({ error: finalError.message }, { status: 400 })
    }

    return NextResponse.json({ 
      purchase_order: updatedPO,
      message: 'Forecast updated successfully' 
    })
  } catch (error) {
    console.error('Update PO forecast error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}