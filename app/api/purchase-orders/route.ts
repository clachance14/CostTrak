import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders - List all POs (read-only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const project_id = searchParams.get('project_id')
    const status = searchParams.get('status')
    const vendor = searchParams.get('vendor')
    const search = searchParams.get('search')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    // Build query with proper joins
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        project:projects!purchase_orders_project_id_fkey(
          id,
          job_number,
          name,
          division:divisions!projects_division_id_fkey(id, name, code)
        ),
        created_by_user:profiles!purchase_orders_created_by_fkey(id, first_name, last_name),
        approved_by_user:profiles!purchase_orders_approved_by_fkey(id, first_name, last_name),
        po_line_items(count)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (project_id) {
      query = query.eq('project_id', project_id)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (vendor) {
      query = query.ilike('vendor_name', `%${vendor}%`)
    }
    
    if (search) {
      query = query.or(`po_number.ilike.%${search}%,vendor_name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (date_from) {
      query = query.gte('issue_date', date_from)
    }

    if (date_to) {
      query = query.lte('issue_date', date_to)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: purchase_orders, count, error } = await query

    if (error) {
      console.error('PO list error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate aggregated stats
    let totalCommitted = 0
    let totalInvoiced = 0
    
    if (purchase_orders) {
      totalCommitted = purchase_orders.reduce((sum, po) => sum + (po.committed_amount || 0), 0)
      totalInvoiced = purchase_orders.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0)
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      purchase_orders,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      },
      summary: {
        totalCommitted,
        totalInvoiced,
        totalRemaining: totalCommitted - totalInvoiced
      }
    })
  } catch (error) {
    console.error('List purchase orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}