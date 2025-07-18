import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { projectId } = await params

    // Get project with data health status
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        job_number,
        data_health_status,
        data_health_checked_at,
        last_labor_import_at,
        last_po_import_at,
        status
      `)
      .eq('id', projectId)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      console.error('Error fetching project:', projectError)
      return NextResponse.json({ error: projectError.message }, { status: 500 })
    }

    // Get recent imports for this project
    const { data: recentImports, error: importsError } = await supabase
      .from('data_imports')
      .select(`
        id,
        import_type,
        import_status,
        imported_at,
        imported_by_user:profiles!imported_by(id, first_name, last_name)
      `)
      .eq('project_id', projectId)
      .eq('import_status', 'success')
      .order('imported_at', { ascending: false })
      .limit(10)

    if (importsError) {
      console.error('Error fetching recent imports:', importsError)
    }

    // Calculate data freshness
    const now = new Date()
    const staleThresholdDays = 7
    const staleThreshold = new Date(now.getTime() - staleThresholdDays * 24 * 60 * 60 * 1000)

    const lastLaborImport = project.last_labor_import_at ? new Date(project.last_labor_import_at) : null
    const lastPoImport = project.last_po_import_at ? new Date(project.last_po_import_at) : null

    const isLaborStale = !lastLaborImport || lastLaborImport < staleThreshold
    const isPoStale = !lastPoImport || lastPoImport < staleThreshold

    // Determine overall health status
    let healthStatus = 'current'
    const healthIssues = []

    if (!lastLaborImport || !lastPoImport) {
      healthStatus = 'missing'
      if (!lastLaborImport) healthIssues.push('No labor data imported')
      if (!lastPoImport) healthIssues.push('No PO data imported')
    } else if (isLaborStale || isPoStale) {
      healthStatus = 'stale'
      if (isLaborStale) healthIssues.push('Labor data is stale')
      if (isPoStale) healthIssues.push('PO data is stale')
    }

    // Update project health status if needed
    if (healthStatus !== project.data_health_status) {
      await supabase
        .from('projects')
        .update({
          data_health_status: healthStatus,
          data_health_checked_at: now.toISOString()
        })
        .eq('id', projectId)
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        job_number: project.job_number,
        status: project.status
      },
      health: {
        status: healthStatus,
        issues: healthIssues,
        last_checked: now.toISOString(),
        labor: {
          last_import: lastLaborImport?.toISOString() || null,
          is_stale: isLaborStale,
          days_since_import: lastLaborImport ? Math.floor((now.getTime() - lastLaborImport.getTime()) / (24 * 60 * 60 * 1000)) : null
        },
        po: {
          last_import: lastPoImport?.toISOString() || null,
          is_stale: isPoStale,
          days_since_import: lastPoImport ? Math.floor((now.getTime() - lastPoImport.getTime()) / (24 * 60 * 60 * 1000)) : null
        }
      },
      recent_imports: recentImports || []
    })
  } catch (error) {
    console.error('Error in data health GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}