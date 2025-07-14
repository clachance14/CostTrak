'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Plus,
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  FileText,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { POLogTable } from '@/components/purchase-orders/po-log-table'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const { id } = use(params)

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

  return (
    <div className="min-h-screen bg-gray-50">
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
                  {formatPercent(financialMetrics.profitMargin)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">% Complete</div>
                <div className="font-semibold text-lg">
                  {formatPercent(financialMetrics.percentComplete)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${id}/budget-import`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Import Budget
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
        <Tabs defaultValue="financial" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="financial">Financial Summary</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="budget">Budget Breakdown</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
            <TabsTrigger value="alerts">Issues & Alerts</TabsTrigger>
          </TabsList>

          {/* Financial Summary Tab */}
          <TabsContent value="financial" className="space-y-6">
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
                        {formatPercent(financialMetrics.profitMargin)}
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
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Project Progress</span>
                        <span className="text-sm font-medium">{formatPercent(financialMetrics.percentComplete)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(financialMetrics.percentComplete, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Key Performance Indicators */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{purchaseOrders.length}</div>
                        <div className="text-sm text-gray-600">Purchase Orders</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{changeOrders.filter(co => co.status === 'approved').length}</div>
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
          </TabsContent>

          {/* Budget Breakdown Tab */}
          <TabsContent value="budget" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget vs Actual by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(budgetBreakdown).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Budget Category</th>
                          <th className="text-right py-2">Budget</th>
                          <th className="text-right py-2">Committed</th>
                          <th className="text-right py-2">Actuals</th>
                          <th className="text-right py-2">Forecasted Final</th>
                          <th className="text-right py-2">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(budgetBreakdown).map(([category, data]: [string, any]) => {
                          const actualsExceedCommitted = data.actual > data.committed && data.committed > 0
                          return (
                            <tr key={category} className="border-b">
                              <td className="py-3 font-medium">{category}</td>
                              <td className="text-right py-3">{formatCurrency(data.budget)}</td>
                              <td className="text-right py-3">{formatCurrency(data.committed)}</td>
                              <td className={`text-right py-3 ${actualsExceedCommitted ? 'text-orange-600 font-semibold' : ''}`}>
                                {formatCurrency(data.actual)}
                                {actualsExceedCommitted && (
                                  <span className="ml-1 text-xs">⚠️</span>
                                )}
                              </td>
                              <td className="text-right py-3">{formatCurrency(data.forecasted)}</td>
                              <td className={`text-right py-3 font-medium ${data.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {data.variance >= 0 ? '+' : ''}{formatCurrency(data.variance)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-t-2 font-bold">
                          <td className="py-3">Total</td>
                          <td className="text-right py-3">{formatCurrency(Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.budget, 0))}</td>
                          <td className="text-right py-3">{formatCurrency(Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.committed, 0))}</td>
                          <td className="text-right py-3">{formatCurrency(Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.actual, 0))}</td>
                          <td className="text-right py-3">{formatCurrency(Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.forecasted, 0))}</td>
                          <td className={`text-right py-3 ${Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.variance, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.variance, 0) >= 0 ? '+' : ''}{formatCurrency(Object.values(budgetBreakdown).reduce((sum: number, data: any) => sum + data.variance, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No budget data available</p>
                )}
              </CardContent>
            </Card>
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
                  <POLogTable purchaseOrders={purchaseOrders} />
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
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Change Order
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {changeOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">CO #</th>
                          <th className="text-left py-2">Description</th>
                          <th className="text-center py-2">Status</th>
                          <th className="text-right py-2">Amount</th>
                          <th className="text-right py-2">Approved Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changeOrders.map((co: any) => (
                          <tr key={co.id} className="border-b">
                            <td className="py-3 font-medium">{co.co_number}</td>
                            <td className="py-3">{co.description}</td>
                            <td className="text-center py-3">
                              <Badge variant={co.status === 'approved' ? 'default' : co.status === 'pending' ? 'secondary' : 'outline'}>
                                {co.status}
                              </Badge>
                            </td>
                            <td className="text-right py-3 font-medium">{formatCurrency(co.amount)}</td>
                            <td className="text-right py-3">
                              {co.approved_date ? format(new Date(co.approved_date), 'MMM d, yyyy') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

          {/* Forecast Tab - Placeholder for future enhancement */}
          <TabsContent value="forecast" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Monthly Revenue Forecast</span>
                  {canEdit && (
                    <Button size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Forecast
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-center py-8">
                  Monthly revenue forecasting will be available in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}