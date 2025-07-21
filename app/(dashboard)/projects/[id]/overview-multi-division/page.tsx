'use client'

import { use, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  FileText,
  BarChart3,
  Shield,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ActionRequiredBanner } from '@/components/project/action-required-banner'
import { ClickableProgressBar } from '@/components/project/clickable-progress-bar'
import { FinancialMetricCard } from '@/components/project/financial-metric-card'
import { ProjectNotes } from '@/components/project/project-notes'
import { BudgetVsActualTab } from '@/components/project/budget-vs-actual-tab'
import { DivisionTabs } from '@/components/project/division-tabs'
import { DivisionAlerts } from '@/components/project/division-alerts'
import { ClientPOUpdateDialog } from '@/components/projects/client-po-update-dialog'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>
}

export default function MultiDivisionProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: user } = useUser()
  const { id } = use(params)
  const defaultTab = searchParams.get('tab') || 'financial'
  const [showClientPODialog, setShowClientPODialog] = useState(false)

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

  // Fetch project divisions
  const { data: divisions } = useQuery({
    queryKey: ['project-divisions', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/divisions`)
      if (!response.ok) return []
      const data = await response.json()
      return data.divisions || []
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

  const { project, financialMetrics, riskFactors } = summary

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
          router.push(`/labor/import?project_id=${id}`)
        }
      })
    }
  }

  // Check for margin risk
  if (financialMetrics.marginPercent < 10 && financialMetrics.marginPercent > 0) {
    actionItems.push({
      type: 'margin_risk' as const,
      severity: 'warning' as const,
      message: `Profit margin at ${formatPercent(financialMetrics.marginPercent)}`,
      actionLabel: 'Review Costs',
      onAction: () => {
        // Navigate to budget vs actual tab
        const element = document.getElementById('budget-vs-actual')
        element?.scrollIntoView({ behavior: 'smooth' })
      }
    })
  } else if (financialMetrics.marginPercent < 0) {
    actionItems.push({
      type: 'margin_risk' as const,
      severity: 'critical' as const,
      message: `Project showing negative margin`,
      actionLabel: 'Urgent Review',
      onAction: () => {
        const element = document.getElementById('budget-vs-actual')
        element?.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  // Check for budget overrun
  if (financialMetrics.varianceAtCompletion < 0) {
    const overrunPercent = Math.abs(financialMetrics.varianceAtCompletion / financialMetrics.revisedContract * 100)
    actionItems.push({
      type: 'budget_overrun' as const,
      severity: overrunPercent > 10 ? 'critical' : 'warning',
      message: `Projected ${formatPercent(overrunPercent)} over budget`,
      actionLabel: 'Review Forecast',
      onAction: () => {
        const element = document.getElementById('financial-summary')
        element?.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Action Required Banner */}
      {actionItems.length > 0 && (
        <ActionRequiredBanner actions={actionItems} />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/projects')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
            <div className="flex gap-2">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/projects/${id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowClientPODialog(true)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Update Client PO
                  </Button>
                </>
              )}
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-gray-600">Job #{project.job_number}</span>
                <Badge className={getStatusColor(project.status || 'active')}>
                  {project.status || 'Active'}
                </Badge>
                {divisions && divisions.length > 1 && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {divisions.length} Divisions
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Key Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="font-medium">{project.client?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Lead Project Manager</p>
              <p className="font-medium">
                {project.project_manager ? 
                  `${project.project_manager.first_name} ${project.project_manager.last_name}` : 
                  'N/A'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Schedule</p>
              <p className="font-medium">
                {project.start_date && project.end_date ? 
                  `${format(new Date(project.start_date), 'MMM d, yyyy')} - ${format(new Date(project.end_date), 'MMM d, yyyy')}` :
                  'N/A'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <ClickableProgressBar
            percentComplete={financialMetrics.percentComplete || 0}
            label="Project Progress"
            onClick={() => {
              const element = document.getElementById('financial-summary')
              element?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>

        {/* Division Alerts Summary */}
        <div className="mb-6">
          <DivisionAlerts projectId={id} compact={true} />
        </div>

        {/* Financial Summary Cards */}
        <div id="financial-summary" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <FinancialMetricCard
            title="Contract Value"
            value={formatCurrency(financialMetrics.revisedContract)}
            subtitle={financialMetrics.approvedChangeOrders > 0 ? 
              `Original: ${formatCurrency(financialMetrics.originalContract)}` : 
              undefined
            }
            icon={DollarSign}
            trend="neutral"
          />
          <FinancialMetricCard
            title="Projected Final Cost"
            value={formatCurrency(financialMetrics.forecastedCost)}
            subtitle={`Committed: ${formatCurrency(financialMetrics.totalCommitted)}`}
            icon={TrendingUp}
            trend={financialMetrics.varianceAtCompletion >= 0 ? 'positive' : 'negative'}
          />
          <FinancialMetricCard
            title="Projected Profit"
            value={formatCurrency(financialMetrics.forecastedProfit)}
            subtitle={`Margin: ${formatPercent(financialMetrics.marginPercent)}`}
            icon={BarChart3}
            trend={financialMetrics.marginPercent >= 15 ? 'positive' : 
                   financialMetrics.marginPercent >= 10 ? 'neutral' : 'negative'}
          />
          <FinancialMetricCard
            title="Variance at Completion"
            value={formatCurrency(Math.abs(financialMetrics.varianceAtCompletion))}
            subtitle={financialMetrics.varianceAtCompletion >= 0 ? 'Under Budget' : 'Over Budget'}
            icon={financialMetrics.varianceAtCompletion >= 0 ? Shield : AlertTriangle}
            trend={financialMetrics.varianceAtCompletion >= 0 ? 'positive' : 'negative'}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="financial">Financial Summary</TabsTrigger>
            <TabsTrigger value="divisions">Divisions</TabsTrigger>
            <TabsTrigger value="budget">Budget Analysis</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-6">
            {/* Risk Factors */}
            {riskFactors && riskFactors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {riskFactors.map((risk: { description: string; severity: string }, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <span className="text-sm">{risk.description}</span>
                        <Badge className={risk.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {risk.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract Information */}
            {contractData && (
              <Card>
                <CardHeader>
                  <CardTitle>Contract Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Client PO Number</p>
                      <p className="font-medium">{contractData.client_po_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Client Representative</p>
                      <p className="font-medium">{contractData.client_representative || 'N/A'}</p>
                    </div>
                  </div>
                  {contractData.po_line_items && contractData.po_line_items.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">PO Line Items</p>
                      <div className="space-y-1">
                        {contractData.po_line_items.map((item: { description: string; amount: number }, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.description}</span>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="divisions" className="space-y-6">
            <DivisionTabs projectId={id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="budget" id="budget-vs-actual" className="space-y-6">
            <BudgetVsActualTab
              projectId={id}
              budgetBreakdown={budgetBreakdown}
              actualCosts={{
                labor: financialMetrics.actualLaborCost || 0,
                materials: financialMetrics.actualMaterialsCost || 0,
                equipment: financialMetrics.actualEquipmentCost || 0,
                subcontracts: financialMetrics.actualSubcontractsCost || 0,
                other: financialMetrics.actualOtherCost || 0
              }}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Document management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <ProjectNotes
              projectId={id}
              notes={[]}
              canEdit={canEdit}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {showClientPODialog && contractData && (
        <ClientPOUpdateDialog
          isOpen={showClientPODialog}
          onClose={() => setShowClientPODialog(false)}
          projectId={id}
          currentData={contractData}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['project-contract', id] })
            setShowClientPODialog(false)
          }}
        />
      )}
    </div>
  )
}