'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleAlert, AlertTriangle, Clock, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectAlert {
  project_id: string
  project_name: string
  job_number: string
  alert_type: 'stale_data' | 'missing_data' | 'budget_overrun' | 'margin_warning' | 'coverage_risk'
  message: string
  severity: 'error' | 'warning' | 'info'
  action_needed?: string
  actionLink?: string
  actionLabel?: string
}

interface PMAlertBannerProps {
  projectIds: string[]
  onImportClick: (projectId: string, importType: 'labor' | 'po') => void
}

export function PMAlertBanner({ projectIds, onImportClick }: PMAlertBannerProps) {
  const [alerts, setAlerts] = useState<ProjectAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)

  const checkProjectHealth = useCallback(async () => {
    if (projectIds.length === 0) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/data-imports/check-freshness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds })
      })

      if (!response.ok) throw new Error('Failed to check project health')

      const data = await response.json()
      const newAlerts: ProjectAlert[] = []

      // Process health check results
      interface ProjectHealthData {
        project_id: string
        name: string
        job_number: string
        health_status: string
        health_issues: string[]
      }
      
      data.projects.forEach((project: ProjectHealthData) => {
        if (project.health_status === 'missing') {
          newAlerts.push({
            project_id: project.project_id,
            project_name: project.name,
            job_number: project.job_number,
            alert_type: 'missing_data',
            message: project.health_issues.join(', '),
            severity: 'error',
            action_needed: 'Import data now'
          })
        } else if (project.health_status === 'stale') {
          const staleDays = Math.max(project.labor_days_old || 0, project.po_days_old || 0)
          newAlerts.push({
            project_id: project.project_id,
            project_name: project.name,
            job_number: project.job_number,
            alert_type: 'stale_data',
            message: `Data is ${staleDays} days old`,
            severity: 'warning',
            action_needed: 'Update data'
          })
        }
      })

      // Check for financial and budget risk alerts
      for (const projectId of projectIds) {
        try {
          // Get project overview with budget risk data
          const overviewResponse = await fetch(`/api/projects/${projectId}/overview`)
          if (overviewResponse.ok) {
            const overview = await overviewResponse.json()
            
            // Check for margin warnings
            if (overview.financialData?.uncommittedBudget) {
              const { projectedMargin, baseMarginPercentage, marginHealth } = overview.financialData.uncommittedBudget
              
              if (marginHealth === 'critical') {
                newAlerts.push({
                  project_id: projectId,
                  project_name: overview.project.name,
                  job_number: overview.project.job_number,
                  alert_type: 'margin_warning',
                  message: `Margin at risk: ${projectedMargin.toFixed(1)}% (target: ${baseMarginPercentage}%)`,
                  severity: 'error',
                  action_needed: 'Review uncommitted budget'
                })
              }
            }
            
            // Check for budget coverage risks
            if (overview.financialData?.budgetRisks) {
              const risks = overview.financialData.budgetRisks
              
              const criticalCategories = risks.categories?.filter((cat: any) => cat.riskLevel === 'critical') || []
              if (criticalCategories.length > 0) {
                newAlerts.push({
                  project_id: projectId,
                  project_name: overview.project.name,
                  job_number: overview.project.job_number,
                  alert_type: 'coverage_risk',
                  message: `Low PO coverage in ${criticalCategories.map((c: any) => c.name).join(', ')}`,
                  severity: 'error',
                  action_needed: 'Create purchase orders',
                  actionLink: `/purchase-orders/new?project=${projectId}`,
                  actionLabel: 'Create PO'
                })
              }
              
              const warningCategories = risks.categories?.filter((cat: any) => cat.riskLevel === 'warning') || []
              if (warningCategories.length > 0 && criticalCategories.length === 0) {
                newAlerts.push({
                  project_id: projectId,
                  project_name: overview.project.name,
                  job_number: overview.project.job_number,
                  alert_type: 'coverage_risk',
                  message: `Review coverage in ${warningCategories.map((c: any) => c.name).join(', ')}`,
                  severity: 'warning',
                  action_needed: 'Review uncommitted',
                  actionLink: `/projects/${projectId}/overview`,
                  actionLabel: 'View Details'
                })
              }
            }
            
            // Legacy check for low margin
            const summaryResponse = await fetch(`/api/projects/${projectId}/dashboard-summary`)
            if (summaryResponse.ok) {
              const summary = await summaryResponse.json()
              
              if (summary.financial?.variance_at_completion < 0) {
                newAlerts.push({
                  project_id: projectId,
                  project_name: summary.project.name,
                  job_number: summary.project.job_number,
                  alert_type: 'budget_overrun',
                  message: `Forecasted overrun: $${Math.abs(summary.financial.variance_at_completion).toLocaleString()}`,
                  severity: 'warning'
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching project alerts:', error)
        }
      }

      setAlerts(newAlerts)
    } catch (error) {
      console.error('Error checking project health:', error)
    } finally {
      setLoading(false)
    }
  }, [projectIds])

  useEffect(() => {
    checkProjectHealth()
    // Check every 5 minutes
    const interval = setInterval(checkProjectHealth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [projectIds, checkProjectHealth])

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 dark:bg-gray-800 h-16 rounded-lg mb-4" />
    )
  }

  if (alerts.length === 0) {
    return null
  }

  const errorAlerts = alerts.filter(a => a.severity === 'error')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="space-y-2 mb-6">
      {errorAlerts.length > 0 && (
        <Alert variant="destructive" className="border-red-600">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>Action Required - {errorAlerts.length} Critical Issue{errorAlerts.length > 1 ? 's' : ''}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2"
            >
              {isExpanded ? 'Hide' : 'Show'}
            </Button>
          </AlertTitle>
          {isExpanded && (
            <AlertDescription className="mt-2">
              <ul className="space-y-2">
                {errorAlerts.map((alert, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{alert.job_number}</span> - {alert.message}
                    </div>
                    {alert.alert_type === 'missing_data' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onImportClick(alert.project_id, 'labor')}
                          className="bg-white dark:bg-gray-800"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Import Labor
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onImportClick(alert.project_id, 'po')}
                          className="bg-white dark:bg-gray-800"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Import PO
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {warningAlerts.length > 0 && (
        <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            {warningAlerts.length} Warning{warningAlerts.length > 1 ? 's' : ''}
          </AlertTitle>
          {isExpanded && (
            <AlertDescription className="mt-2">
              <ul className="space-y-1">
                {warningAlerts.map((alert, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{alert.job_number}</span> - {alert.message}
                    </div>
                    {alert.alert_type === 'stale_data' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onImportClick(alert.project_id, 'labor')}
                          className="text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Update Labor
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onImportClick(alert.project_id, 'po')}
                          className="text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Update PO
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  )
}