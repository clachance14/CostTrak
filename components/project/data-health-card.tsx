'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CircleAlert, Clock, CircleCheck, Upload, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DataHealthCardProps {
  dataHealth: {
    status: 'current' | 'stale' | 'missing' | 'unknown'
    last_labor_import: string | null
    last_po_import: string | null
    last_checked: string | null
  }
  onImportClick: (type: 'labor' | 'po') => void
  onRefreshClick: () => void
}

export function DataHealthCard({ dataHealth, onImportClick, onRefreshClick }: DataHealthCardProps) {
  const getStatusIcon = () => {
    switch (dataHealth.status) {
      case 'current':
        return <CircleCheck className="h-5 w-5 text-green-600" />
      case 'stale':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'missing':
        return <CircleAlert className="h-5 w-5 text-red-600" />
      default:
        return <CircleAlert className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    switch (dataHealth.status) {
      case 'current':
        return <Badge variant="default" className="bg-green-100 text-green-800">Current</Badge>
      case 'stale':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Stale</Badge>
      case 'missing':
        return <Badge variant="destructive">Missing Data</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatLastImport = (date: string | null) => {
    if (!date) return 'Never'
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const getDaysOld = (date: string | null) => {
    if (!date) return null
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const laborDays = getDaysOld(dataHealth.last_labor_import)
  const poDays = getDaysOld(dataHealth.last_po_import)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getStatusIcon()}
            Data Health
          </span>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefreshClick}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Labor Data */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Labor Data</div>
              <div className="text-sm text-muted-foreground">
                Last import: {formatLastImport(dataHealth.last_labor_import)}
                {laborDays !== null && laborDays > 7 && (
                  <span className="text-red-600 ml-1">({laborDays} days old)</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={laborDays === null || laborDays > 7 ? "default" : "outline"}
              onClick={() => onImportClick('labor')}
            >
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
          </div>

          {/* PO Data */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Purchase Order Data</div>
              <div className="text-sm text-muted-foreground">
                Last import: {formatLastImport(dataHealth.last_po_import)}
                {poDays !== null && poDays > 7 && (
                  <span className="text-red-600 ml-1">({poDays} days old)</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={poDays === null || poDays > 7 ? "default" : "outline"}
              onClick={() => onImportClick('po')}
            >
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
          </div>

          {/* Data Health Issues */}
          {dataHealth.status !== 'current' && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Action Required
              </div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                {(!dataHealth.last_labor_import || laborDays! > 7) && (
                  <li>• Labor data needs to be updated</li>
                )}
                {(!dataHealth.last_po_import || poDays! > 7) && (
                  <li>• Purchase order data needs to be updated</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}