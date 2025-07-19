import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateFileType, ALLOWED_FILE_TYPES } from '@/lib/validations/change-order'

export const dynamic = 'force-dynamic'

// GET /api/change-orders/[id]/attachments - List attachments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Verify change order exists and user has access
    const { data: changeOrder, error: coError } = await supabase
      .from('change_orders')
      .select(`
        id,
        project:projects!inner(
          id,
          project_manager_id,
          division_id
        )
      `)
      .eq('id', changeOrderId)
      .single()

    if (coError || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check access based on role
    const hasAccess = 
      userProfile.role === 'controller' ||
      userProfile.role === 'executive' ||
      (userProfile.role === 'ops_manager' && changeOrder.project?.division_id === userProfile.division_id) ||
      (userProfile.role === 'project_manager' && changeOrder.project?.project_manager_id === user.id) ||
      userProfile.role === 'accounting'

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('co_attachments')
      .select(`
        id,
        file_url,
        file_name,
        file_size,
        mime_type,
        uploaded_at,
        uploaded_by,
        uploader:profiles!co_attachments_uploaded_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .eq('change_order_id', changeOrderId)
      .order('uploaded_at', { ascending: false })

    if (attachmentsError) throw attachmentsError

    // Format response
    const formattedAttachments = attachments?.map(attachment => ({
      id: attachment.id,
      fileUrl: attachment.file_url,
      fileName: attachment.file_name,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
      uploadedAt: attachment.uploaded_at,
      uploadedBy: attachment.uploader && !Array.isArray(attachment.uploader) ? {
        id: attachment.uploader.id,
        name: `${attachment.uploader.first_name} ${attachment.uploader.last_name}`
      } : null
    })) || []

    return NextResponse.json({ attachments: formattedAttachments })
  } catch (error) {
    console.error('Attachments fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    )
  }
}

// POST /api/change-orders/[id]/attachments - Upload attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!validateFileType(file)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          allowedTypes: ALLOWED_FILE_TYPES 
        }, 
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Verify change order exists and user has edit access
    const { data: changeOrder, error: coError } = await supabase
      .from('change_orders')
      .select(`
        id,
        project:projects!inner(
          id,
          project_manager_id,
          division_id
        )
      `)
      .eq('id', changeOrderId)
      .single()

    if (coError || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check edit access based on role
    const hasEditAccess = 
      userProfile.role === 'controller' ||
      userProfile.role === 'ops_manager' ||
      (userProfile.role === 'project_manager' && changeOrder.project?.project_manager_id === user.id)

    if (!hasEditAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate unique file name
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `co_${changeOrderId}_${timestamp}.${fileExt}`
    const filePath = `change-orders/${changeOrderId}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // Create attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('co_attachments')
      .insert({
        change_order_id: changeOrderId,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id
      })
      .select(`
        id,
        file_url,
        file_name,
        file_size,
        mime_type,
        uploaded_at
      `)
      .single()

    if (attachmentError) {
      // If record creation fails, delete the uploaded file
      await supabase.storage.from('documents').remove([filePath])
      throw attachmentError
    }

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'upload_attachment',
      entity_type: 'change_order',
      entity_id: changeOrderId,
      changes: { 
        attachment_id: attachment.id,
        file_name: file.name,
        file_size: file.size
      }
    })

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        fileUrl: attachment.file_url,
        fileName: attachment.file_name,
        fileSize: attachment.file_size,
        mimeType: attachment.mime_type,
        uploadedAt: attachment.uploaded_at
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Attachment upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

// DELETE /api/change-orders/[id]/attachments/[attachmentId] - Delete attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Get attachment ID from URL search params
  const attachmentId = request.nextUrl.searchParams.get('attachmentId')
  
  if (!attachmentId) {
    return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
  }
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get attachment details
    const { data: attachment, error: attachmentError } = await supabase
      .from('co_attachments')
      .select('id, file_url, uploaded_by, change_order_id')
      .eq('id', attachmentId)
      .eq('change_order_id', changeOrderId)
      .single()

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if user can delete (only uploader or controller)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const canDelete = 
      attachment.uploaded_by === user.id ||
      userProfile?.role === 'controller'

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Extract file path from URL
    const urlParts = attachment.file_url.split('/documents/')
    const filePath = urlParts[1]

    // Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from('documents')
      .remove([filePath])

    if (deleteStorageError) {
      console.error('Storage delete error:', deleteStorageError)
    }

    // Delete record
    const { error: deleteError } = await supabase
      .from('co_attachments')
      .delete()
      .eq('id', attachmentId)

    if (deleteError) throw deleteError

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'delete_attachment',
      entity_type: 'change_order',
      entity_id: changeOrderId,
      changes: { 
        attachment_id: attachmentId,
        deleted_by: user.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attachment delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}