import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// Validation schema for updating PO
const updatePOSchema = z.object({
  committed_amount: z.number().min(0).optional(),
  forecast_amount: z.number().min(0).optional(),
  vendor_name: z.string().optional(),
  description: z.string().optional()
})

// GET /api/purchase-orders/[id] - Get single PO (read-only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('GET handler called for purchase-orders/[id]')
  const { id } = await params
  console.log('GET PO ID:', id)
  
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
          project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name, email)
        ),
        po_line_items(
          id,
          line_number,
          description,
          quantity,
          unit_of_measure,
          unit_price,
          total_amount,
          category,
          invoice_number,
          invoice_date,
          contract_extra_type,
          created_at
        ),
        created_by:profiles!purchase_orders_created_by_fkey(first_name, last_name, email),
        approved_by:profiles!purchase_orders_approved_by_fkey(first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Get PO error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Calculate invoiced amount from line items
    const invoicedAmount = purchaseOrder.po_line_items?.reduce(
      (sum: number, item: any) => sum + (item.total_amount || 0),
      0
    ) || 0

    // Calculate invoice percentage
    const invoicePercentage = purchaseOrder.committed_amount > 0
      ? Math.round((invoicedAmount / purchaseOrder.committed_amount) * 100)
      : 0

    // Get last invoice date
    const lastInvoiceDate = purchaseOrder.po_line_items?.reduce(
      (latest: Date | null, item: any) => {
        if (!item.invoice_date) return latest
        const itemDate = new Date(item.invoice_date)
        return !latest || itemDate > latest ? itemDate : latest
      },
      null
    )

    // Enrich the PO with calculated fields
    const enrichedPO = {
      ...purchaseOrder,
      invoiced_amount: invoicedAmount,
      invoice_percentage: invoicePercentage,
      last_invoice_date: lastInvoiceDate,
      remaining_amount: purchaseOrder.committed_amount - invoicedAmount,
      is_over_invoiced: invoicedAmount > purchaseOrder.committed_amount,
      summary: {
        lineItemCount: purchaseOrder.po_line_items?.length || 0,
        totalCommitted: purchaseOrder.committed_amount,
        totalInvoiced: invoicedAmount,
        remainingAmount: purchaseOrder.committed_amount - invoicedAmount
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

// PUT /api/purchase-orders/[id] - Update PO fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('PUT handler called for purchase-orders/[id]')
  const { id } = await params
  console.log('PO ID:', id)
  
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    console.log('Request body:', body)
    
    const validationResult = updatePOSchema.safeParse(body)
    console.log('Validation result:', validationResult)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Check if PO exists - use adminSupabase to bypass RLS
    const { data: existingPO, error: fetchError } = await adminSupabase
      .from('purchase_orders')
      .select('id, committed_amount, po_value, project_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching PO:', {
        error: fetchError,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      })
    }

    if (fetchError || !existingPO) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Update the PO
    const { data: updatedPO, error: updateError } = await adminSupabase
      .from('purchase_orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update PO error:', {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      })
      return NextResponse.json({ 
        error: updateError.message,
        details: updateError.details,
        hint: updateError.hint 
      }, { status: 400 })
    }

    // Log the change in audit log
    if (updateData.committed_amount !== undefined && updateData.committed_amount !== existingPO.committed_amount) {
      await adminSupabase.from('audit_log').insert({
        entity_type: 'purchase_orders',
        entity_id: id,
        action: 'UPDATE',
        changes: {
          old_values: { committed_amount: existingPO.committed_amount },
          new_values: { committed_amount: updateData.committed_amount }
        },
        performed_by: user.id
      })
    }

    return NextResponse.json({ purchase_order: updatedPO })
  } catch (error) {
    console.error('Update purchase order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}