import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { status } = await req.json()
    
    // Validate status
    const validStatuses = ['active', 'on_hold', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update project status
    const { data: project, error } = await supabase
      .from('projects')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating project status:', error)
      return NextResponse.json(
        { error: 'Failed to update project status' },
        { status: 500 }
      )
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Log the status change in audit log
    await supabase
      .from('audit_log')
      .insert({
        table_name: 'projects',
        record_id: id,
        action: 'status_update',
        user_id: user.id,
        old_values: { status: project.status },
        new_values: { status },
        changed_by: user.email
      })

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Error in project status update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}