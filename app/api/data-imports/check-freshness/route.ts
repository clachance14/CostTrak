import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { projectIds } = body

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Project IDs array is required' },
        { status: 400 }
      )
    }

    // Get all projects with their data health info
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        job_number,
        data_health_status,
        last_labor_import_at,
        last_po_import_at,
        status
      `)
      .in('id', projectIds)
      .in('status', ['active', 'planning'])

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate freshness for each project
    const now = new Date()
    const staleThresholdDays = 7
    const staleThreshold = new Date(now.getTime() - staleThresholdDays * 24 * 60 * 60 * 1000)

    const results = projects.map(project => {
      const lastLaborImport = project.last_labor_import_at ? new Date(project.last_labor_import_at) : null
      const lastPoImport = project.last_po_import_at ? new Date(project.last_po_import_at) : null

      const isLaborStale = !lastLaborImport || lastLaborImport < staleThreshold
      const isPoStale = !lastPoImport || lastPoImport < staleThreshold

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

      return {
        project_id: project.id,
        name: project.name,
        job_number: project.job_number,
        health_status: healthStatus,
        health_issues: healthIssues,
        labor_days_old: lastLaborImport ? Math.floor((now.getTime() - lastLaborImport.getTime()) / (24 * 60 * 60 * 1000)) : null,
        po_days_old: lastPoImport ? Math.floor((now.getTime() - lastPoImport.getTime()) / (24 * 60 * 60 * 1000)) : null
      }
    })

    // Update health status for projects that need it
    const projectsToUpdate = results.filter(r => r.health_status !== projects.find(p => p.id === r.project_id)?.data_health_status)
    
    if (projectsToUpdate.length > 0) {
      for (const project of projectsToUpdate) {
        await supabase
          .from('projects')
          .update({
            data_health_status: project.health_status,
            data_health_checked_at: now.toISOString()
          })
          .eq('id', project.project_id)
      }
    }

    // Check and create notifications for stale/missing data
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const projectsNeedingAttention = results.filter(r => r.health_status !== 'current')
      
      for (const project of projectsNeedingAttention) {
        // Check if notification was already sent recently
        const { data: recentNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .ilike('message', `%${project.job_number}%`)
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .single()

        if (!recentNotification) {
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              title: 'Data Update Required',
              message: `Project ${project.job_number} - ${project.name}: ${project.health_issues.join(', ')}`
            })
        }
      }
    }

    return NextResponse.json({
      checked_at: now.toISOString(),
      projects: results,
      summary: {
        total: results.length,
        current: results.filter(r => r.health_status === 'current').length,
        stale: results.filter(r => r.health_status === 'stale').length,
        missing: results.filter(r => r.health_status === 'missing').length
      }
    })
  } catch (error) {
    console.error('Error in check freshness POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}