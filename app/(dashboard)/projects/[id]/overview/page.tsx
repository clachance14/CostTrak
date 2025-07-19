'use client'

import { use, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Plus,
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  FileText,
  BarChart3,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { POLogTable } from '@/components/purchase-orders/po-log-table'
import { ActionRequiredBanner } from '@/components/project/action-required-banner'
import { ClickableProgressBar } from '@/components/project/clickable-progress-bar'
import { FinancialMetricCard } from '@/components/project/financial-metric-card'
import { ProjectNotes } from '@/components/project/project-notes'
import { BudgetVsActualTab } from '@/components/project/budget-vs-actual-tab'
import { BudgetBreakdownByDiscipline } from '@/components/project/budget-breakdown-by-discipline'
import { LaborTab } from '@/components/project/labor-tab'
import { LaborForecastTab } from '@/components/project/labor-forecast-tab'
import { ChangeOrderTable } from '@/components/change-orders/change-order-table'
import { ClientPOUpdateDialog } from '@/components/projects/client-po-update-dialog'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: user } = useUser()
  const { id } = use(params)
  const defaultTab = searchParams.get('tab') || 'financial'
  const [projectNotes] = useState<Array<{
    id: string
    content: string
    created_at: string
    created_by: { id: string; first_name: string; last_name: string }
    note_type: 'general' | 'cost_to_complete' | 'risk' | 'schedule'
  }>>([])
  const [showClientPODialog, setShowClientPODialog] = useState(false)
  // const [showImportDialog, setShowImportDialog] = useState(false)
  // const [importType, setImportType] = useState<'labor' | 'po' | 'budget'>('labor')

  // Fetch comprehensive financial summary
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['project-financial-summary', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/financial-summary`)
      if (!response.ok) {
        throw new Error('Failed to fetch project summary')
      }
      const data = await response.json()
      return data.summary
    }
  })

  // Fetch project dashboard summary for data health
  const { data: dashboardSummary } = useQuery({
    queryKey: ['project-dashboard-summary', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/dashboard-summary`)
      if (!response.ok) return null
      return response.json()
    }
  })

  // Fetch contract details
  const { data: contractData } = useQuery({
    queryKey: ['project-contract', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/contract`)
      if (!response.ok) return null
      const data = await response.json()
      return data.contractBreakdown
    }
  })

  const canEdit = user && ['controller', 'executive', 'ops_manager', 'project_manager'].includes(user.role)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatPercent = (value: number) => {
    return `${(value || 0).toFixed(1)}%`
  }

  const formatPercentSimple = (value: number) => {
    return `${Math.round(value || 0)}%`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'planning': return 'bg-blue-100 text-blue-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600">Error loading project summary</p>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Loading project summary...</p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Project not found</p>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const { project, financialMetrics, budgetBreakdown, purchaseOrders, changeOrders, riskFactors } = summary

  // Calculate action items
  const actionItems = []
  
  // Check for stale labor data
  if (dashboardSummary?.data_health?.last_labor_import) {
    const daysSince = Math.floor((new Date().getTime() - new Date(dashboardSummary.data_health.last_labor_import).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince > 7) {
      actionItems.push({
        type: 'stale_labor' as const,
        severity: 'critical' as const,
        message: `Labor data is ${daysSince} days old`,
        actionLabel: 'Import Labor',
        onAction: () => {
          // TODO: Implement labor import
          router.push(`/labor/import?project_id=${id}`)
        }
      })
    } else if (daysSince > 3) {
      actionItems.push({
        type: 'stale_labor' as const,
        severity: 'warning' as const,
        message: `Labor data is ${daysSince} days old`,
        actionLabel: 'Import Labor',
        onAction: () => {
          // TODO: Implement labor import
          router.push(`/labor/import?project_id=${id}`)
        }
      })
    }
  } else {
    actionItems.push({
      type: 'missing_labor' as const,
      severity: 'critical' as const,
      message: 'No labor data imported',
      actionLabel: 'Import Labor',
      onAction: () => {
        // TODO: Implement labor import
        router.push(`/labor/import?project_id=${id}`)
      }
    })
  }
  
  // Check for low margin
  if (financialMetrics.profitMargin < 5 && financialMetrics.profitMargin >= 0) {
    actionItems.push({
      type: 'low_margin' as const,
      severity: 'warning' as const,
      message: `Low profit margin: ${financialMetrics.profitMargin.toFixed(1)}%`,
      actionLabel: 'Review Costs',
      onAction: () => {
        const budgetTab = document.querySelector('[value="budget"]')
        if (budgetTab) (budgetTab as HTMLElement).click()
      }
    })
  } else if (financialMetrics.profitMargin < 0) {
    actionItems.push({
      type: 'low_margin' as const,
      severity: 'critical' as const,
      message: `Negative margin: ${financialMetrics.profitMargin.toFixed(1)}%`,
      actionLabel: 'Review Costs',
      onAction: () => {
        const budgetTab = document.querySelector('[value="budget"]')
        if (budgetTab) (budgetTab as HTMLElement).click()
      }
    })
  }

  // Progress breakdown for clickable progress bar
  const progressBreakdown = budgetBreakdown && Object.keys(budgetBreakdown).length > 0 ? 
    Object.entries(budgetBreakdown).map(([category, data]) => {
      const budgetData = data as { actual: number; budget: number }
      return {
        label: category,
        value: budgetData.actual,
        percentage: budgetData.budget > 0 ? (budgetData.actual / budgetData.budget) * 100 : 0
      }
    }) : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Required Banner */}
      <ActionRequiredBanner actions={actionItems} />
      {/* Sticky Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/projects')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.name}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-gray-600">Job #{project.job_number}</span>
                  <Badge className={getStatusColor(project.status)}>
                    {project.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {project.client.name} • {project.division.name}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Key Metrics Bar */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-gray-500">Contract Value</div>
                <div className="font-semibold text-lg">
                  {formatCurrency(financialMetrics.revisedContract)}
                </div>
                {contractData?.client_po_number && (
                  <div className="text-xs text-gray-500 mt-1">
                    PO: {contractData.client_po_number}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-gray-500">Forecasted Profit</div>
                <div className={`font-semibold text-lg ${financialMetrics.forecastedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialMetrics.forecastedProfit)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">Margin %</div>
                <div className={`font-semibold text-lg ${financialMetrics.profitMargin >= 5 ? 'text-green-600' : financialMetrics.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatPercentSimple(financialMetrics.profitMargin)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">% Complete</div>
                <div className="font-semibold text-lg">
                  {formatPercentSimple(financialMetrics.percentComplete)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {(user?.role === 'controller' || summary?.project?.project_manager_id === user?.id) && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${id}/team`)}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Team
                </Button>
              )}
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="financial">Financial Summary</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="budget">Budget vs Actual</TabsTrigger>
            <TabsTrigger value="budget-detail">Budget Detail</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
            <TabsTrigger value="alerts">Issues & Alerts</TabsTrigger>
          </TabsList>

          {/* Financial Summary Tab */}
          <TabsContent value="financial" className="space-y-6">
            {/* Key Financial Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FinancialMetricCard
                title="Current Contract"
                value={formatCurrency(financialMetrics.revisedContract)}
                icon={DollarSign}
                helpText="Original contract plus approved change orders"
                details={[
                  {
                    label: 'Contract Breakdown',
                    value: formatCurrency(financialMetrics.revisedContract),
                    subItems: [
                      { label: 'Original Contract', value: formatCurrency(financialMetrics.originalContract) },
                      { label: 'Approved COs', value: formatCurrency(financialMetrics.approvedChangeOrders), isPositive: true }
                    ]
                  }
                ]}
              />
              <FinancialMetricCard
                title="Forecasted Cost"
                value={formatCurrency(financialMetrics.estimateAtCompletion)}
                icon={BarChart3}
                status={financialMetrics.estimateAtCompletion <= financialMetrics.revisedContract * 0.9 ? 'good' : 
                        financialMetrics.estimateAtCompletion <= financialMetrics.revisedContract ? 'warning' : 'danger'}
                helpText="Total forecasted cost at project completion"
                details={[
                  {
                    label: 'Cost Forecast',
                    value: formatCurrency(financialMetrics.estimateAtCompletion),
                    subItems: [
                      { label: 'Percent of Contract', value: formatPercentSimple((financialMetrics.estimateAtCompletion / financialMetrics.revisedContract) * 100) },
                      { label: 'Actual to Date', value: formatCurrency(financialMetrics.actualCostToDate) },
                      { label: 'Estimate to Complete', value: formatCurrency(financialMetrics.estimateToComplete) }
                    ]
                  }
                ]}
              />
              <FinancialMetricCard
                title="Forecasted Profit & Margin"
                value={formatCurrency(financialMetrics.forecastedProfit)}
                status={financialMetrics.forecastedProfit >= 0 ? 'good' : 'danger'}
                icon={TrendingUp}
                trend={{
                  value: financialMetrics.profitMargin,
                  isPositive: financialMetrics.profitMargin >= 5
                }}
                helpText="Expected profit and margin at project completion"
                details={[
                  {
                    label: 'Profit Breakdown',
                    value: formatCurrency(financialMetrics.forecastedProfit),
                    subItems: [
                      { label: 'Profit Margin', value: formatPercentSimple(financialMetrics.profitMargin), isPositive: financialMetrics.profitMargin >= 5 }
                    ]
                  }
                ]}
              />
              <FinancialMetricCard
                title="Cost Variance"
                value={formatCurrency(financialMetrics.varianceAtCompletion)}
                status={financialMetrics.varianceAtCompletion >= 0 ? 'good' : 'danger'}
                helpText="Difference between budget and forecast"
                details={[
                  {
                    label: 'Variance Analysis',
                    value: formatCurrency(financialMetrics.varianceAtCompletion),
                    subItems: [
                      { label: 'Budget (EAC)', value: formatCurrency(financialMetrics.estimateAtCompletion) },
                      { label: 'Actual to Date', value: formatCurrency(financialMetrics.actualCostToDate) },
                      { label: 'Est. to Complete', value: formatCurrency(financialMetrics.estimateToComplete) }
                    ]
                  }
                ]}
              />
            </div>

            {/* Progress Bar */}
            <Card>
              <CardContent className="pt-6">
                <ClickableProgressBar
                  value={financialMetrics.percentComplete}
                  label="Project Progress"
                  progressMethod={project.physical_progress_method as 'labor_hours' | 'cost' | 'milestones'}
                  breakdown={progressBreakdown}
                  className="mb-4"
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial Metrics Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original Contract</span>
                      <span className="font-semibold">{formatCurrency(financialMetrics.originalContract)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Change Orders (Approved)</span>
                      <span className="font-semibold text-green-600">+{formatCurrency(financialMetrics.approvedChangeOrders)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Revised Contract</span>
                      <span className="font-bold text-lg">{formatCurrency(financialMetrics.revisedContract)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Cost to Date (AC)</span>
                      <span className="font-semibold">{formatCurrency(financialMetrics.actualCostToDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimate to Complete (ETC)</span>
                      <span className="font-semibold">{formatCurrency(financialMetrics.estimateToComplete)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Forecasted Cost (EAC)</span>
                      <span className="font-semibold">{formatCurrency(financialMetrics.estimateAtCompletion)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Variance at Completion</span>
                      <span className={`font-bold ${financialMetrics.varianceAtCompletion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {financialMetrics.varianceAtCompletion >= 0 ? '+' : ''}{formatCurrency(financialMetrics.varianceAtCompletion)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Forecasted Profit</span>
                      <span className={`font-bold ${financialMetrics.forecastedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(financialMetrics.forecastedProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Profit Margin %</span>
                      <span className={`font-bold ${financialMetrics.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentSimple(financialMetrics.profitMargin)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client PO Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Client PO Details
                    </span>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowClientPODialog(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Update
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Client PO Number</span>
                      <span className="font-semibold">
                        {contractData?.client_po_number || 'Not Set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Client Representative</span>
                      <span className="font-semibold">
                        {contractData?.client_representative || 'Not Set'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progress & Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Progress & Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Progress Bar in this card */}
                    <ClickableProgressBar
                      value={financialMetrics.percentComplete}
                      label="Overall Progress"
                      progressMethod={project.physical_progress_method as 'labor_hours' | 'cost' | 'milestones'}
                      breakdown={progressBreakdown}
                    />

                    {/* Key Performance Indicators */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{purchaseOrders.length}</div>
                        <div className="text-sm text-gray-600">Purchase Orders</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{changeOrders.filter((co: any) => co.status === 'approved').length}</div>
                        <div className="text-sm text-gray-600">Approved COs</div>
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Project Manager</span>
                        <span className="font-medium">{project.project_manager.first_name} {project.project_manager.last_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Start Date</span>
                        <span className="font-medium">{format(new Date(project.start_date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">End Date</span>
                        <span className="font-medium">{format(new Date(project.end_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Project Notes */}
            <ProjectNotes
              notes={projectNotes}
              canEdit={canEdit || false}
              onNoteAdded={async (note) => {
                // TODO: Implement note creation API
                console.log('Add note:', note)
              }}
              onNoteUpdated={async (noteId, content) => {
                // TODO: Implement note update API
                console.log('Update note:', noteId, content)
              }}
            />
          </TabsContent>

          {/* Labor Tab */}
          <TabsContent value="labor" className="space-y-6">
            <LaborTab 
              projectId={id}
              projectName={project.name}
              jobNumber={project.jobNumber}
            />
          </TabsContent>

          {/* Budget vs Actual Tab */}
          <TabsContent value="budget" className="space-y-6">
            <BudgetVsActualTab 
              projectId={id} 
              contractValue={financialMetrics.revisedContract}
            />
          </TabsContent>

          {/* Budget Detail Tab */}
          <TabsContent value="budget-detail" className="space-y-6">
            <BudgetBreakdownByDiscipline projectId={id} />
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="purchase-orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Purchase Orders</span>
                  {canEdit && (
                    <Button 
                      size="sm"
                      onClick={() => router.push('/purchase-orders/import')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Import POs
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {purchaseOrders.length > 0 ? (
                  <POLogTable purchaseOrders={purchaseOrders} projectId={id} />
                ) : (
                  <p className="text-gray-500 text-center py-8">No purchase orders found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Change Orders Tab */}
          <TabsContent value="change-orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Change Orders</span>
                  {canEdit && (
                    <Button 
                      size="sm"
                      onClick={() => {
                        console.log('Navigating to change order form with project_id:', id)
                        router.push(`/change-orders/new?project_id=${id}`)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Change Order
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {changeOrders.length > 0 ? (
                  <ChangeOrderTable 
                    changeOrders={changeOrders}
                    projectId={id}
                    canEdit={canEdit || false}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['project-financial-summary', id] })}
                  />
                ) : (
                  <p className="text-gray-500 text-center py-8">No change orders found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues & Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Issues & Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskFactors.length > 0 ? (
                  <div className="space-y-4">
                    {riskFactors.map((risk: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${risk.severity === 'high' ? 'text-red-600' : risk.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getRiskColor(risk.severity)}>
                              {risk.severity.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {risk.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-gray-700">{risk.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-green-600 mb-2">
                      <TrendingUp className="h-8 w-8 mx-auto" />
                    </div>
                    <p className="text-gray-500">No issues or alerts. Project is on track!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost to Complete Notes */}
            {project.cost_to_complete_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Cost to Complete Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                      {project.cost_to_complete_notes}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Forecast Tab - Labor Forecast */}
          <TabsContent value="forecast" className="space-y-6">
            <LaborForecastTab 
              projectId={id}
              projectName={project.name}
              jobNumber={project.job_number}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Client PO Update Dialog */}
      <ClientPOUpdateDialog
        open={showClientPODialog}
        onOpenChange={setShowClientPODialog}
        projectId={id}
        currentPONumber={contractData?.client_po_number}
        currentRepresentative={contractData?.client_representative}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['project-contract', id] })
          queryClient.invalidateQueries({ queryKey: ['project-financial-summary', id] })
        }}
      />
    </div>
  )
}