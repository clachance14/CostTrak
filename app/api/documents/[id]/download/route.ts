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
      .select('*')
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
    // If we get here, the user has permission to view the document

    // Generate download URL
    const storageService = new StorageService(supabase)
    const downloadUrl = await storageService.getDownloadUrl(document)

    // Log download in audit log
    await supabase.from('audit_log').insert({
      entity_type: 'document',
      entity_id: id,
      action: 'download',
      changes: {
        name: document.name,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      data: {
        url: downloadUrl,
        filename: document.name,
        mime_type: document.mime_type,
      },
    })
  } catch (error) {
    console.error('Error generating download URL:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}