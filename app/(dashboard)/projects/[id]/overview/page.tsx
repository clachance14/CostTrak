'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Edit, 
  Upload,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { LaborAnalyticsView } from '@/components/labor/labor-analytics-view'
import { LaborForecastTab } from '@/components/project/labor-forecast-tab'
import { BudgetVsActualTab } from '@/components/project/budget-vs-actual-tab'
import { ChangeOrdersTab } from '@/components/project/change-orders-tab'
import { FinancialSummaryCards } from '@/components/project/overview/financial-summary-cards'
import { ProjectHealthDashboard } from '@/components/project/overview/project-health-dashboard'
import { PurchaseOrdersTab } from '@/components/project/overview/purchase-orders-tab'
import { FloatingActionButton } from '@/components/project/overview/floating-action-button'
import { UncommittedBudgetCard } from '@/components/project/uncommitted-budget-card'
import { SpendProjectionsChart } from '@/components/project/spend-projections-chart'

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const router = useRouter()
  const { id } = use(params)

  // Fetch comprehensive project data
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['project-overview', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/overview`)
      if (!response.ok) throw new Error('Failed to fetch project overview')
      return response.json()
    }
  })

  // Fetch recent activity
  const { data: activityData } = useQuery({
    queryKey: ['project-activity', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/recent-activity`)
      if (!response.ok) throw new Error('Failed to fetch recent activity')
      return response.json()
    }
  })

  if (overviewLoading || !overviewData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading project...</p>
          </div>
        </div>
      </div>
    )
  }

  const { project, financialData, healthDashboard, purchaseOrdersData } = overviewData
  const recentActivity = activityData?.activities || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'planning': return 'bg-blue-100 text-blue-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/projects')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.project_name}</h1>
                <p className="text-lg text-gray-600">Job #{project.job_number}</p>
              </div>
              <Badge className={`${getStatusColor(project.status)} hover:${getStatusColor(project.status)}`}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" className="flex items-center space-x-2 bg-transparent" onClick={() => router.push(`/projects/${id}/budget-import-coversheet`)}>
                <Upload className="h-4 w-4" />
                <span>Import Budget</span>
              </Button>
              <Button className="flex items-center space-x-2" onClick={() => router.push(`/projects/${id}/edit`)}>
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <FinancialSummaryCards data={financialData} />

        {/* Uncommitted Budget & Projections Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {financialData.uncommittedBudget && (
            <UncommittedBudgetCard
              totalBudget={financialData.uncommittedBudget.totalBudget}
              totalCommitted={financialData.uncommittedBudget.totalCommitted}
              baseMarginPercentage={financialData.uncommittedBudget.baseMarginPercentage}
              projectCompletionPercentage={financialData.uncommittedBudget.projectCompletionPercentage}
              spendPercentage={financialData.uncommittedBudget.spendPercentage}
              categories={financialData.uncommittedBudget.categories}
            />
          )}
          
          {financialData.projections && (
            <SpendProjectionsChart
              currentSpendPercentage={financialData.projections.currentSpendPercentage}
              projectionMethod={financialData.projections.projectionMethod}
              baseMargin={financialData.projections.baseMargin}
              projections={financialData.projections.projections}
              summary={financialData.projections.summary}
              transitionPoint={financialData.projections.transitionPoint}
              projectStartDate={financialData.projections.projectStartDate}
              projectEndDate={financialData.projections.projectEndDate}
            />
          )}
        </div>

        {/* Project Health Dashboard */}
        <ProjectHealthDashboard 
          budgetData={healthDashboard.budgetData}
          laborTrends={healthDashboard.laborTrends}
          currentHeadcount={healthDashboard.currentHeadcount}
          peakHeadcount={healthDashboard.peakHeadcount}
          recentActivity={recentActivity}
        />

        {/* Tabbed Content Area */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <Tabs defaultValue="purchase-orders" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="contract-details">Contract Details</TabsTrigger>
                <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
                <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
                <TabsTrigger value="labor-actuals">Labor Actuals</TabsTrigger>
                <TabsTrigger value="labor-forecast">Labor Forecast</TabsTrigger>
                <TabsTrigger value="budget-actual">Budget vs Actual</TabsTrigger>
              </TabsList>

              <TabsContent value="purchase-orders" className="mt-6">
                <PurchaseOrdersTab 
                  projectId={id}
                  purchaseOrders={purchaseOrdersData.purchaseOrders}
                  totalPOValue={purchaseOrdersData.totalPOValue}
                  monthlyPOValue={purchaseOrdersData.monthlyPOValue}
                  monthlyTrend={purchaseOrdersData.monthlyTrend}
                  topVendor={purchaseOrdersData.topVendor}
                  vendorBreakdown={purchaseOrdersData.vendorBreakdown}
                  categoryBreakdown={purchaseOrdersData.categoryBreakdown}
                  categorySummary={purchaseOrdersData.categorySummary}
                  weeklyTrend={purchaseOrdersData.weeklyTrend}
                />
              </TabsContent>

              <TabsContent value="contract-details" className="mt-6">
                <div className="text-center py-12 text-gray-500">
                  <h3 className="text-lg font-medium mb-2">Contract Details</h3>
                  <p>Timeline of changes, impact analysis, and contract modifications</p>
                </div>
              </TabsContent>

              <TabsContent value="change-orders" className="mt-6">
                <ChangeOrdersTab 
                  projectId={id}
                  projectData={{
                    original_contract: project?.original_contract,
                    revised_contract: project?.revised_contract
                  }}
                />
              </TabsContent>

              <TabsContent value="labor-actuals" className="mt-6">
                <LaborAnalyticsView 
                  projectId={id} 
                  projectName={project?.project_name || ''} 
                  jobNumber={project?.job_number || ''}
                />
              </TabsContent>

              <TabsContent value="labor-forecast" className="mt-6">
                <LaborForecastTab projectId={id} />
              </TabsContent>

              <TabsContent value="budget-actual" className="mt-6">
                <BudgetVsActualTab projectId={id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Floating Action Button */}
        <FloatingActionButton projectId={id} />
      </div>
    </div>
  )
}