'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickImportSectionProps {
  projects: Array<{
    id: string
    name: string
    job_number: string
  }>
  selectedProjectId?: string
  onProjectChange?: (projectId: string) => void
  onImportComplete?: () => void
}

interface ImportStatus {
  type: 'idle' | 'validating' | 'uploading' | 'processing' | 'success' | 'error'
  message?: string
  progress?: number
  details?: {
    records_processed?: number
    records_failed?: number
    errors?: Array<{ row: number; error: string }>
  }
}

export function QuickImportSection({ 
  projects, 
  selectedProjectId, 
  onProjectChange,
  onImportComplete 
}: QuickImportSectionProps) {
  const [selectedProject, setSelectedProject] = useState(selectedProjectId || '')
  const [laborStatus, setLaborStatus] = useState<ImportStatus>({ type: 'idle' })
  const [poStatus, setPoStatus] = useState<ImportStatus>({ type: 'idle' })
  const [isDraggingLabor, setIsDraggingLabor] = useState(false)
  const [isDraggingPO, setIsDraggingPO] = useState(false)
  
  const laborInputRef = useRef<HTMLInputElement>(null)
  const poInputRef = useRef<HTMLInputElement>(null)

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    onProjectChange?.(projectId)
  }

  const validateFile = async (file: File, importType: 'labor' | 'po') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('importType', importType)

    const response = await fetch('/api/quick-import/validate', {
      method: 'POST',
      body: formData
    })

    return response.json()
  }

  const uploadFile = async (file: File, importType: 'labor' | 'po') => {
    const setStatus = importType === 'labor' ? setLaborStatus : setPoStatus
    
    if (!selectedProject) {
      setStatus({ 
        type: 'error', 
        message: 'Please select a project first' 
      })
      return
    }

    try {
      // Step 1: Validate file
      setStatus({ type: 'validating', message: 'Validating file format...' })
      const validation = await validateFile(file, importType)
      
      if (!validation.valid) {
        setStatus({ 
          type: 'error', 
          message: validation.errors[0] || 'Invalid file format',
          details: { errors: validation.errors }
        })
        return
      }

      // Step 2: Upload and process
      setStatus({ type: 'uploading', message: 'Uploading file...', progress: 30 })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', selectedProject)

      const response = await fetch(`/api/quick-import/${importType}`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      // Step 3: Show results
      if (result.records_failed > 0) {
        setStatus({
          type: 'error',
          message: `Import completed with ${result.records_failed} errors`,
          details: result
        })
      } else {
        setStatus({
          type: 'success',
          message: `Successfully imported ${result.records_processed} records`,
          details: result
        })
        onImportComplete?.()
      }
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error.message || 'Import failed',
      })
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, importType: 'labor' | 'po') => {
    const file = event.target.files?.[0]
    if (file) {
      uploadFile(file, importType)
    }
  }

  const handleDrop = (event: React.DragEvent, importType: 'labor' | 'po') => {
    event.preventDefault()
    event.stopPropagation()
    
    if (importType === 'labor') {
      setIsDraggingLabor(false)
    } else {
      setIsDraggingPO(false)
    }

    const file = event.dataTransfer.files[0]
    if (file) {
      uploadFile(file, importType)
    }
  }

  const resetStatus = (importType: 'labor' | 'po') => {
    if (importType === 'labor') {
      setLaborStatus({ type: 'idle' })
      if (laborInputRef.current) laborInputRef.current.value = ''
    } else {
      setPoStatus({ type: 'idle' })
      if (poInputRef.current) poInputRef.current.value = ''
    }
  }

  const renderImportZone = (
    importType: 'labor' | 'po',
    status: ImportStatus,
    isDragging: boolean,
    setIsDragging: (dragging: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const isProcessing = ['validating', 'uploading', 'processing'].includes(status.type)
    const title = importType === 'labor' ? 'Labor Data' : 'PO Log'
    const acceptedFormats = importType === 'labor' ? '.xlsx,.xls' : '.csv,.xlsx,.xls'

    return (
      <div className="flex-1">
        <h3 className="text-sm font-medium mb-2">{title}</h3>
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            isDragging && "border-primary bg-primary/5",
            status.type === 'error' && "border-red-500 bg-red-50 dark:bg-red-900/20",
            status.type === 'success' && "border-green-500 bg-green-50 dark:bg-green-900/20",
            !isDragging && status.type === 'idle' && "border-gray-300 dark:border-gray-600 hover:border-gray-400"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => handleDrop(e, importType)}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptedFormats}
            onChange={(e) => handleFileSelect(e, importType)}
            className="hidden"
            disabled={isProcessing || !selectedProject}
          />

          {status.type === 'idle' && (
            <>
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Drag and drop or{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => inputRef.current?.click()}
                  disabled={!selectedProject}
                >
                  browse
                </Button>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {importType === 'labor' ? 'Excel files (.xlsx, .xls)' : 'CSV or Excel files'}
              </p>
            </>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{status.message}</p>
              {status.progress && (
                <Progress value={status.progress} className="w-full max-w-xs mx-auto" />
              )}
            </div>
          )}

          {status.type === 'success' && (
            <div className="space-y-2">
              <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
              <p className="text-sm font-medium text-green-600">{status.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetStatus(importType)}
                className="mt-2"
              >
                Import Another File
              </Button>
            </div>
          )}

          {status.type === 'error' && (
            <div className="space-y-2">
              <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
              <p className="text-sm font-medium text-red-600">{status.message}</p>
              {status.details?.errors && status.details.errors.length > 0 && (
                <div className="mt-2 text-xs text-left max-h-20 overflow-y-auto">
                  {status.details.errors.slice(0, 3).map((err, i) => (
                    <div key={i} className="text-red-600">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                  {status.details.errors.length > 3 && (
                    <div className="text-red-600">
                      ...and {status.details.errors.length - 3} more errors
                    </div>
                  )}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetStatus(importType)}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Import</CardTitle>
        <CardDescription>
          Upload labor timesheets and PO logs to keep your project data current
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Project Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Project</label>
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project to import data" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.job_number} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import Zones */}
          {selectedProject ? (
            <div className="flex gap-4">
              {renderImportZone('labor', laborStatus, isDraggingLabor, setIsDraggingLabor, laborInputRef)}
              {renderImportZone('po', poStatus, isDraggingPO, setIsDraggingPO, poInputRef)}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a project above to enable file imports
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}