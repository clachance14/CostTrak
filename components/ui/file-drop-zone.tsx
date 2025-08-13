'use client'

import { useRef, ChangeEvent } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDragAndDrop } from '@/hooks/use-drag-and-drop'

interface FileDropZoneProps {
  onFileSelect: (file: File) => void
  acceptedFileTypes?: string[]
  maxFileSize?: number
  disabled?: boolean
  loading?: boolean
  file?: File | null
  onFileRemove?: () => void
  className?: string
  placeholder?: string
  description?: string
}

export function FileDropZone({
  onFileSelect,
  acceptedFileTypes = ['.xlsx', '.xls', '.csv'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  disabled = false,
  loading = false,
  file,
  onFileRemove,
  className,
  placeholder = 'Click to upload or drag and drop',
  description
}: FileDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const isDisabled = disabled || loading

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = 
    useDragAndDrop({
      onDrop: (files) => {
        if (files.length > 0) {
          onFileSelect(files[0])
        }
      },
      acceptedFileTypes,
      maxFileSize,
      multiple: false,
      disabled: isDisabled
    })

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file
      const fileExtension = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`
      const isAccepted = acceptedFileTypes.some(type => 
        fileExtension === type.toLowerCase()
      )
      
      if (!isAccepted) {
        alert(`Please select a valid file type: ${acceptedFileTypes.join(', ')}`)
        return
      }
      
      if (selectedFile.size > maxFileSize) {
        alert(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`)
        return
      }
      
      onFileSelect(selectedFile)
    }
  }

  const handleClick = () => {
    if (!isDisabled) {
      fileInputRef.current?.click()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getAcceptedTypesDescription = () => {
    if (!description) {
      const extensions = acceptedFileTypes.map(type => 
        type.startsWith('.') ? type.toUpperCase().slice(1) : type
      )
      return `${extensions.join(', ')} files up to ${Math.round(maxFileSize / 1024 / 1024)}MB`
    }
    return description
  }

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
        isDragging && !isDisabled && "border-primary bg-primary/5 scale-[1.02] shadow-lg",
        !isDragging && !isDisabled && "border-foreground/30 hover:border-foreground/50 hover:shadow-md",
        isDisabled && "opacity-50 cursor-not-allowed",
        !isDisabled && "cursor-pointer",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={isDisabled}
      />

      {file ? (
        <div className="space-y-2">
          <FileSpreadsheet className="h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">{file.name}</p>
          <p className="text-sm text-foreground/80">{formatFileSize(file.size)}</p>
          {onFileRemove && !isDisabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onFileRemove()
              }}
              className="mt-2"
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      ) : (
        <>
          {isDragging && !isDisabled ? (
            <>
              <Upload className="h-12 w-12 text-primary mx-auto mb-4 animate-bounce" />
              <p className="text-lg font-medium text-primary mb-2">
                Drop your file here
              </p>
              <p className="text-sm text-primary/80">
                Release to upload
              </p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-12 w-12 text-foreground/60 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                {placeholder}
              </p>
              <p className="text-sm text-foreground/80">
                {getAcceptedTypesDescription()}
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}