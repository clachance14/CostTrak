'use client'

import { useEffect, useState } from 'react'
import { 
  Briefcase,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import { useUserProjects } from '@/hooks/use-user-projects'
import Link from 'next/link'

interface ProjectDashboard {
  id: string
  project: {
    id: string
    jobNumber: string
    name: string
    status: string
    client: { name: string }
    division: { name: string }
  }
  financialSummary: {
    revisedContract: number
    committedCosts: number
    actualCosts: number
    marginPercent: number
    percentComplete: number
  }
  purchaseOrders: {
    summary: {
      totalPOs: number
      totalCommitted: number
    }
  }
}

export default function ProjectManagerDashboard() {
  const { projects, loading: projectsLoading } = useUserProjects()
  const [dashboardData, setDashboardData] = useState<ProjectDashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectsLoading && projects.length > 0) {
      fetchDashboardData()
    } else if (!projectsLoading && projects.length === 0) {
      setLoading(false)
    }
  }, [projectsLoading, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async () => {
    try {
      const dashboards = await Promise.all(
        projects.map(async (project) => {
          const response = await fetch(`/api/dashboards/project/${project.id}`)
          if (!response.ok) throw new Error(`Failed to fetch data for ${project.name}`)
          const result = await response.json()
          return result.data
        })
      )
      setDashboardData(dashboards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Manager Dashboard</h1>
          <p className="text-gray-700">Your project performance overview</p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You are not assigned to any projects yet. Contact your administrator to get assigned to projects.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Calculate summary metrics
  const totalContract = dashboardData.reduce((sum, d) => sum + d.financialSummary.revisedContract, 0)
  const totalCommitted = dashboardData.reduce((sum, d) => sum + d.financialSummary.committedCosts, 0)
  const activeProjects = dashboardData.filter(d => d.project.status === 'active').length
  // const avgMargin = dashboardData.length > 0
  //   ? dashboardData.reduce((sum, d) => sum + d.financialSummary.marginPercent, 0) / dashboardData.length
  //   : 0

  // Identify at-risk projects (margin < 10%)
  const atRiskProjects = dashboardData.filter(d => d.financialSummary.marginPercent < 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Manager Dashboard</h1>
        <p className="text-gray-700">
          Managing {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value={activeProjects}
          description={`of ${projects.length} total`}
          icon={Briefcase}
        />
        <MetricCard
          title="Total Contract Value"
          value={formatCurrency(totalContract)}
          description="Across all projects"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Committed"
          value={formatCurrency(totalCommitted)}
          description="Purchase orders"
          icon={TrendingUp}
        />
        <MetricCard
          title="At Risk Projects"
          value={atRiskProjects.length}
          description="Margin below 10%"
          icon={AlertTriangle}
          className={atRiskProjects.length > 0 ? "border-orange-200" : ""}
        />
      </div>

      {/* Projects Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
          <CardDescription>Performance overview of all assigned projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Complete %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardData.map((data) => (
                <TableRow key={data.project.id}>
                  <TableCell className="font-medium">{data.project.jobNumber}</TableCell>
                  <TableCell>{data.project.name}</TableCell>
                  <TableCell>{data.project.client.name}</TableCell>
                  <TableCell>
                    <Badge variant={data.project.status === 'active' ? 'default' : 'secondary'}>
                      {data.project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(data.financialSummary.revisedContract)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(data.financialSummary.committedCosts)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={data.financialSummary.marginPercent < 10 ? 'text-orange-600 font-medium' : ''}>
                      {data.financialSummary.marginPercent.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {data.financialSummary.percentComplete.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${data.project.id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* At Risk Projects Alert */}
      {atRiskProjects.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention Required:</strong> {atRiskProjects.length} project{atRiskProjects.length !== 1 ? 's have' : ' has'} margins below 10%:
            <ul className="mt-2 ml-4 list-disc">
              {atRiskProjects.map(p => (
                <li key={p.project.id}>
                  {p.project.jobNumber} - {p.project.name} ({p.financialSummary.marginPercent.toFixed(1)}%)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}