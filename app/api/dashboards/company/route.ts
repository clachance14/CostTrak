import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details with role
  const { data: userDetails, error: userDetailsError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userDetailsError || !userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Only controller and executive can view company dashboard
  if (!['controller', 'executive'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get active projects count
    const { count: activeProjectsCount, error: activeError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null)

    if (activeError) throw activeError

    // Get total backlog (sum of revised contracts for active projects)
    const { data: backlogData, error: backlogError } = await supabase
      .from('projects')
      .select('revised_contract')
      .eq('status', 'active')
      .is('deleted_at', null)

    if (backlogError) throw backlogError

    const totalBacklog = backlogData?.reduce((sum, p) => sum + (p.revised_contract || 0), 0) || 0

    // Get company financial metrics from latest snapshots
    const { data: financialMetrics, error: metricsError } = await supabase
      .from('financial_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)

    if (metricsError) throw metricsError

    // Calculate average margin across active projects
    const { data: marginData, error: marginError } = await supabase
      .from('projects')
      .select('id, original_contract, revised_contract')
      .eq('status', 'active')
      .is('deleted_at', null)

    if (marginError) throw marginError

    // Get recent PO committed costs
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('committed_amount')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (poError) throw poError

    const recentCommittedCosts = poData?.reduce((sum, po) => sum + (po.committed_amount || 0), 0) || 0

    // Calculate average margin (simplified - in real world would use actual costs)
    const avgMargin = marginData && marginData.length > 0
      ? marginData.reduce((sum, p) => {
          const revenue = p.revised_contract || p.original_contract || 0
          const estimatedCost = revenue * 0.8 // Simplified 20% margin assumption
          const margin = revenue > 0 ? ((revenue - estimatedCost) / revenue) * 100 : 0
          return sum + margin
        }, 0) / marginData.length
      : 0

    // Get division breakdown
    const { data: divisionData, error: divisionError } = await supabase
      .from('projects')
      .select(`
        division_id,
        revised_contract,
        divisions!inner(
          name,
          code
        )
      `)
      .eq('status', 'active')
      .is('deleted_at', null)

    if (divisionError) throw divisionError

    // Group by division
    const divisionBreakdown = divisionData?.reduce((acc: Record<string, { name: string; projectCount: number; totalValue: number }>, project) => {
      const division = project.divisions as { name?: string; code?: string }
      const divisionName = division?.name || 'Unknown'
      if (!acc[divisionName]) {
        acc[divisionName] = {
          name: divisionName,
          projectCount: 0,
          totalValue: 0
        }
      }
      acc[divisionName].projectCount++
      acc[divisionName].totalValue += project.revised_contract || 0
      return acc
    }, {})

    // Get project status distribution
    const { data: statusData, error: statusError } = await supabase
      .from('projects')
      .select('status')
      .is('deleted_at', null)

    if (statusError) throw statusError

    const statusDistribution = statusData?.reduce((acc: Record<string, number>, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, {}) || {}

    // Get top 5 projects by value
    const { data: topProjects, error: topError } = await supabase
      .from('projects')
      .select(`
        id,
        job_number,
        name,
        revised_contract,
        status,
        project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name)
      `)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('revised_contract', { ascending: false })
      .limit(5)

    if (topError) throw topError

    const response = {
      data: {
        overview: {
          activeProjects: activeProjectsCount || 0,
          totalBacklog,
          averageMargin: Math.round(avgMargin * 100) / 100,
          recentCommittedCosts,
          lastUpdated: new Date().toISOString()
        },
        divisionBreakdown: Object.values(divisionBreakdown || {}),
        statusDistribution,
        topProjects: topProjects?.map(p => ({
          id: p.id,
          jobNumber: p.job_number,
          name: p.name,
          value: p.revised_contract,
          status: p.status,
          projectManager: (p.project_manager && typeof p.project_manager === 'object' && 'first_name' in p.project_manager)
            ? `${(p.project_manager as unknown as { first_name: string; last_name: string }).first_name} ${(p.project_manager as unknown as { first_name: string; last_name: string }).last_name}`
            : 'Unassigned'
        })) || [],
        financialSnapshot: financialMetrics?.[0] || null
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Company dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}