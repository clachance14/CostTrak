'use client'

import { useQuery } from '@tanstack/react-query'
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  BarChart3,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface ProjectBudgetSummary {
  projectId: string
  jobNumber: string
  projectName: string
  status: string
  originalContract: number
  budgetTotal: number
  poCommitted: number
  actualSpent: number
  budgetVariance: number
  budgetVariancePercent: number
  utilizationPercent: number
  riskStatus: 'normal' | 'at-risk' | 'over-budget'
}

interface DisciplineSummary {
  discipline: string
  budgetTotal: number
  committed: number
  actual: number
  variance: number
  variancePercent: number
}

export default function OpsManagerBudgetOverview() {
  const router = useRouter()
  const { data: user } = useUser()

  // Fetch division budget summary
  const { data: budgetData, isLoading, error } = useQuery({
    queryKey: ['division-budget-summary', user?.division_id],
    queryFn: async () => {
      if (!user?.division_id) throw new Error('No division assigned')
      
      const response = await fetch(`/api/ops-manager/division-budget-summary/${user.division_id}`)
      if (!response.ok) throw new Error('Failed to fetch budget summary')
      return response.json()
    },
    enabled: !!user?.division_id && user?.role === 'ops_manager'
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
        return 'text-red-600 bg-red-50'
      case 'at-risk':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-green-600 bg-green-50'
    }
  }

  const exportDivisionBudget = async () => {
    // Implementation for exporting division budget to Excel
    console.log('Export division budget')
  }

  if (!user || user.role !== 'ops_manager') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p>Access denied. This page is only available to Operations Managers.</p>
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

  const { summary, projects, disciplines } = budgetData

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Division Budget Overview</h1>
          <p className="text-foreground/60">
            Budget analysis for {budgetData.division.projectCount} active projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportDivisionBudget}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalBudget)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Committed (POs)</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalCommitted)}</p>
              <p className="text-sm text-foreground/60">
                {summary.totalBudget > 0 ? ((summary.totalCommitted / summary.totalBudget) * 100).toFixed(1) : 0}% of budget
              </p>
            </div>
            <FileSpreadsheet className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Budget Variance</p>
              <p className="text-2xl font-bold">{formatCurrency(Math.abs(summary.totalVariance))}</p>
              <p className={`text-sm ${summary.totalVariance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalVariance < 0 ? 'Under' : 'Over'} budget
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Avg Utilization</p>
              <p className="text-2xl font-bold">{summary.averageUtilization.toFixed(1)}%</p>
              <p className="text-sm text-foreground/60">Budget committed</p>
            </div>
            <BarChart3 className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>
      </div>

      {/* Project Budget Summary Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Project Budget Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Project</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Contract</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Budget</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Committed</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Variance</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Utilization</th>
                <th className="px-4 py-2 text-center text-sm font-medium">Risk</th>
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
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCurrency(project.originalContract)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCurrency(project.budgetTotal)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(project.poCommitted)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className={`${Math.abs(project.budgetVariancePercent) > 10 ? 'text-red-600' : 'text-foreground'}`}>
                      {formatCurrency(Math.abs(project.budgetVariance))}
                      <div className="text-xs">
                        {project.budgetVariance < 0 ? '-' : '+'}{Math.abs(project.budgetVariancePercent).toFixed(1)}%
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className={`${project.utilizationPercent > 90 ? 'text-yellow-600' : 'text-foreground'}`}>
                      {project.utilizationPercent.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getRiskStatusColor(project.riskStatus)}`}>
                      {getRiskStatusIcon(project.riskStatus)}
                      {project.riskStatus}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/ops-manager/projects/${project.projectId}/budget`)}
                    >
                      View Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Discipline Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Budget by Discipline</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Discipline</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Budget Total</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Committed</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Actual</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Variance</th>
                <th className="px-4 py-2 text-right text-sm font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disciplines.map((discipline: DisciplineSummary) => (
                <tr key={discipline.discipline}>
                  <td className="px-4 py-2 font-medium">{discipline.discipline}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(discipline.budgetTotal)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(discipline.committed)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(discipline.actual)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={discipline.variance < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(discipline.variance))}
                      {discipline.variance < 0 ? ' over' : ' under'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {summary.totalBudget > 0 ? ((discipline.budgetTotal / summary.totalBudget) * 100).toFixed(1) : 0}%
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