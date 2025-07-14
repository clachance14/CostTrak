import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders/[id] - Get single PO (read-only)
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

    // Fetch PO with all related data
    const { data: purchaseOrder, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        project:projects!purchase_orders_project_id_fkey(
          id,
          job_number,
          name,
          status,
          division:divisions!projects_division_id_fkey(id, name, code),
          client:clients!projects_client_id_fkey(id, name),
          project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
        ),
        created_by_user:profiles!purchase_orders_created_by_fkey(id, first_name, last_name, email),
        approved_by_user:profiles!purchase_orders_approved_by_fkey(id, first_name, last_name, email),
        po_line_items(
          id,
          line_number,
          description,
          quantity,
          unit_price,
          total_amount,
          created_at,
          updated_at
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
      .is('deleted_at', null)
      .order('change_date', { foreignTable: 'po_forecast_history', ascending: false })
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
      }
      console.error('Get PO error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate line items total if they exist
    let lineItemsTotal = 0
    if (purchaseOrder.po_line_items && purchaseOrder.po_line_items.length > 0) {
      lineItemsTotal = purchaseOrder.po_line_items.reduce(
        (sum: number, item: { total_amount?: number }) => sum + (item.total_amount || 0), 
        0
      )
    }

    // Add calculated fields
    const enrichedPO = {
      ...purchaseOrder,
      calculated: {
        lineItemsTotal,
        variance: purchaseOrder.committed_amount - lineItemsTotal,
        invoicedPercentage: purchaseOrder.committed_amount > 0 
          ? (purchaseOrder.invoiced_amount / purchaseOrder.committed_amount) * 100 
          : 0,
        remainingAmount: purchaseOrder.committed_amount - purchaseOrder.invoiced_amount
      }
    }

    return NextResponse.json({ purchase_order: enrichedPO })
  } catch (error) {
    console.error('Get purchase order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}