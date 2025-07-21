'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Clock,
  FileQuestion,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react'

interface DivisionAlertsProps {
  projectId: string
  divisionId?: string
  compact?: boolean
}

interface DivisionAlert {
  id: string
  division_id: string
  division_name: string
  project_id: string
  alert_type: 'budget_overrun' | 'margin_risk' | 'po_risk' | 'schedule_delay' | 'missing_forecast'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  threshold_value?: number
  actual_value?: number
  created_at: string
}

export function DivisionAlerts({ projectId, divisionId, compact = false }: DivisionAlertsProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)

  // Fetch division alerts
  const { data: alertsData, isLoading, refetch } = useQuery({
    queryKey: ['division-alerts', projectId, divisionId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (divisionId) params.set('division_id', divisionId)
      
      const response = await fetch(`/api/projects/${projectId}/divisions/alerts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch division alerts')
      return response.json()
    },
    refetchInterval: 60000 // Refetch every minute
  })

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'high': return <AlertCircle className="h-4 w-4" />
      case 'medium': return <AlertTriangle className="h-4 w-4" />
      case 'low': return <Info className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'budget_overrun': return <DollarSign className="h-5 w-5" />
      case 'margin_risk': return <TrendingUp className="h-5 w-5" />
      case 'po_risk': return <FileQuestion className="h-5 w-5" />
      case 'schedule_delay': return <Clock className="h-5 w-5" />
      case 'missing_forecast': return <AlertTriangle className="h-5 w-5" />
      default: return <AlertTriangle className="h-5 w-5" />
    }
  }

  const getAlertTypeLabel = (alertType: string) => {
    switch (alertType) {
      case 'budget_overrun': return 'Budget'
      case 'margin_risk': return 'Margin'
      case 'po_risk': return 'Purchase Orders'
      case 'schedule_delay': return 'Schedule'
      case 'missing_forecast': return 'Forecast'
      default: return alertType
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center p-6">
          <p className="text-muted-foreground">Loading alerts...</p>
        </CardContent>
      </Card>
    )
  }

  const alerts = alertsData?.alerts || []
  const summary = alertsData?.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0 }

  // Filter alerts by severity if selected
  const filteredAlerts = selectedSeverity 
    ? alerts.filter((alert: DivisionAlert) => alert.severity === selectedSeverity)
    : alerts

  if (compact && alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>No active alerts</span>
      </div>
    )
  }

  if (compact) {
    // Compact view for dashboard
    return (
      <div className="space-y-2">
        {summary.total > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {summary.critical > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {summary.critical} Critical
              </Badge>
            )}
            {summary.high > 0 && (
              <Badge className="bg-orange-100 text-orange-800 gap-1">
                <AlertCircle className="h-3 w-3" />
                {summary.high} High
              </Badge>
            )}
            {summary.medium > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {summary.medium} Medium
              </Badge>
            )}
            {summary.low > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Info className="h-3 w-3" />
                {summary.low} Low
              </Badge>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Division Alerts
            {summary.total > 0 && (
              <Badge variant="outline">{summary.total}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>
        
        {/* Severity Filter */}
        {summary.total > 0 && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Button
              variant={selectedSeverity === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeverity(null)}
            >
              All ({summary.total})
            </Button>
            {summary.critical > 0 && (
              <Button
                variant={selectedSeverity === 'critical' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity('critical')}
                className="gap-1"
              >
                <XCircle className="h-3 w-3" />
                Critical ({summary.critical})
              </Button>
            )}
            {summary.high > 0 && (
              <Button
                variant={selectedSeverity === 'high' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity('high')}
                className="gap-1"
              >
                <AlertCircle className="h-3 w-3" />
                High ({summary.high})
              </Button>
            )}
            {summary.medium > 0 && (
              <Button
                variant={selectedSeverity === 'medium' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity('medium')}
                className="gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                Medium ({summary.medium})
              </Button>
            )}
            {summary.low > 0 && (
              <Button
                variant={selectedSeverity === 'low' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity('low')}
                className="gap-1"
              >
                <Info className="h-3 w-3" />
                Low ({summary.low})
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {selectedSeverity 
                ? `No ${selectedSeverity} severity alerts`
                : 'No active alerts. All divisions are performing within thresholds.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert: DivisionAlert) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="gap-1">
                        {getSeverityIcon(alert.severity)}
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {getAlertTypeLabel(alert.alert_type)}
                      </Badge>
                      {!divisionId && (
                        <span className="text-sm font-medium">
                          {alert.division_name}
                        </span>
                      )}
                    </div>
                    <AlertDescription className="text-sm">
                      {alert.message}
                      {alert.threshold_value !== undefined && alert.actual_value !== undefined && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Threshold: {alert.threshold_value}, Actual: {alert.actual_value.toFixed(1)})
                        </span>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}