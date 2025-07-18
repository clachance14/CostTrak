'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface DataHealthStatusProps {
  lastLaborImport?: string | null
  lastPoImport?: string | null
  className?: string
}

export function DataHealthStatus({
  lastLaborImport,
  lastPoImport,
  className
}: DataHealthStatusProps) {
  const getDataStatus = (date: string | null | undefined, staleThreshold: number) => {
    if (!date) return { status: 'missing', label: 'Never', color: 'text-red-600', bgColor: 'bg-red-100 text-red-800' }
    
    const importDate = new Date(date)
    const daysSince = Math.floor((new Date().getTime() - importDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSince > staleThreshold) {
      return {
        status: 'stale',
        label: formatDistanceToNow(importDate, { addSuffix: true }),
        color: 'text-red-600',
        bgColor: 'bg-red-100 text-red-800'
      }
    } else if (daysSince > Math.floor(staleThreshold / 2)) {
      return {
        status: 'warning',
        label: formatDistanceToNow(importDate, { addSuffix: true }),
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 text-yellow-800'
      }
    } else {
      return {
        status: 'current',
        label: formatDistanceToNow(importDate, { addSuffix: true }),
        color: 'text-green-600',
        bgColor: 'bg-green-100 text-green-800'
      }
    }
  }

  const laborStatus = getDataStatus(lastLaborImport, 7) // 7 days for labor
  const poStatus = getDataStatus(lastPoImport, 14) // 14 days for PO

  const getOverallStatus = () => {
    if (laborStatus.status === 'missing' || poStatus.status === 'missing') return 'critical'
    if (laborStatus.status === 'stale' || poStatus.status === 'stale') return 'stale'
    if (laborStatus.status === 'warning' || poStatus.status === 'warning') return 'warning'
    return 'current'
  }

  const overallStatus = getOverallStatus()

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'current':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'stale':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusLabel = () => {
    switch (overallStatus) {
      case 'current':
        return 'Up to Date'
      case 'warning':
        return 'Attention Needed'
      case 'stale':
        return 'Data Stale'
      case 'critical':
        return 'Action Required'
    }
  }

  const getStatusBadgeColor = () => {
    switch (overallStatus) {
      case 'current':
        return 'bg-green-100 text-green-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'stale':
      case 'critical':
        return 'bg-red-100 text-red-800'
    }
  }

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Data Health</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge className={getStatusBadgeColor()}>
              {getStatusLabel()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-sm text-gray-600">Labor Data</span>
            </div>
            <span className={cn('text-sm font-medium', laborStatus.color)}>
              {laborStatus.label}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-sm text-gray-600">PO Data</span>
            </div>
            <span className={cn('text-sm font-medium', poStatus.color)}>
              {poStatus.label}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}