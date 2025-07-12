'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { DocumentList } from '@/components/documents/document-list'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { useUser } from '@/hooks/use-auth'

interface ProjectDocumentsTabProps {
  projectId: string
  projectName: string
}

export function ProjectDocumentsTab({ projectId, projectName }: ProjectDocumentsTabProps) {
  const { data: user } = useUser()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Check if user can upload documents
  const canUpload = user && ['controller', 'executive', 'ops_manager', 'project_manager'].includes(user.role)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project Documents</CardTitle>
          {canUpload && (
            <Button onClick={() => setUploadModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <DocumentList entityType="project" entityId={projectId} />
        </CardContent>
      </Card>

      <DocumentUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        entityType="project"
        entityId={projectId}
        entityName={projectName}
      />
    </>
  )
}