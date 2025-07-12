import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the snapshot with related data
    const { data: snapshot, error } = await supabase
      .from('financial_snapshots')
      .select(`
        *,
        project:projects(
          id,
          job_number,
          name,
          division_id,
          project_manager_id
        ),
        division:divisions(name, code)
      `)
      .eq('id', id)
      .single()

    if (error || !snapshot) {
      return NextResponse.json(
        { error: 'Financial snapshot not found' },
        { status: 404 }
      )
    }

    // Check user access
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Apply role-based access control
    if (userProfile.role === 'ops_manager') {
      // Ops managers can only see their division's snapshots
      if (snapshot.division_id !== userProfile.division_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    } else if (userProfile.role === 'project_manager') {
      // Project managers can only see their projects' snapshots
      if (snapshot.project && snapshot.project.project_manager_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    } else if (!['controller', 'executive', 'accounting'].includes(userProfile.role)) {
      // Other roles have limited access
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ data: snapshot })
  } catch (error) {
    console.error('Error fetching financial snapshot:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid snapshot ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}