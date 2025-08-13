'use client'

import { useState, useRef, useCallback, DragEvent } from 'react'

interface UseDragAndDropOptions {
  onDrop: (files: File[]) => void
  acceptedFileTypes?: string[]
  maxFileSize?: number
  multiple?: boolean
  disabled?: boolean
}

interface UseDragAndDropReturn {
  isDragging: boolean
  handleDragEnter: (e: DragEvent<HTMLElement>) => void
  handleDragLeave: (e: DragEvent<HTMLElement>) => void
  handleDragOver: (e: DragEvent<HTMLElement>) => void
  handleDrop: (e: DragEvent<HTMLElement>) => void
}

export function useDragAndDrop({
  onDrop,
  acceptedFileTypes = [],
  maxFileSize = Infinity,
  multiple = false,
  disabled = false
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const validateFile = (file: File): boolean => {
    // Check file type if restrictions are set
    if (acceptedFileTypes.length > 0) {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`
      const isAccepted = acceptedFileTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase()
        }
        return file.type === type
      })
      if (!isAccepted) {
        return false
      }
    }

    // Check file size
    if (file.size > maxFileSize) {
      return false
    }

    return true
  }

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return
    
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return
    
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [disabled])

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(false)
    dragCounter.current = 0
    
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    
    // Validate files
    const validFiles = files.filter(validateFile)
    
    if (validFiles.length === 0) {
      // Could add error handling here
      return
    }

    // Handle single vs multiple files
    if (!multiple && validFiles.length > 0) {
      onDrop([validFiles[0]])
    } else {
      onDrop(validFiles)
    }
  }, [disabled, multiple, onDrop, acceptedFileTypes, maxFileSize])

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  }
}