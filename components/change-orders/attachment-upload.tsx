'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { validateFileType, ALLOWED_FILE_TYPES } from '@/lib/validations/change-order'

interface AttachmentUploadProps {
  changeOrderId: string
  onUploadComplete: (attachment: {
    id: string
    fileUrl: string
    fileName: string
    fileSize: number
    mimeType: string
    uploadedAt: string
  }) => void
  onUploadError: (error: string) => void
  disabled?: boolean
}

export function AttachmentUpload({ 
  changeOrderId, 
  onUploadComplete, 
  onUploadError,
  disabled = false 
}: AttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    // Validate file type
    if (!validateFileType(file)) {
      onUploadError(`Invalid file type. Allowed types: PDF, PNG, JPG, Excel, Word`)
      return
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      onUploadError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/change-orders/${changeOrderId}/attachments`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      onUploadComplete(result.attachment)
    } catch (error) {
      console.error('Upload error:', error)
      onUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || isUploading) return

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled || isUploading) return

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const openFileDialog = () => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }

  const getAcceptedFileTypes = () => {
    return ALLOWED_FILE_TYPES.join(',')
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept={getAcceptedFileTypes()}
        disabled={disabled || isUploading}
      />
      
      <div
        className={`
          relative rounded-lg border-2 border-dashed p-6 text-center
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, Images, Excel, Word (max 10MB)
            </p>
          </>
        )}
      </div>
    </div>
  )
}

interface AttachmentListProps {
  attachments: Array<{
    id: string
    fileName: string
    fileSize?: number
    fileUrl: string
    uploadedAt: string
    uploadedBy?: {
      id: string
      name: string
    }
  }>
  onDelete?: (attachmentId: string) => void
  canDelete?: boolean
}

export function AttachmentList({ attachments, onDelete, canDelete = false }: AttachmentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDelete = async (attachmentId: string) => {
    if (!onDelete || deletingId) return
    
    setDeletingId(attachmentId)
    try {
      await onDelete(attachmentId)
    } finally {
      setDeletingId(null)
    }
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No attachments uploaded
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-gray-500" />
            <div>
              <a
                href={attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {attachment.fileName}
              </a>
              <p className="text-xs text-gray-500">
                {formatFileSize(attachment.fileSize)}
                {attachment.uploadedBy && ` • Uploaded by ${attachment.uploadedBy.name}`}
              </p>
            </div>
          </div>
          
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(attachment.id)}
              disabled={deletingId === attachment.id}
            >
              {deletingId === attachment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}