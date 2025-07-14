import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const BUCKET_NAME = 'project-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
]

export interface UploadOptions {
  file: File
  entityType: 'project' | 'purchase_order' | 'change_order'
  entityId: string
  category: 'contract' | 'invoice' | 'drawing' | 'report' | 'other'
  description?: string
}

export class StorageService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Initialize the storage bucket if it doesn't exist
   */
  async initializeBucket() {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets()
      
      if (!buckets?.find(b => b.name === BUCKET_NAME)) {
        const { error } = await this.supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        })
        
        if (error && !error.message.includes('already exists')) {
          throw error
        }
      }
    } catch (error) {
      console.error('Failed to initialize storage bucket:', error)
      // Continue anyway - bucket might already exist
    }
  }

  /**
   * Upload a file to storage and create a document record
   */
  async uploadDocument(options: UploadOptions): Promise<Database['public']['Tables']['documents']['Row']> {
    const { file, entityType, entityId, category, description } = options

    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`)
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Upload to storage
    const { error: uploadError } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file)

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    // Get authenticated user
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Create document record
    const { data: document, error: dbError } = await this.supabase
      .from('documents')
      .insert({
        name: file.name,
        description,
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        entity_type: entityType,
        entity_id: entityId,
        category,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      // Try to clean up the uploaded file
      await this.supabase.storage.from(BUCKET_NAME).remove([fileName])
      throw new Error(`Failed to create document record: ${dbError.message}`)
    }

    return document
  }

  /**
   * Get a signed URL for downloading a document
   */
  async getDownloadUrl(document: Database['public']['Tables']['documents']['Row']): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(document.file_path, 3600) // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`)
    }

    return data.signedUrl
  }

  /**
   * Delete a document (soft delete in DB, remove from storage)
   */
  async deleteDocument(documentId: string): Promise<void> {
    // First, get the document to find the file path
    const { data: document, error: fetchError } = await this.supabase
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .single()

    if (fetchError) {
      throw new Error(`Document not found: ${fetchError.message}`)
    }

    // Soft delete in database
    const { error: updateError } = await this.supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)

    if (updateError) {
      throw new Error(`Failed to delete document: ${updateError.message}`)
    }

    // Remove from storage
    const { error: deleteError } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([document.file_path])

    if (deleteError) {
      console.error('Failed to remove file from storage:', deleteError)
      // Don't throw - the DB record is already soft deleted
    }
  }

  /**
   * Get a presigned URL for direct upload (for large files)
   */
  async getUploadUrl(fileName: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(fileName)

    if (error) {
      throw new Error(`Failed to generate upload URL: ${error.message}`)
    }

    return data.signedUrl
  }
}