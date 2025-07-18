'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSpreadsheet } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface ImportRecord {
  id: string
  import_type: 'labor' | 'po' | 'budget' | 'employee'
  import_status: 'pending' | 'processing' | 'success' | 'failed'
  imported_at: string
  records_processed: number
  records_failed: number
  error_message?: string
  file_name?: string
  imported_by_user: {
    first_name: string
    last_name: string
  }
}

interface ImportHistoryProps {
  projectId: string
}

export function ImportHistory({ projectId }: ImportHistoryProps) {
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchImportHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/data-imports?projectId=${projectId}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setImports(data)
      }
    } catch (error) {
      console.error('Error fetching import history:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchImportHistory()
  }, [projectId, fetchImportHistory])

  // Function to get status icon
  // const getStatusIcon = (status: string) => {
  //   switch (status) {
  //     case 'success':
  //       return <CheckCircle className="h-4 w-4 text-green-600" />
  //     case 'failed':
  //       return <AlertCircle className="h-4 w-4 text-red-600" />
  //     case 'processing':
  //     case 'pending':
  //       return <Clock className="h-4 w-4 text-yellow-600" />
  //     default:
  //       return null
  //   }
  // }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getImportTypeLabel = (type: string) => {
    switch (type) {
      case 'labor':
        return 'Labor Data'
      case 'po':
        return 'Purchase Orders'
      case 'budget':
        return 'Budget'
      case 'employee':
        return 'Employees'
      default:
        return type
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Imports</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {imports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No import history available
            </div>
          ) : (
            <div className="space-y-3">
              {imports.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getImportTypeLabel(record.import_type)}</span>
                        {getStatusBadge(record.import_status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {record.imported_by_user.first_name} {record.imported_by_user.last_name}
                        {' • '}
                        {formatDistanceToNow(new Date(record.imported_at), { addSuffix: true })}
                      </div>
                      {record.file_name && (
                        <div className="text-xs text-muted-foreground">
                          {record.file_name}
                        </div>
                      )}
                      {record.import_status === 'success' && (
                        <div className="text-xs text-green-600">
                          {record.records_processed} records processed
                        </div>
                      )}
                      {record.error_message && (
                        <div className="text-xs text-red-600">
                          {record.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(record.imported_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}