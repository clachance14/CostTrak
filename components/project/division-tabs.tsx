'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Building2, 
  Star, 
  DollarSign, 
  TrendingUp, 
  Package
} from 'lucide-react'
import { POLogTable } from '@/components/purchase-orders/po-log-table'
import { ChangeOrderTable } from '@/components/change-orders/change-order-table'
import { LaborTab } from '@/components/project/labor-tab'
import { FinancialMetricCard } from '@/components/project/financial-metric-card'
import { DivisionAlerts } from '@/components/project/division-alerts'
import { DivisionAnalytics } from '@/components/project/division-analytics'

interface DivisionTabsProps {
  projectId: string
  canEdit: boolean
}

interface DivisionData {
  division_id: string
  division_name: string
  division_code: string
  is_lead_division: boolean
  division_pm_name?: string
  division_pm_id?: string
  budget_allocated: number
  division_budget?: {
    labor_budget: number
    materials_budget: number
    equipment_budget: number
    subcontracts_budget: number
    other_budget: number
    total_budget: number
  }
  cost_summary?: {
    total_po_committed: number
    total_po_invoiced: number
    total_labor_cost: number
    total_labor_hours: number
    approved_change_orders: number
    total_committed: number
    budget_variance: number
  }
}

export function DivisionTabs({ projectId, canEdit }: DivisionTabsProps) {
  const [selectedDivision, setSelectedDivision] = useState<string>('all')

  // Fetch project divisions
  const { data: divisions, isLoading: divisionsLoading } = useQuery({
    queryKey: ['project-divisions', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/divisions`)
      if (!response.ok) throw new Error('Failed to fetch divisions')
      const data = await response.json()
      return data.divisions as DivisionData[]
    }
  })

  // Fetch division-specific data when a division is selected
  const { isLoading: divisionLoading } = useQuery({
    queryKey: ['division-data', projectId, selectedDivision],
    enabled: selectedDivision !== 'all',
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/divisions/${selectedDivision}/budget`)
      if (!response.ok) throw new Error('Failed to fetch division data')
      return response.json()
    }
  })

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

  if (divisionsLoading) {
    return <div className="text-center p-8">Loading divisions...</div>
  }

  if (!divisions || divisions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <p className="text-muted-foreground">No divisions assigned to this project</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate totals for "All Divisions" view
  const totalBudget = divisions.reduce((sum, d) => sum + (d.division_budget?.total_budget || 0), 0)
  const totalCommitted = divisions.reduce((sum, d) => sum + (d.cost_summary?.total_committed || 0), 0)
  const totalVariance = divisions.reduce((sum, d) => sum + (d.cost_summary?.budget_variance || 0), 0)

  const renderDivisionOverview = (division?: DivisionData) => {
    if (!division) {
      // All divisions summary
      return (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinancialMetricCard
              title="Total Budget"
              value={formatCurrency(totalBudget)}
              icon={DollarSign}
              trend="neutral"
            />
            <FinancialMetricCard
              title="Total Committed"
              value={formatCurrency(totalCommitted)}
              icon={Package}
              trend="neutral"
            />
            <FinancialMetricCard
              title="Budget Variance"
              value={formatCurrency(totalVariance)}
              icon={TrendingUp}
              trend={totalVariance >= 0 ? 'positive' : 'negative'}
            />
            <FinancialMetricCard
              title="Divisions"
              value={divisions.length.toString()}
              icon={Building2}
              trend="neutral"
            />
          </div>

          {/* Division Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Division Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {divisions.map((div) => {
                  const percentOfTotal = totalBudget > 0 
                    ? (div.division_budget?.total_budget || 0) / totalBudget * 100 
                    : 0
                  const percentCommitted = div.division_budget?.total_budget 
                    ? (div.cost_summary?.total_committed || 0) / div.division_budget.total_budget * 100
                    : 0

                  return (
                    <div key={div.division_id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{div.division_name}</h4>
                          {div.is_lead_division && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3" />
                              Lead
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(div.division_budget?.total_budget || 0)} ({formatPercent(percentOfTotal)})
                        </div>
                      </div>
                      <Progress value={percentCommitted} className="h-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Committed: {formatCurrency(div.cost_summary?.total_committed || 0)}</span>
                        <span>{formatPercent(percentCommitted)} used</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* All Divisions Alerts */}
          <DivisionAlerts projectId={projectId} />

          {/* All Divisions Analytics */}
          <DivisionAnalytics projectId={projectId} />
        </div>
      )
    }

    // Single division view
    return (
      <div className="space-y-6">
        {/* Division Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {division.division_name} ({division.division_code})
                {division.is_lead_division && (
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3" />
                    Lead
                  </Badge>
                )}
              </h3>
              {division.division_pm_name && (
                <p className="text-sm text-muted-foreground">
                  Division PM: {division.division_pm_name}
                </p>
              )}
            </div>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm">
              Edit Division
            </Button>
          )}
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinancialMetricCard
            title="Division Budget"
            value={formatCurrency(division.division_budget?.total_budget || 0)}
            icon={DollarSign}
            trend="neutral"
          />
          <FinancialMetricCard
            title="Committed"
            value={formatCurrency(division.cost_summary?.total_committed || 0)}
            icon={Package}
            trend="neutral"
          />
          <FinancialMetricCard
            title="Variance"
            value={formatCurrency(division.cost_summary?.budget_variance || 0)}
            icon={TrendingUp}
            trend={division.cost_summary?.budget_variance >= 0 ? 'positive' : 'negative'}
          />
          <FinancialMetricCard
            title="% Complete"
            value={formatPercent(
              division.division_budget?.total_budget 
                ? (division.cost_summary?.total_committed || 0) / division.division_budget.total_budget * 100
                : 0
            )}
            icon={TrendingUp}
            trend="neutral"
          />
        </div>

        {/* Division Alerts */}
        <DivisionAlerts 
          projectId={projectId} 
          divisionId={division.division_id}
        />

        {/* Budget Breakdown */}
        {division.division_budget && (
          <Card>
            <CardHeader>
              <CardTitle>Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Labor</span>
                  <span className="font-medium">{formatCurrency(division.division_budget.labor_budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Materials</span>
                  <span className="font-medium">{formatCurrency(division.division_budget.materials_budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equipment</span>
                  <span className="font-medium">{formatCurrency(division.division_budget.equipment_budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subcontracts</span>
                  <span className="font-medium">{formatCurrency(division.division_budget.subcontracts_budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Other</span>
                  <span className="font-medium">{formatCurrency(division.division_budget.other_budget)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(division.division_budget.total_budget)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Division-specific tabs */}
        <Tabs defaultValue="pos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
            <TabsTrigger value="changes">Change Orders</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pos" className="mt-4">
            <POLogTable 
              projectId={projectId}
              divisionId={division.division_id}
              compact={false}
            />
          </TabsContent>
          
          <TabsContent value="labor" className="mt-4">
            <LaborTab 
              projectId={projectId}
              projectData={{
                ...division,
                laborMetrics: {
                  totalActualCost: division.cost_summary?.total_labor_cost || 0,
                  totalActualHours: division.cost_summary?.total_labor_hours || 0,
                  weeklyAverages: []
                }
              }}
            />
          </TabsContent>
          
          <TabsContent value="changes" className="mt-4">
            <ChangeOrderTable
              projectId={projectId}
              divisionId={division.division_id}
              canEdit={canEdit}
            />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-4">
            <DivisionAnalytics
              projectId={projectId}
              divisionId={division.division_id}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={selectedDivision} onValueChange={setSelectedDivision} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All Divisions
          </TabsTrigger>
          {divisions.map((division) => (
            <TabsTrigger 
              key={division.division_id} 
              value={division.division_id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <div className="flex items-center gap-2">
                {division.division_name}
                {division.is_lead_division && <Star className="h-3 w-3" />}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {renderDivisionOverview()}
        </TabsContent>

        {divisions.map((division) => (
          <TabsContent key={division.division_id} value={division.division_id} className="mt-6">
            {divisionLoading ? (
              <div className="text-center p-8">Loading division data...</div>
            ) : (
              renderDivisionOverview(division)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}