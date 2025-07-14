'use client'

import { useQuery } from '@tanstack/react-query'
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface ProjectBudgetSummary {
  projectId: string
  jobNumber: string
  projectName: string
  status: string
  originalContract: number
  revisedContract: number
  budgetTotal: number
  poCommitted: number
  actualSpent: number
  budgetVariance: number
  budgetVariancePercent: number
  utilizationPercent: number
  riskStatus: 'normal' | 'at-risk' | 'over-budget'
  lastUpdated: string
  disciplineCount: number
  totalManhours: number
}

export default function ProjectManagerBudgetOverview() {
  const router = useRouter()
  const { data: user } = useUser()

  // Fetch my projects budget summary
  const { data: budgetData, isLoading, error } = useQuery({
    queryKey: ['my-projects-budget'],
    queryFn: async () => {
      const response = await fetch('/api/project-manager/my-projects-budget')
      if (!response.ok) throw new Error('Failed to fetch budget summary')
      return response.json()
    },
    enabled: user?.role === 'project_manager'
  })

  const getRiskStatusIcon = (status: string) => {
    switch (status) {
      case 'over-budget':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'at-risk':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />
    }
  }

  const getRiskStatusColor = (status: string) => {
    switch (status) {
      case 'over-budget':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'at-risk':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  if (!user || user.role !== 'project_manager') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p>Access denied. This page is only available to Project Managers.</p>
          </div>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error || !budgetData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p>Error loading budget data: {error?.message}</p>
          </div>
        </Card>
      </div>
    )
  }

  const { summary, projects } = budgetData

  // Separate projects by risk status
  const criticalProjects = projects.filter((p: ProjectBudgetSummary) => p.riskStatus === 'over-budget')
  const atRiskProjects = projects.filter((p: ProjectBudgetSummary) => p.riskStatus === 'at-risk')

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Projects Budget</h1>
          <p className="text-foreground/60">
            Budget overview for {summary.projectCount} assigned projects
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalBudget)}</p>
              <p className="text-sm text-foreground/60">{summary.projectCount} projects</p>
            </div>
            <DollarSign className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Committed</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalCommitted)}</p>
              <p className="text-sm text-foreground/60">
                {summary.averageUtilization.toFixed(1)}% avg utilization
              </p>
            </div>
            <FileText className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Actual Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalActual)}</p>
              <p className="text-sm text-foreground/60">
                {summary.totalBudget > 0 ? ((summary.totalActual / summary.totalBudget) * 100).toFixed(1) : 0}% of budget
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Projects at Risk</p>
              <p className="text-2xl font-bold text-red-600">{summary.projectsAtRisk}</p>
              <p className="text-sm text-foreground/60">Need attention</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-300" />
          </div>
        </Card>
      </div>

      {/* Critical Projects Alert */}
      {criticalProjects.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Critical Budget Issues</h3>
          </div>
          <div className="space-y-2">
            {criticalProjects.map((project: ProjectBudgetSummary) => (
              <div key={project.projectId} className="flex items-center justify-between p-2 bg-white rounded border">
                <div>
                  <p className="font-medium">{project.jobNumber} - {project.projectName}</p>
                  <p className="text-sm text-red-600">
                    Budget variance: {project.budgetVariance < 0 ? '-' : '+'}{formatCurrency(Math.abs(project.budgetVariance))} 
                    ({Math.abs(project.budgetVariancePercent).toFixed(1)}%)
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push(`/project-manager/projects/${project.projectId}/budget`)}
                >
                  Review Budget
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* At Risk Projects */}
      {atRiskProjects.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">Projects Requiring Attention</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {atRiskProjects.map((project: ProjectBudgetSummary) => (
              <div key={project.projectId} className="p-3 bg-white rounded border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{project.jobNumber}</p>
                    <p className="text-sm text-foreground/60 truncate">{project.projectName}</p>
                    <p className="text-sm text-yellow-600">
                      {project.utilizationPercent.toFixed(1)}% utilization
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/project-manager/projects/${project.projectId}/budget`)}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Projects Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Projects</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Project</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Budget</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Committed</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Utilization</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Variance</th>
                <th className="px-4 py-2 text-center text-sm font-medium">Risk</th>
                <th className="px-4 py-2 text-center text-sm font-medium">Last Updated</th>
                <th className="px-4 py-2 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project: ProjectBudgetSummary) => (
                <tr key={project.projectId} className="hover:bg-background">
                  <td className="px-4 py-2">
                    <div>
                      <p className="font-medium">{project.jobNumber}</p>
                      <p className="text-sm text-foreground/60 truncate max-w-48">{project.projectName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div>
                      <p className="font-medium">{formatCurrency(project.budgetTotal)}</p>
                      {project.disciplineCount > 0 && (
                        <p className="text-xs text-foreground/60">{project.disciplineCount} disciplines</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(project.poCommitted)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className={`${project.utilizationPercent > 90 ? 'text-yellow-600' : 'text-foreground'}`}>
                      {project.utilizationPercent.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className={`${Math.abs(project.budgetVariancePercent) > 10 ? 'text-red-600' : 'text-foreground'}`}>
                      {project.budgetVariance < 0 ? '-' : '+'}{formatCurrency(Math.abs(project.budgetVariance))}
                      <div className="text-xs">
                        {Math.abs(project.budgetVariancePercent).toFixed(1)}%
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getRiskStatusColor(project.riskStatus)}`}>
                      {getRiskStatusIcon(project.riskStatus)}
                      {project.riskStatus}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-foreground/60">
                    {project.lastUpdated ? formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true }) : 'N/A'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/project-manager/projects/${project.projectId}/budget`)}
                    >
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}