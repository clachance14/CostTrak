'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useUserProjects } from '@/hooks/use-user-projects'
import { useUser } from '@/hooks/use-auth'
import { LoadingPage } from '@/components/ui/loading'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import Link from 'next/link'
import { 
  Upload,
  AlertCircle,
  Clock,
  TrendingDown,
  Eye,
  RefreshCw
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PMAlertBanner } from '@/components/dashboard/pm-alert-banner'
import { QuickImportSection } from '@/components/dashboard/quick-import-section'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ProjectDashboardData {
  id: string
  name: string
  job_number: string
  division: { name: string }
  status: string
  financial: {
    revised_contract: number
    margin_percent: number
    actual_cost_to_date: number
    forecasted_final_cost: number
    variance_at_completion: number
  }
  data_health: {
    status: 'current' | 'stale' | 'missing' | 'unknown'
    last_labor_import: string | null
    last_po_import: string | null
  }
  percent_complete: number
  physical_percent_complete: number
}

export default function ProjectManagerDashboard() {
  const { isLoading: userLoading } = useUser()
  const { data: projects, isLoading: projectsLoading, error } = useUserProjects()
  
  const [dashboardData, setDashboardData] = useState<ProjectDashboardData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importType, setImportType] = useState<'labor' | 'po'>('labor')

  const fetchDashboardData = useCallback(async () => {
    if (!projects || projects.length === 0) {
      setLoading(false)
      return
    }

    try {
      const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning')
      const dashboardPromises = activeProjects.map(async (project) => {
        const response = await fetch(`/api/projects/${project.id}/dashboard-summary`)
        if (!response.ok) return null
        return response.json()
      })

      const results = await Promise.all(dashboardPromises)
      const validResults = results.filter(r => r !== null).map(r => ({
        id: r.project.id,
        name: r.project.name,
        job_number: r.project.job_number,
        division: r.project.division,
        status: r.project.status,
        financial: r.financial,
        data_health: r.data_health,
        percent_complete: r.project.percent_complete || 0,
        physical_percent_complete: r.project.physical_percent_complete || 0
      }))

      setDashboardData(validResults)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projects])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  const handleImportClick = (projectId: string, type: 'labor' | 'po') => {
    setSelectedProjectId(projectId)
    setImportType(type)
    setShowImportDialog(true)
  }

  const handleImportComplete = () => {
    setShowImportDialog(false)
    handleRefresh()
  }

  if (userLoading || projectsLoading || loading) {
    return <LoadingPage />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Projects</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const projectIds = dashboardData.map(p => p.id)

  // Sort projects by status and margin
  const sortedProjects = [...dashboardData].sort((a, b) => {
    // First by data health (missing/stale first)
    const healthOrder = { missing: 0, stale: 1, current: 2, unknown: 3 }
    const healthDiff = healthOrder[a.data_health.status] - healthOrder[b.data_health.status]
    if (healthDiff !== 0) return healthDiff
    
    // Then by margin (lowest first)
    return a.financial.margin_percent - b.financial.margin_percent
  })

  const getStatusColor = (margin: number, dataHealth: string) => {
    if (dataHealth === 'missing') return 'destructive'
    if (dataHealth === 'stale' || margin < 5) return 'destructive'
    if (margin < 10) return 'secondary'
    return 'default'
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'missing':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'stale':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Manager Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your projects and keep data current
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alert Banner */}
      <PMAlertBanner 
        projectIds={projectIds} 
        onImportClick={handleImportClick}
      />

      {/* My Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Projects</CardTitle>
          <CardDescription>
            Active projects requiring your attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Cost to Date</TableHead>
                <TableHead>Forecast Final</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map(project => {
                const lastUpdate = project.data_health.last_labor_import || project.data_health.last_po_import
                const daysSinceUpdate = lastUpdate 
                  ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getHealthIcon(project.data_health.status)}
                        <div>
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-muted-foreground">#{project.job_number}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{project.division.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Physical:</span>{' '}
                          {formatPercentage(project.physical_percent_complete)}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Budget:</span>{' '}
                          {formatPercentage(project.percent_complete)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(project.financial.margin_percent, project.data_health.status)}>
                        {project.data_health.status === 'missing' ? 'Data Missing' : 
                         project.data_health.status === 'stale' ? 'Data Stale' :
                         project.financial.margin_percent < 5 ? 'At Risk' :
                         project.financial.margin_percent < 10 ? 'Warning' : 'On Track'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {formatPercentage(project.financial.margin_percent)}
                        {project.financial.margin_percent < 10 && (
                          project.financial.margin_percent < 5 
                            ? <TrendingDown className="h-3 w-3 text-red-600" />
                            : <TrendingDown className="h-3 w-3 text-yellow-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(project.financial.actual_cost_to_date)}</TableCell>
                    <TableCell>{formatCurrency(project.financial.forecasted_final_cost)}</TableCell>
                    <TableCell>
                      <span className={project.financial.variance_at_completion >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(project.financial.variance_at_completion)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {daysSinceUpdate !== null ? (
                        <span className={daysSinceUpdate > 7 ? 'text-red-600' : 'text-muted-foreground'}>
                          {daysSinceUpdate}d ago
                        </span>
                      ) : (
                        <span className="text-red-600">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleImportClick(project.id, 'labor')}
                        >
                          <Upload className="h-3 w-3" />
                          Labor
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleImportClick(project.id, 'po')}
                        >
                          <Upload className="h-3 w-3" />
                          PO
                        </Button>
                        <Link href={`/projects/${project.id}/overview`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {sortedProjects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No active projects assigned
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Import Section */}
      <QuickImportSection
        projects={dashboardData.map(p => ({
          id: p.id,
          name: p.name,
          job_number: p.job_number
        }))}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        onImportComplete={handleRefresh}
      />

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quick Import - {importType === 'labor' ? 'Labor Data' : 'PO Log'}</DialogTitle>
          </DialogHeader>
          <QuickImportSection
            projects={dashboardData.map(p => ({
              id: p.id,
              name: p.name,
              job_number: p.job_number
            }))}
            selectedProjectId={selectedProjectId}
            onImportComplete={handleImportComplete}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}