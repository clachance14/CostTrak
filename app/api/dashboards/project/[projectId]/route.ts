import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient()
  const { projectId } = await params
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details with role
  const { data: userDetails, error: userDetailsError } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single()

  if (userDetailsError || !userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    // Get project details with related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        client:clients!inner(*),
        division:divisions!inner(*),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        created_by_user:profiles!projects_created_by_fkey(first_name, last_name)
      `)
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check permissions
    const canViewAllProjects = ['controller', 'executive', 'ops_manager', 'accounting'].includes(userDetails.role)
    const isProjectManager = userDetails.role === 'project_manager' && project.project_manager_id === user.id
    const isViewer = userDetails.role === 'viewer'
    
    // For viewer role, check if they have access to this specific project
    if (isViewer) {
      // For now, skip viewer access check as project_viewer_access table doesn't exist
      // TODO: Implement proper viewer access control using project_assignments table
      /*
      const { data: viewerAccess } = await supabase
        .from('project_viewer_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .single()
      
      if (!viewerAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      */
      return NextResponse.json({ error: 'Viewer access not implemented' }, { status: 403 })
    } else if (!canViewAllProjects && !isProjectManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get purchase orders summary
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, vendor_name, committed_amount, invoiced_amount, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (poError) throw poError

    const poSummary = poData?.reduce((acc, po) => ({
      totalPOs: acc.totalPOs + 1,
      totalCommitted: acc.totalCommitted + (po.committed_amount || 0),
      totalInvoiced: acc.totalInvoiced + (po.invoiced_amount || 0),
      byStatus: {
        ...acc.byStatus,
        [po.status as string]: (acc.byStatus[po.status as string] || 0) + 1
      }
    }), {
      totalPOs: 0,
      totalCommitted: 0,
      totalInvoiced: 0,
      byStatus: {} as Record<string, number>
    }) || { totalPOs: 0, totalCommitted: 0, totalInvoiced: 0, byStatus: {} }

    // Get change orders
    const { data: changeOrders, error: coError } = await supabase
      .from('change_orders')
      .select('id, co_number, description, amount, status, impact_schedule_days, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (coError) throw coError

    const approvedCOAmount = changeOrders
      ?.filter(co => co.status === 'approved')
      .reduce((sum, co) => sum + (co.amount || 0), 0) || 0

    // Get labor actuals from employee actuals (includes burden)
    const { data: laborData, error: laborError } = await supabase
      .from('labor_employee_actuals')
      .select('total_hours, total_cost_with_burden, employees!inner(category)')
      .eq('project_id', projectId)

    if (laborError) {
      console.log('Labor actuals error:', laborError)
    }

    // Get per diem costs
    const { data: perDiemData, error: perDiemError } = await supabase
      .from('per_diem_costs')
      .select('amount, employee_type')
      .eq('project_id', projectId)

    if (perDiemError) {
      console.log('Per diem error:', perDiemError)
    }

    // Calculate labor costs including per diem
    const laborSummary = {
      totalActualHours: 0,
      totalActualCost: 0,
      totalForecastedHours: 0,
      totalForecastedCost: 0,
      directLaborCost: 0,
      indirectLaborCost: 0,
      directPerDiem: 0,
      indirectPerDiem: 0
    }

    // Add labor actuals
    laborData?.forEach(labor => {
      laborSummary.totalActualHours += labor.total_hours || 0
      const cost = labor.total_cost_with_burden || 0
      laborSummary.totalActualCost += cost
      
      const category = labor.employees?.category?.toLowerCase() || 'direct'
      if (category === 'indirect') {
        laborSummary.indirectLaborCost += cost
      } else {
        laborSummary.directLaborCost += cost
      }
    })

    // Add per diem costs
    perDiemData?.forEach(perDiem => {
      const amount = perDiem.amount || 0
      laborSummary.totalActualCost += amount
      
      if (perDiem.employee_type === 'Direct') {
        laborSummary.directPerDiem += amount
        laborSummary.directLaborCost += amount
      } else if (perDiem.employee_type === 'Indirect') {
        laborSummary.indirectPerDiem += amount
        laborSummary.indirectLaborCost += amount
      }
    })

    // Calculate financial metrics
    const originalContract = project.original_contract || 0
    const revisedContract = project.revised_contract || originalContract
    const committedCosts = poSummary.totalCommitted
    const actualCosts = poSummary.totalInvoiced + laborSummary.totalActualCost
    const forecastedCosts = committedCosts + laborSummary.totalForecastedCost
    const estimatedProfit = revisedContract - forecastedCosts
    const marginPercent = revisedContract > 0 ? (estimatedProfit / revisedContract) * 100 : 0
    const percentComplete = revisedContract > 0 ? (actualCosts / revisedContract) * 100 : 0

    // Get recent activity
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_log')
      .select('action, entity_type, entity_id, changes, created_at, performed_by')
      .eq('entity_id', projectId)
      .eq('entity_type', 'project')
      .order('created_at', { ascending: false })
      .limit(10)

    if (auditError) throw auditError

    // Build response
    const response = {
      data: {
        project: {
          id: project.id,
          jobNumber: project.job_number,
          name: project.name,
          status: project.status,
          description: project.description,
          address: project.address,
          city: project.city,
          state: project.state,
          zipCode: project.zip_code,
          startDate: project.start_date,
          endDate: project.end_date,
          client: {
            id: project.client.id,
            name: project.client.name
          },
          division: {
            id: project.division.id,
            name: project.division.name,
            code: project.division.code
          },
          projectManager: project.project_manager ? {
            id: project.project_manager.id,
            name: `${project.project_manager.first_name} ${project.project_manager.last_name}`,
            email: project.project_manager.email
          } : null,
          createdBy: project.created_by_user ? 
            `${project.created_by_user.first_name} ${project.created_by_user.last_name}` : 'Unknown',
          createdAt: project.created_at,
          updatedAt: project.updated_at
        },
        financialSummary: {
          originalContract,
          changeOrders: approvedCOAmount,
          revisedContract,
          committedCosts,
          invoicedAmount: poSummary.totalInvoiced,
          actualCosts,
          forecastedCosts,
          estimatedProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
          percentComplete: Math.round(percentComplete * 100) / 100,
          remainingBudget: revisedContract - committedCosts
        },
        purchaseOrders: {
          summary: poSummary,
          recent: poData?.slice(0, 5).map(po => ({
            id: po.id,
            poNumber: po.po_number,
            vendor: po.vendor_name,
            amount: po.committed_amount,
            invoiced: po.invoiced_amount,
            status: po.status,
            issueDate: po.created_at
          })) || []
        },
        changeOrders: {
          total: changeOrders?.length || 0,
          approvedAmount: approvedCOAmount,
          recent: changeOrders?.slice(0, 5).map(co => ({
            id: co.id,
            coNumber: co.co_number,
            description: co.description,
            amount: co.amount,
            status: co.status,
            scheduleImpact: co.impact_schedule_days,
            createdAt: co.created_at
          })) || []
        },
        laborForecast: laborSummary,
        labor: {
          totalActualHours: laborSummary.totalActualHours,
          totalActualCost: laborSummary.totalActualCost,
          directLaborCost: laborSummary.directLaborCost,
          indirectLaborCost: laborSummary.indirectLaborCost,
          directPerDiem: laborSummary.directPerDiem,
          indirectPerDiem: laborSummary.indirectPerDiem,
          totalPerDiem: laborSummary.directPerDiem + laborSummary.indirectPerDiem
        },
        recentActivity: auditLogs?.map(log => ({
          action: log.action,
          entityType: log.entity_type,
          changes: log.changes,
          timestamp: log.created_at,
          userId: log.performed_by
        })) || [],
        lastUpdated: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Project dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project dashboard data' },
      { status: 500 }
    )
  }
}