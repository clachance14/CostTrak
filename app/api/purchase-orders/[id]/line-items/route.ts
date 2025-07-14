import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders/[id]/line-items - Get line items for a PO
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

    // Verify PO exists and user has access
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, vendor_name')
      .eq('id', id)
      .single()

    if (poError || !purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Fetch line items
    const { data: lineItems, error } = await supabase
      .from('po_line_items')
      .select(`
        id,
        line_number,
        description,
        quantity,
        unit_of_measure,
        unit_price,
        total_amount,
        category,
        created_at,
        updated_at
      `)
      .eq('purchase_order_id', id)
      .order('line_number', { ascending: true })

    if (error) {
      console.error('Fetch line items error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate totals
    const totalAmount = lineItems?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0
    const totalQuantity = lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

    return NextResponse.json({ 
      purchase_order_id: id,
      po_number: purchaseOrder.po_number,
      vendor_name: purchaseOrder.vendor_name,
      line_items: lineItems || [],
      summary: {
        total_amount: totalAmount,
        total_quantity: totalQuantity,
        line_count: lineItems?.length || 0
      }
    })
  } catch (error) {
    console.error('Get line items error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}