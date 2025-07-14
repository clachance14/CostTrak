'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils/cn'

interface DocumentUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: 'project' | 'purchase_order' | 'change_order'
  entityId: string
  entityName?: string
}

const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function DocumentUploadModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: DocumentUploadModalProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<string>('other')
  const [description, setDescription] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', entityType)
      formData.append('entity_id', entityId)
      formData.append('category', category)
      if (description) formData.append('description', description)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      })
      handleClose()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  })

  const handleClose = () => {
    setFile(null)
    setCategory('other')
    setDescription('')
    onOpenChange(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document for {entityName || entityType.replace('_', ' ')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-foreground/30 hover:border-foreground/40',
              file && 'bg-background'
            )}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-2">
                <FileText className="mx-auto h-10 w-10 text-foreground" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-foreground/80">
                  {formatFileSize(file.size)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto h-10 w-10 text-foreground" />
                <p className="font-medium">
                  {isDragActive
                    ? 'Drop the file here'
                    : 'Drag & drop a file here, or click to select'}
                </p>
                <p className="text-xs text-foreground/80">
                  PDF, Word, Excel, Images (max 50MB)
                </p>
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="drawing">Drawing</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}