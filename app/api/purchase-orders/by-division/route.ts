import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders/by-division - List POs with division filtering
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
    const limit = searchParams.get('limit') === 'all' ? null : parseInt(searchParams.get('limit') || '20')
    const project_id = searchParams.get('project_id')
    const division_id = searchParams.get('division_id')
    const sort_by = searchParams.get('sort_by')
    const sort_direction = searchParams.get('sort_direction')
    const search = searchParams.get('search')
    
    // Get user's accessible divisions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    // Build base query with division information
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        project:projects(
          id,
          job_number,
          name,
          division:divisions(id, name, code)
        ),
        division:divisions(id, name, code),
        cost_code:cost_codes(
          id,
          code,
          description,
          category,
          discipline
        ),
        created_by_user:profiles!purchase_orders_created_by_fkey(
          id,
          first_name,
          last_name,
          division_id
        )
      `, { count: 'exact' })

    // Apply division-based access control
    if (userProfile?.role === 'ops_manager' && userProfile.division_id) {
      // Ops managers only see their division's POs
      query = query.eq('division_id', userProfile.division_id)
    } else if (userProfile?.role === 'project_manager') {
      // Project managers see POs for divisions they manage
      const { data: managedDivisions } = await supabase
        .from('project_divisions')
        .select('division_id, project_id')
        .eq('division_pm_id', user.id)

      if (managedDivisions && managedDivisions.length > 0) {
        const divisionIds = [...new Set(managedDivisions.map(d => d.division_id))]
        const projectIds = [...new Set(managedDivisions.map(d => d.project_id))]
        
        query = query.or(`division_id.in.(${divisionIds.join(',')}),project_id.in.(${projectIds.join(',')})`)
      }
    }
    // Controllers and executives see all POs (no additional filtering)

    // Apply filters
    if (project_id) {
      query = query.eq('project_id', project_id)
    }
    
    if (division_id) {
      query = query.eq('division_id', division_id)
    }

    // Apply search
    if (search) {
      query = query.or(`po_number.ilike.%${search}%,vendor_name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply sorting
    if (sort_by && sort_direction) {
      const ascending = sort_direction === 'asc'
      query = query.order(sort_by, { ascending, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    if (limit !== null) {
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)
    }

    // Execute query
    const { data: purchaseOrders, error, count } = await query

    if (error) {
      console.error('Error fetching purchase orders:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get division summaries if requested
    const includeSummary = searchParams.get('include_summary') === 'true'
    let divisionSummary = null

    if (includeSummary && project_id) {
      const { data: summary } = await supabase
        .from('division_cost_summary')
        .select('*')
        .eq('project_id', project_id)

      divisionSummary = summary
    }

    return NextResponse.json({ 
      purchaseOrders: purchaseOrders || [],
      count: count || 0,
      page,
      limit: limit || 20,
      divisionSummary
    })
  } catch (error) {
    console.error('Get purchase orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/purchase-orders/by-division - Create PO with division assignment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { division_id, ...poData } = body

    // Get user profile with division
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    // Determine division_id if not provided
    let assignedDivisionId = division_id

    if (!assignedDivisionId) {
      // Use user's division if they have one
      if (userProfile?.division_id) {
        assignedDivisionId = userProfile.division_id
      } else if (poData.project_id) {
        // Otherwise use project's lead division
        const { data: leadDivision } = await supabase
          .from('project_divisions')
          .select('division_id')
          .eq('project_id', poData.project_id)
          .eq('is_lead_division', true)
          .single()

        assignedDivisionId = leadDivision?.division_id
      }
    }

    // Verify user can create PO for this division
    if (userProfile?.role === 'ops_manager' && userProfile.division_id !== assignedDivisionId) {
      return NextResponse.json(
        { error: 'You can only create POs for your division' },
        { status: 403 }
      )
    }

    if (userProfile?.role === 'project_manager') {
      // Check if PM manages this division in the project
      const { data: projectDivision } = await supabase
        .from('project_divisions')
        .select('division_pm_id')
        .eq('project_id', poData.project_id)
        .eq('division_id', assignedDivisionId)
        .single()

      if (projectDivision?.division_pm_id !== user.id) {
        return NextResponse.json(
          { error: 'You can only create POs for divisions you manage' },
          { status: 403 }
        )
      }
    }

    // Create PO with division assignment
    const { data: purchaseOrder, error } = await supabase
      .from('purchase_orders')
      .insert({
        ...poData,
        division_id: assignedDivisionId,
        created_by: user.id,
        status: 'draft'
      })
      .select(`
        *,
        project:projects(id, job_number, name),
        division:divisions(id, name, code)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    console.error('Create purchase order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/purchase-orders/by-division - Bulk update division assignments
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only controllers can bulk reassign divisions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userProfile?.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can bulk reassign PO divisions' },
        { status: 403 }
      )
    }

    const { po_ids, division_id } = await request.json()

    if (!po_ids || !Array.isArray(po_ids) || po_ids.length === 0) {
      return NextResponse.json(
        { error: 'po_ids array is required' },
        { status: 400 }
      )
    }

    if (!division_id) {
      return NextResponse.json(
        { error: 'division_id is required' },
        { status: 400 }
      )
    }

    // Update POs
    const { data: updatedPOs, error } = await supabase
      .from('purchase_orders')
      .update({ 
        division_id,
        updated_at: new Date().toISOString()
      })
      .in('id', po_ids)
      .select('id, po_number, division_id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log audit trail
    await supabase
      .from('audit_log')
      .insert({
        entity_type: 'purchase_orders_bulk',
        entity_id: division_id,
        action: 'reassign_division',
        changes: {
          po_ids,
          new_division_id: division_id,
          affected_count: updatedPOs?.length || 0
        },
        performed_by: user.id
      })

    return NextResponse.json({ 
      message: `${updatedPOs?.length || 0} POs reassigned to division`,
      updatedPOs 
    })
  } catch (error) {
    console.error('Bulk update PO divisions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}