import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for updating contract details
const updateContractSchema = z.object({
  client_po_revision: z.string().optional().nullable(),
  client_po_number: z.string().optional(),
  client_representative: z.string().optional()
})

// PATCH /api/projects/[id]/contract - Update project contract details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: projectId } = await params
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details
  const { data: userDetails } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Only certain roles can update contract details
  if (!['controller', 'ops_manager', 'project_manager'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = updateContractSchema.parse(body)

    // Check if project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_manager_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Project managers can only update their own projects
    if (userDetails.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if contract breakdown exists
    const { data: contractBreakdown } = await supabase
      .from('project_contract_breakdowns')
      .select('id')
      .eq('project_id', projectId)
      .single()

    let result
    
    if (contractBreakdown) {
      // Update existing record
      const { data, error } = await supabase
        .from('project_contract_breakdowns')
        .update(validatedData)
        .eq('project_id', projectId)
        .select()
        .single()
      
      if (error) throw error
      result = data
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('project_contract_breakdowns')
        .insert({
          project_id: projectId,
          ...validatedData
        })
        .select()
        .single()
      
      if (error) throw error
      result = data
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      entity_type: 'project_contract_breakdowns',
      entity_id: result.id,
      action: contractBreakdown ? 'update' : 'create',
      changes: validatedData,
      performed_by: user.id
    })

    return NextResponse.json({
      success: true,
      contractBreakdown: result
    })
  } catch (error) {
    console.error('Contract update error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update contract details' },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/contract - Get project contract details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: projectId } = await params
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: contractBreakdown, error } = await supabase
      .from('project_contract_breakdowns')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error
    }

    return NextResponse.json({
      contractBreakdown: contractBreakdown || null
    })
  } catch (error) {
    console.error('Contract fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contract details' },
      { status: 500 }
    )
  }
}