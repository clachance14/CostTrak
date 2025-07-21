import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { divisionBusinessRules } from '@/lib/division-business-rules'

// GET /api/projects/[id]/divisions/alerts - Get division alerts for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const divisionId = searchParams.get('division_id')
    const severity = searchParams.get('severity')

    // Check project alerts
    let alerts = await divisionBusinessRules.checkProjectDivisionRules(id)

    // Filter by division if specified
    if (divisionId) {
      alerts = alerts.filter(alert => alert.division_id === divisionId)
    }

    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity)
    }

    // Get division names for better display
    const divisionIds = [...new Set(alerts.map(a => a.division_id))]
    const { data: divisions } = await supabase
      .from('divisions')
      .select('id, name, code')
      .in('id', divisionIds)

    // Enhance alerts with division info
    const enhancedAlerts = alerts.map(alert => {
      const division = divisions?.find(d => d.id === alert.division_id)
      return {
        ...alert,
        division_name: division ? `${division.name} (${division.code})` : 'Unknown'
      }
    })

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    enhancedAlerts.sort((a, b) => 
      severityOrder[a.severity as keyof typeof severityOrder] - 
      severityOrder[b.severity as keyof typeof severityOrder]
    )

    return NextResponse.json({ 
      alerts: enhancedAlerts,
      summary: {
        total: enhancedAlerts.length,
        critical: enhancedAlerts.filter(a => a.severity === 'critical').length,
        high: enhancedAlerts.filter(a => a.severity === 'high').length,
        medium: enhancedAlerts.filter(a => a.severity === 'medium').length,
        low: enhancedAlerts.filter(a => a.severity === 'low').length
      }
    })
  } catch (error) {
    console.error('Get division alerts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/divisions/alerts - Create notification triggers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['controller', 'executive'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Only controllers and executives can create alert triggers' },
        { status: 403 }
      )
    }

    const { division_id } = await request.json()

    if (division_id) {
      // Create triggers for specific division
      await divisionBusinessRules.createDivisionNotificationTriggers(id, division_id)
    } else {
      // Create triggers for all project divisions
      const { data: divisions } = await supabase
        .from('project_divisions')
        .select('division_id')
        .eq('project_id', id)

      if (divisions) {
        for (const division of divisions) {
          await divisionBusinessRules.createDivisionNotificationTriggers(id, division.division_id)
        }
      }
    }

    return NextResponse.json({ 
      message: 'Notification triggers created successfully' 
    })
  } catch (error) {
    console.error('Create division alert triggers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}