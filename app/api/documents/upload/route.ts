import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StorageService } from '@/lib/services/storage'
import { z } from 'zod'

// Schema for upload request
const uploadSchema = z.object({
  entity_type: z.enum(['project', 'purchase_order', 'change_order']),
  entity_id: z.string().uuid(),
  category: z.enum(['contract', 'invoice', 'drawing', 'report', 'other']),
  description: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Parse and validate other fields
    const body = {
      entity_type: formData.get('entity_type'),
      entity_id: formData.get('entity_id'),
      category: formData.get('category'),
      description: formData.get('description'),
    }

    const validatedData = uploadSchema.parse(body)

    // Check user has permission to upload to this entity
    const hasPermission = await checkUploadPermission(
      supabase,
      user.id,
      validatedData.entity_type,
      validatedData.entity_id
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to upload documents to this entity' },
        { status: 403 }
      )
    }

    // Initialize storage service
    const storageService = new StorageService(supabase)
    await storageService.initializeBucket()

    // Upload document
    const document = await storageService.uploadDocument({
      file,
      entityType: validatedData.entity_type,
      entityId: validatedData.entity_id,
      category: validatedData.category,
      description: validatedData.description,
    })

    // Log in audit log
    await supabase.from('audit_log').insert({
      entity_type: 'document',
      entity_id: document.id,
      action: 'create',
      changes: {
        name: document.name,
        entity_type: validatedData.entity_type,
        entity_id: validatedData.entity_id,
        category: validatedData.category,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      data: document,
      message: 'Document uploaded successfully',
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}

async function checkUploadPermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  // Get user role
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role, division_id')
    .eq('id', userId)
    .single()

  if (!userProfile) return false

  // Controllers and executives can upload to any entity
  if (['controller', 'executive'].includes(userProfile.role)) {
    return true
  }

  // Check entity-specific permissions
  if (entityType === 'project') {
    const { data: project } = await supabase
      .from('projects')
      .select('division_id, project_manager_id')
      .eq('id', entityId)
      .single()

    if (!project) return false

    // Ops managers can upload to their division's projects
    if (userProfile.role === 'ops_manager' && project.division_id === userProfile.division_id) {
      return true
    }

    // Project managers can upload to their projects
    if (userProfile.role === 'project_manager' && project.project_manager_id === userId) {
      return true
    }
  } else if (entityType === 'purchase_order') {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('project:projects(division_id, project_manager_id)')
      .eq('id', entityId)
      .single()

    if (!po?.project) return false

    if (userProfile.role === 'ops_manager' && po.project.division_id === userProfile.division_id) {
      return true
    }

    if (userProfile.role === 'project_manager' && po.project.project_manager_id === userId) {
      return true
    }
  } else if (entityType === 'change_order') {
    const { data: co } = await supabase
      .from('change_orders')
      .select('project:projects(division_id, project_manager_id)')
      .eq('id', entityId)
      .single()

    if (!co?.project) return false

    if (userProfile.role === 'ops_manager' && co.project.division_id === userProfile.division_id) {
      return true
    }

    if (userProfile.role === 'project_manager' && co.project.project_manager_id === userId) {
      return true
    }
  }

  return false
}