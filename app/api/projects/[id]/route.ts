import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects/[id] - Get single project
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

    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        created_by_user:profiles!projects_created_by_fkey(id, first_name, last_name),
        client_po_line_items(
          id,
          line_number,
          description,
          amount,
          created_at
        ),
        purchase_orders(
          id,
          po_number,
          vendor_name,
          description,
          total_amount,
          status,
          created_at
        ),
        labor_forecasts(
          id,
          week_ending,
          forecasted_cost,
          actual_cost,
          created_at
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // No divisions in simplified schema

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
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

    // In simplified schema, all authenticated users are project managers and can update any project
    // No role-based restrictions needed

    // Validate request body
    const updateSchema = z.object({
      name: z.string().min(1).max(200).optional(),
      project_manager_id: z.string().uuid().optional(),
      original_contract: z.number().min(0).optional(),
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
      status: z.enum(['active', 'on_hold', 'completed', 'cancelled']).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip_code: z.string().max(10).optional(),
      description: z.string().optional()
    })

    const body = await request.json()
    const validatedData = updateSchema.parse(body)

    // Update project
    const { data: project, error } = await supabase
      .from('projects')
      .update(validatedData)
      .eq('id', id)
      .select(`
        *,
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id] - Soft delete project
export async function DELETE(
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

    // In simplified schema, all authenticated users are project managers and can delete projects
    // No role-based restrictions needed

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('projects')
      .update({ 
        deleted_at: new Date().toISOString(),
        status: 'cancelled'
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}