'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Trash2, 
  FileText,
  FileSpreadsheet,
  Image as FileImage,
  File,
  LoaderCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import { useUser } from '@/hooks/use-auth'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Document {
  id: string
  name: string
  description: string | null
  file_size: number
  mime_type: string
  category: string
  created_at: string
  uploader: {
    first_name: string
    last_name: string
    email: string
  }
}

interface DocumentListProps {
  entityType: 'project' | 'purchase_order' | 'change_order'
  entityId: string
}

export function DocumentList({ entityType, entityId }: DocumentListProps) {
  const queryClient = useQueryClient()
  const { data: user } = useUser()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Fetch documents
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: async () => {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
      })
      const response = await fetch(`/api/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete document')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      })
      setDeleteId(null)
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Download handler
  const handleDownload = async (documentId: string, filename: string) => {
    try {
      setDownloadingId(documentId)
      const response = await fetch(`/api/documents/${documentId}/download`)
      if (!response.ok) throw new Error('Failed to get download URL')
      
      const { data } = await response.json()
      
      // Create a temporary anchor element to trigger download
      const a = document.createElement('a')
      a.href = data.url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) 
      return <FileSpreadsheet className="h-4 w-4" />
    if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contract': return 'bg-purple-100 text-purple-800'
      case 'invoice': return 'bg-green-100 text-green-800'
      case 'drawing': return 'bg-blue-100 text-blue-800'
      case 'report': return 'bg-orange-100 text-orange-800'
      default: return 'bg-foreground/5 text-foreground'
    }
  }

  const documents = documentsData?.data || []

  if (isLoading) {
    return <div className="text-center py-8">Loading documents...</div>
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-foreground/80">
        No documents uploaded yet
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc: Document) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getFileIcon(doc.mime_type)}
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      {doc.description && (
                        <p className="text-sm text-foreground/80">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getCategoryColor(doc.category)}>
                    {doc.category}
                  </Badge>
                </TableCell>
                <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                <TableCell>
                  {doc.uploader.first_name} {doc.uploader.last_name}
                </TableCell>
                <TableCell>
                  {format(new Date(doc.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.name)}
                      disabled={downloadingId === doc.id}
                    >
                      {downloadingId === doc.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    {user?.role === 'project_manager' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}