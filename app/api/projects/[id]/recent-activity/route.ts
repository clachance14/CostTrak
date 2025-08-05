import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const projectId = params.id
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent activities (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const activities: any[] = []

    // Get recent change orders
    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select('id, change_order_number, description, amount, status, created_at, updated_at')
      .eq('project_id', projectId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    changeOrders?.forEach(co => {
      activities.push({
        id: `co-${co.id}`,
        type: 'change_order',
        title: `Change Order #${co.change_order_number} ${co.status}`,
        timestamp: co.status === 'approved' ? co.updated_at : co.created_at,
        metadata: {
          amount: co.amount,
          status: co.status,
          description: co.description
        }
      })
    })

    // Get recent data imports
    const { data: imports } = await supabase
      .from('data_imports')
      .select('id, import_type, file_name, status, created_at, records_imported')
      .eq('project_id', projectId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    imports?.forEach(imp => {
      const typeMap: Record<string, string> = {
        'labor': 'Labor data',
        'purchase_order': 'Purchase orders',
        'budget': 'Budget',
        'employee': 'Employee data'
      }
      
      activities.push({
        id: `import-${imp.id}`,
        type: 'import',
        title: `${typeMap[imp.import_type] || imp.import_type} imported${imp.file_name ? ` from ${imp.file_name}` : ''}`,
        timestamp: imp.created_at,
        metadata: {
          recordsImported: imp.records_imported,
          status: imp.status,
          fileName: imp.file_name
        }
      })
    })

    // Add alerts based on business rules
    // Check for budget overruns
    const { data: project } = await supabase
      .from('projects')
      .select('original_contract, revised_contract')
      .eq('id', projectId)
      .single()

    if (project) {
      // Get total committed
      const { data: poSum } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('project_id', projectId)
        .eq('status', 'approved')

      const totalPOs = poSum?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0

      const { data: laborSum } = await supabase
        .from('labor_employee_actuals')
        .select('actual_cost_with_burden')
        .eq('project_id', projectId)

      const totalLabor = laborSum?.reduce((sum, la) => sum + (la.actual_cost_with_burden || 0), 0) || 0
      const totalCommitted = totalPOs + totalLabor
      const budget = project.revised_contract || project.original_contract || 0

      if (budget > 0 && totalCommitted > budget * 0.9) {
        activities.push({
          id: 'alert-budget-90',
          type: 'alert',
          title: 'Budget usage exceeds 90%',
          timestamp: new Date().toISOString(),
          metadata: {
            severity: 'high',
            percentage: ((totalCommitted / budget) * 100).toFixed(1)
          }
        })
      }

      // Check for recent PO spikes
      const { data: recentPOs } = await supabase
        .from('purchase_orders')
        .select('total_amount, created_at')
        .eq('project_id', projectId)
        .gte('created_at', sevenDaysAgo.toISOString())

      const recentPOTotal = recentPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0
      if (recentPOTotal > budget * 0.1) {
        activities.push({
          id: 'alert-po-spike',
          type: 'alert',
          title: 'High PO activity in last 7 days',
          timestamp: new Date().toISOString(),
          metadata: {
            severity: 'medium',
            amount: recentPOTotal
          }
        })
      }
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Return top 10 activities
    return NextResponse.json({
      activities: activities.slice(0, 10)
    })
  } catch (error) {
    console.error('Recent activity error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}