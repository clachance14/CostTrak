import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  const supabase = await createClient()
  const { divisionId } = await params
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details with role
  const { data: userDetails, error: userDetailsError } = await supabase
    .from('profiles')
    .select('role, division_id')
    .eq('id', user.id)
    .single()

  if (userDetailsError || !userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check permissions: controller, executive, or ops_manager (all divisions) can view any division
  // Other roles can only view their own division
  const canViewAllDivisions = ['controller', 'executive', 'ops_manager'].includes(userDetails.role)
  if (!canViewAllDivisions && userDetails.division_id !== divisionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get division details
    const { data: division, error: divisionError } = await supabase
      .from('divisions')
      .select('*')
      .eq('id', divisionId)
      .single()

    if (divisionError || !division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    // Get projects in this division
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        job_number,
        name,
        status,
        original_contract,
        revised_contract,
        start_date,
        end_date,
        client:clients!inner(name),
        project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name)
      `)
      .eq('division_id', divisionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (projectsError) throw projectsError

    // Calculate division metrics
    const activeProjects = projects?.filter(p => p.status === 'active') || []
    const totalProjects = projects?.length || 0
    const totalContractValue = projects?.reduce((sum, p) => sum + (p.revised_contract || 0), 0) || 0
    const activeContractValue = activeProjects.reduce((sum, p) => sum + (p.revised_contract || 0), 0)

    // Get PO summary for division projects
    const projectIds = projects?.map(p => p.id) || []
    let poSummary = { totalCommitted: 0, totalInvoiced: 0 }
    
    if (projectIds.length > 0) {
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('committed_amount, invoiced_amount')
        .in('project_id', projectIds)

      if (poError) throw poError

      poSummary = poData?.reduce((acc, po) => ({
        totalCommitted: acc.totalCommitted + (po.committed_amount || 0),
        totalInvoiced: acc.totalInvoiced + (po.invoiced_amount || 0)
      }), { totalCommitted: 0, totalInvoiced: 0 }) || { totalCommitted: 0, totalInvoiced: 0 }
    }

    // Get project status distribution
    const statusDistribution = projects?.reduce((acc: Record<string, number>, project) => {
      if (project.status) {
        acc[project.status] = (acc[project.status] || 0) + 1
      }
      return acc
    }, {}) || {}

    // Calculate project margins (simplified)
    const projectMetrics = projects?.map(p => {
      const revenue = p.revised_contract || p.original_contract || 0
      const estimatedCost = revenue * 0.8 // Simplified assumption
      const margin = revenue > 0 ? ((revenue - estimatedCost) / revenue) * 100 : 0
      
      return {
        id: p.id,
        jobNumber: p.job_number,
        name: p.name,
        status: p.status,
        client: (p.client && typeof p.client === 'object' && 'name' in p.client) ? (p.client as { name: string }).name : 'Unknown',
        projectManager: (p.project_manager && typeof p.project_manager === 'object' && 'first_name' in p.project_manager)
          ? `${(p.project_manager as unknown as { first_name: string; last_name: string }).first_name} ${(p.project_manager as unknown as { first_name: string; last_name: string }).last_name}`
          : 'Unassigned',
        contractValue: revenue,
        margin: Math.round(margin * 100) / 100,
        startDate: p.start_date,
        endDate: p.end_date
      }
    }) || []

    // Sort by contract value for top projects
    const topProjects = [...projectMetrics]
      .filter(p => p.status === 'active')
      .sort((a, b) => b.contractValue - a.contractValue)
      .slice(0, 10)

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: recentPOs, error: recentPOError } = await supabase
      .from('purchase_orders')
      .select('id')
      .in('project_id', projectIds)
      .gte('created_at', thirtyDaysAgo)

    if (recentPOError) throw recentPOError

    const response = {
      data: {
        division: {
          id: division.id,
          name: division.name,
          code: division.code
        },
        overview: {
          totalProjects,
          activeProjects: activeProjects.length,
          totalContractValue,
          activeContractValue,
          totalCommitted: poSummary.totalCommitted,
          totalInvoiced: poSummary.totalInvoiced,
          averageMargin: projectMetrics.length > 0
            ? Math.round(projectMetrics.reduce((sum, p) => sum + p.margin, 0) / projectMetrics.length * 100) / 100
            : 0
        },
        statusDistribution,
        topProjects,
        allProjects: projectMetrics,
        recentActivity: {
          newPOs: recentPOs?.length || 0,
          period: 'last30days'
        },
        lastUpdated: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Division dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch division dashboard data' },
      { status: 500 }
    )
  }
}