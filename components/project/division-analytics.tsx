'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { format } from 'date-fns'

interface DivisionAnalyticsProps {
  projectId: string
  divisionId?: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function DivisionAnalytics({ projectId, divisionId }: DivisionAnalyticsProps) {
  const [dateRange, setDateRange] = useState<'30d' | '90d' | 'all'>('90d')

  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  if (dateRange === '30d') {
    startDate.setDate(startDate.getDate() - 30)
  } else if (dateRange === '90d') {
    startDate.setDate(startDate.getDate() - 90)
  } else {
    startDate.setFullYear(startDate.getFullYear() - 2)
  }

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['division-analytics', projectId, divisionId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (divisionId) params.set('division_id', divisionId)
      params.set('start_date', startDate.toISOString())
      params.set('end_date', endDate.toISOString())
      
      const response = await fetch(`/api/projects/${projectId}/divisions/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch division analytics')
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

  const getHealthIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (score >= 75) return <Activity className="h-5 w-5 text-blue-500" />
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    return <AlertTriangle className="h-5 w-5 text-red-500" />
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 75) return 'text-blue-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <p className="text-muted-foreground">Loading analytics...</p>
        </CardContent>
      </Card>
    )
  }

  const analytics = analyticsData?.analytics || []
  const insights = analyticsData?.insights || []

  if (analytics.length === 0) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  // Prepare chart data
  const performanceData = analytics.map((div: any) => ({
    division: div.division_code,
    budget_utilization: div.performance_metrics?.budget_utilization || 0,
    cost_performance: (div.performance_metrics?.cost_performance_index || 1) * 100,
    health_score: div.health_score?.score || 0
  }))

  const budgetData = analytics.map((div: any) => ({
    name: div.division_code,
    budget: div.performance_metrics?.total_budget || 0,
    committed: div.performance_metrics?.total_committed || 0,
    variance: Math.abs(div.performance_metrics?.budget_variance || 0)
  }))

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Division Performance Analytics</h3>
        <div className="flex items-center gap-2">
          <Button
            variant={dateRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('90d')}
          >
            90 Days
          </Button>
          <Button
            variant={dateRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('all')}
          >
            All Time
          </Button>
        </div>
      </div>

      {/* Key Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="mt-0.5">
                    {insight.severity === 'high' ? <AlertTriangle className="h-5 w-5 text-red-500" /> :
                     insight.severity === 'medium' ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> :
                     <Info className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{insight.message}</p>
                    {insight.affected_divisions && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Affected: {insight.affected_divisions.join(', ')}
                      </p>
                    )}
                    {insight.details && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {Object.entries(insight.details).map(([key, value]) => (
                          <div key={key}>
                            {key.replace('_', ' ')}: {value as string}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analytics.map((div: any) => (
          <Card key={div.division_id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {div.division_name} Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getHealthIcon(div.health_score?.score || 0)}
                  <span className={`text-2xl font-bold ${getHealthColor(div.health_score?.score || 0)}`}>
                    {div.health_score?.score || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <Badge variant="outline">
                  {div.health_score?.rating || 'N/A'}
                </Badge>
              </div>
              <Progress 
                value={div.health_score?.score || 0} 
                className="h-2"
              />
              {div.health_score?.factors && div.health_score.factors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {div.health_score.factors.slice(0, 2).map((factor: any, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground">
                      • {factor.factor.replace(/_/g, ' ')} ({factor.impact})
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="budget">Budget Analysis</TabsTrigger>
          <TabsTrigger value="trends">Cost Trends</TabsTrigger>
          <TabsTrigger value="forecast">Forecast Accuracy</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Division Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="division" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="budget_utilization" fill="#3b82f6" name="Budget Utilization %" />
                  <Bar dataKey="cost_performance" fill="#10b981" name="Cost Performance Index %" />
                  <Bar dataKey="health_score" fill="#f59e0b" name="Health Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Analysis Tab */}
        <TabsContent value="budget">
          <Card>
            <CardHeader>
              <CardTitle>Budget Distribution & Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Budget Distribution Pie Chart */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Budget Distribution</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={budgetData}
                        dataKey="budget"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.name}: ${formatCurrency(entry.budget)}`}
                      >
                        {budgetData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Budget vs Committed Bar Chart */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Budget vs Committed</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={budgetData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
                      <Bar dataKey="committed" fill="#10b981" name="Committed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Trends Tab */}
        <TabsContent value="trends">
          {analytics.map((div: any) => (
            <Card key={div.division_id} className="mb-4">
              <CardHeader>
                <CardTitle>{div.division_name} Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {div.trends?.cost_trend && div.trends.cost_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={div.trends.cost_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'MMM d')}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                        formatter={(value: any) => formatCurrency(value)}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name="Cumulative Cost"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No cost trend data available
                  </p>
                )}

                {div.trends?.burn_rate && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Weekly Burn Rate</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(div.trends.burn_rate.weekly_rate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Total Burn: {formatCurrency(div.trends.burn_rate.total_burn)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Over {div.trends.burn_rate.weeks_analyzed} weeks
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Forecast Accuracy Tab */}
        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Accuracy Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {analytics.map((div: any) => (
                  <div key={div.division_id}>
                    <h4 className="font-medium mb-3">{div.division_name}</h4>
                    {div.forecast_accuracy ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="text-sm text-muted-foreground">Average Accuracy</p>
                            <p className="text-2xl font-bold">
                              {formatPercent(div.forecast_accuracy.average_accuracy)}
                            </p>
                          </div>
                          <Badge variant={
                            div.forecast_accuracy.rating === 'excellent' ? 'default' :
                            div.forecast_accuracy.rating === 'good' ? 'secondary' :
                            'outline'
                          }>
                            {div.forecast_accuracy.rating}
                          </Badge>
                        </div>
                        
                        {div.forecast_accuracy.trend && div.forecast_accuracy.trend.length > 0 && (
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={div.forecast_accuracy.trend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                              />
                              <YAxis domain={[0, 100]} />
                              <Tooltip 
                                labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                                formatter={(value: any) => `${value.toFixed(1)}%`}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="accuracy" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                name="Accuracy %"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No forecast data available</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}