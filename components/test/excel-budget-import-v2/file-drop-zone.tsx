'use client'

import { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFileUpload: (file: File) => void
  loading: boolean
}

export function FileDropZone({ onFileUpload, loading }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleFile = useCallback((file: File) => {
    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    
    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit')
      return
    }
    
    onFileUpload(file)
  }, [onFileUpload])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    if (loading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [loading, handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleClick = useCallback(() => {
    if (!loading) {
      fileInputRef.current?.click()
    }
  }, [loading])

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all",
        "hover:border-primary hover:bg-muted/50",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
        disabled={loading}
      />
      
      <div className="flex flex-col items-center gap-4">
        {loading ? (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
            <div>
              <p className="text-lg font-medium">Analyzing Excel file...</p>
              <p className="text-sm text-muted-foreground">This may take a few moments</p>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 bg-muted rounded-full">
              {isDragging ? (
                <Upload className="h-8 w-8 text-primary" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium">
                {isDragging 
                  ? "Drop your Excel file here" 
                  : "Drag and drop your Excel coversheet"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse for a file
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Supports .xlsx and .xls files up to 50MB
            </div>
          </>
        )}
      </div>
    </div>
  )
}