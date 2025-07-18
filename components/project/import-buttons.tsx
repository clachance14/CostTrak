'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileText, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ImportButtonsProps {
  lastLaborImport?: string | null
  lastPoImport?: string | null
  onLaborImport: () => void
  onPoImport: () => void
  className?: string
  variant?: 'default' | 'compact'
}

export function ImportButtons({
  lastLaborImport,
  lastPoImport,
  onLaborImport,
  onPoImport,
  className,
  variant = 'default'
}: ImportButtonsProps) {
  const [laborLoading, setLaborLoading] = useState(false)
  const [poLoading, setPoLoading] = useState(false)

  const handleLaborImport = async () => {
    setLaborLoading(true)
    try {
      await onLaborImport()
    } finally {
      setLaborLoading(false)
    }
  }

  const handlePoImport = async () => {
    setPoLoading(true)
    try {
      await onPoImport()
    } finally {
      setPoLoading(false)
    }
  }

  const getDataAge = (date: string | null | undefined) => {
    if (!date) return { age: 'never', isStale: true, isCritical: true }
    
    const importDate = new Date(date)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - importDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      age: formatDistanceToNow(importDate, { addSuffix: true }),
      isStale: daysSince > 3,
      isCritical: daysSince > 7
    }
  }

  const laborAge = getDataAge(lastLaborImport)
  const poAge = getDataAge(lastPoImport)

  if (variant === 'compact') {
    return (
      <div className={cn('flex gap-2', className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={laborAge.isCritical ? 'destructive' : laborAge.isStale ? 'default' : 'outline'}
                onClick={handleLaborImport}
                disabled={laborLoading}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Labor</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import Labor Data</p>
              <p className="text-xs text-gray-400">
                Last import: {laborAge.age}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={poAge.isCritical ? 'destructive' : poAge.isStale ? 'default' : 'outline'}
                onClick={handlePoImport}
                disabled={poLoading}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">PO</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import PO Log</p>
              <p className="text-xs text-gray-400">
                Last import: {poAge.age}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          variant={laborAge.isCritical ? 'destructive' : laborAge.isStale ? 'default' : 'outline'}
          onClick={handleLaborImport}
          disabled={laborLoading}
        >
          <FileSpreadsheet className="h-5 w-5 mr-2" />
          Import Labor Data
        </Button>
        <div className="flex items-center justify-center gap-2 text-xs">
          <Clock className={cn(
            'h-3 w-3',
            laborAge.isCritical ? 'text-red-600' : laborAge.isStale ? 'text-yellow-600' : 'text-gray-400'
          )} />
          <span className={cn(
            laborAge.isCritical ? 'text-red-600' : laborAge.isStale ? 'text-yellow-600' : 'text-gray-500'
          )}>
            {lastLaborImport ? (
              <>Last import: {laborAge.age}</>
            ) : (
              'No imports yet'
            )}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          variant={poAge.isCritical ? 'destructive' : poAge.isStale ? 'default' : 'outline'}
          onClick={handlePoImport}
          disabled={poLoading}
        >
          <FileText className="h-5 w-5 mr-2" />
          Import PO Log
        </Button>
        <div className="flex items-center justify-center gap-2 text-xs">
          <Clock className={cn(
            'h-3 w-3',
            poAge.isCritical ? 'text-red-600' : poAge.isStale ? 'text-yellow-600' : 'text-gray-400'
          )} />
          <span className={cn(
            poAge.isCritical ? 'text-red-600' : poAge.isStale ? 'text-yellow-600' : 'text-gray-500'
          )}>
            {lastPoImport ? (
              <>Last import: {poAge.age}</>
            ) : (
              'No imports yet'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}