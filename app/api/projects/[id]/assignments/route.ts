import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database.generated'

type ProjectAssignment = Database['public']['Tables']['project_assignments']['Row']
type ProjectAssignmentInsert = Database['public']['Tables']['project_assignments']['Insert']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to view project assignments
    const { data: hasAccess } = await supabase
      .rpc('user_has_project_permission', {
        p_project_id: id,
        p_permission: 'view_project'
      })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all assignments for the project with user details
    const { data: assignments, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        user:profiles!project_assignments_user_id_fkey(
          id,
          email,
          first_name,
          last_name,
          role
        ),
        assigned_by_user:profiles!project_assignments_assigned_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('project_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching assignments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the project manager or controller
    const { data: project } = await supabase
      .from('projects')
      .select('project_manager_id')
      .eq('id', id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (project?.project_manager_id !== user.id && profile?.role !== 'controller') {
      return NextResponse.json({ error: 'Only project managers can assign users' }, { status: 403 })
    }

    // Validate required fields
    const { user_id, role, permissions, notes } = body
    if (!user_id || !role) {
      return NextResponse.json(
        { error: 'user_id and role are required' },
        { status: 400 }
      )
    }

    // Create assignment
    const assignmentData: ProjectAssignmentInsert = {
      project_id: id,
      user_id,
      role,
      permissions: permissions || {},
      notes,
      assigned_by: user.id,
      expires_at: body.expires_at || null
    }

    const { data: assignment, error } = await supabase
      .from('project_assignments')
      .insert(assignmentData)
      .select(`
        *,
        user:profiles!project_assignments_user_id_fkey(
          id,
          email,
          first_name,
          last_name,
          role
        ),
        assigned_by_user:profiles!project_assignments_assigned_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) {
      console.error('Error creating assignment:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'User is already assigned to this project' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // TODO: Send notification to assigned user

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignmentId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete assignment (RLS will handle authorization)
    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('project_id', id)

    if (error) {
      console.error('Error deleting assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { assignmentId, permissions, role, expires_at, notes } = body

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignmentId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update assignment (RLS will handle authorization)
    const updateData: Partial<ProjectAssignment> = {}
    if (permissions !== undefined) updateData.permissions = permissions
    if (role !== undefined) updateData.role = role
    if (expires_at !== undefined) updateData.expires_at = expires_at
    if (notes !== undefined) updateData.notes = notes

    const { data: assignment, error } = await supabase
      .from('project_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .eq('project_id', id)
      .select(`
        *,
        user:profiles!project_assignments_user_id_fkey(
          id,
          email,
          first_name,
          last_name,
          role
        ),
        assigned_by_user:profiles!project_assignments_assigned_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error in PATCH /api/projects/[id]/assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}