import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/projects/[id]/purchase-orders - List POs for a specific project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project exists and user has access
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const vendor = searchParams.get('vendor')

    // Build query
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        created_by_user:profiles!purchase_orders_created_by_fkey(id, first_name, last_name),
        approved_by_user:profiles!purchase_orders_approved_by_fkey(id, first_name, last_name),
        po_line_items(count)
      `)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    
    if (vendor) {
      query = query.ilike('vendor_name', `%${vendor}%`)
    }

    const { data: purchaseOrders, error } = await query

    if (error) {
      console.error('List project POs error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate summary statistics
    const summary = {
      totalPOs: purchaseOrders?.length || 0,
      totalCommitted: 0,
      totalInvoiced: 0,
      totalRemaining: 0,
      byStatus: {
        draft: 0,
        approved: 0,
        closed: 0,
        cancelled: 0
      }
    }

    if (purchaseOrders) {
      purchaseOrders.forEach(po => {
        summary.totalCommitted += po.committed_amount || 0
        summary.totalInvoiced += po.invoiced_amount || 0
        if (po.status && po.status in summary.byStatus) {
          summary.byStatus[po.status as keyof typeof summary.byStatus]++
        }
      })
      summary.totalRemaining = summary.totalCommitted - summary.totalInvoiced
    }

    return NextResponse.json({
      project,
      purchase_orders: purchaseOrders || [],
      summary
    })
  } catch (error) {
    console.error('List project purchase orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}