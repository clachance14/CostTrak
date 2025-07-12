import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StorageService } from '@/lib/services/storage'
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

    // Fetch the document
    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!uploaded_by(first_name, last_name, email)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // The RLS policies will handle access control
    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('Error fetching document:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Check user role - only controllers can delete
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can delete documents' },
        { status: 403 }
      )
    }

    // Get document details before deletion
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Soft delete the document
    const storageService = new StorageService(supabase)
    await storageService.deleteDocument(id)

    // Log in audit log
    await supabase.from('audit_log').insert({
      entity_type: 'document',
      entity_id: id,
      action: 'delete',
      changes: {
        name: document.name,
        entity_type: document.entity_type,
        entity_id: document.entity_id,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      message: 'Document deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}