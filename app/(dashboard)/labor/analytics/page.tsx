'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  Download
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

interface WeeklyData {
  weekEnding: string
  actualCost: number
  actualHours: number
  forecastCost: number
  forecastHours: number
  variance: number
  avgRate: number
}

interface CraftData {
  craftName: string
  craftCode: string
  category: string
  totalCost: number
  totalHours: number
  avgRate: number
  headcount: number
}

interface KPIData {
  totalActualCost: number
  totalForecastCost: number
  costVariance: number
  costVariancePercent: number
  totalActualHours: number
  avgProductivity: number
  activeCrafts: number
  totalHeadcount: number
}

// Chart colors
const COLORS = {
  direct: '#3B82F6',    // Blue
  indirect: '#10B981',  // Green
  staff: '#F59E0B'      // Amber
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function LaborAnalyticsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  
  const [loading, setLoading] = useState(true)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [craftData, setCraftData] = useState<CraftData[]>([])
  const [kpiData, setKpiData] = useState<KPIData | null>(null)
  
  const [dateRange, setDateRange] = useState(12) // weeks
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true)

      // Calculate date range
      const endDate = endOfWeek(new Date(), { weekStartsOn: 1 })

      // Fetch all necessary data
      const [actualsRes, forecastRes, projectRes] = await Promise.all([
        fetch(`/api/labor-forecasts/weekly-actuals?project_id=${projectId}&limit=100`),
        fetch(`/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=${dateRange}`),
        fetch(`/api/projects/${projectId}`)
      ])

      if (projectRes.ok) {
        const project = await projectRes.json()
        setProjectInfo({
          id: project.id,
          jobNumber: project.job_number,
          name: project.name
        })
      }

      // Process actuals data
      const weeklyActuals = new Map<string, { cost: number; hours: number }>()
      const craftTotals = new Map<string, CraftData>()
      
      if (actualsRes.ok) {
        const actualsData = await actualsRes.json()
        
        actualsData.actuals?.forEach((actual: {
          weekEnding: string;
          totalCost: number;
          totalHours: number;
          laborCategory: string;
          craftTypeId: string;
          craftName: string;
          craftCode: string;
        }) => {
          const weekKey = actual.weekEnding
          const existing = weeklyActuals.get(weekKey) || { cost: 0, hours: 0 }
          
          if (categoryFilter === 'all' || actual.laborCategory === categoryFilter) {
            weeklyActuals.set(weekKey, {
              cost: existing.cost + actual.totalCost,
              hours: existing.hours + actual.totalHours
            })

            // Aggregate by craft
            const craftKey = actual.craftTypeId
            const craft = craftTotals.get(craftKey) || {
              craftName: actual.craftName,
              craftCode: actual.craftCode,
              category: actual.laborCategory,
              totalCost: 0,
              totalHours: 0,
              avgRate: 0,
              headcount: 0
            }
            
            craft.totalCost += actual.totalCost
            craft.totalHours += actual.totalHours
            craftTotals.set(craftKey, craft)
          }
        })
      }

      // Process forecast data
      const weeklyForecasts = new Map<string, { cost: number; hours: number; headcount: number }>()
      
      if (forecastRes.ok) {
        const forecastData = await forecastRes.json()
        
        forecastData.forecast?.forEach((week: {
          weekEnding: string;
          totalCost: number;
          totalHours: number;
          totalHeadcount: number;
        }) => {
          const weekKey = week.weekEnding
          weeklyForecasts.set(weekKey, {
            cost: week.totalCost || 0,
            hours: week.totalHours || 0,
            headcount: week.totalHeadcount || 0
          })
        })
      }

      // Combine weekly data
      const weeks: WeeklyData[] = []
      const allWeeks = new Set([...weeklyActuals.keys(), ...weeklyForecasts.keys()])
      
      allWeeks.forEach(weekKey => {
        const actual = weeklyActuals.get(weekKey) || { cost: 0, hours: 0 }
        const forecast = weeklyForecasts.get(weekKey) || { cost: 0, hours: 0, headcount: 0 }
        
        weeks.push({
          weekEnding: weekKey,
          actualCost: actual.cost,
          actualHours: actual.hours,
          forecastCost: forecast.cost,
          forecastHours: forecast.hours,
          variance: actual.cost - forecast.cost,
          avgRate: actual.hours > 0 ? actual.cost / actual.hours : 0
        })
      })
      
      // Sort by week
      weeks.sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
      setWeeklyData(weeks)

      // Process craft data
      const crafts = Array.from(craftTotals.values())
      crafts.forEach(craft => {
        craft.avgRate = craft.totalHours > 0 ? craft.totalCost / craft.totalHours : 0
      })
      setCraftData(crafts.sort((a, b) => b.totalCost - a.totalCost))

      // Calculate KPIs
      const totalActualCost = Array.from(weeklyActuals.values()).reduce((sum, w) => sum + w.cost, 0)
      const totalActualHours = Array.from(weeklyActuals.values()).reduce((sum, w) => sum + w.hours, 0)
      const totalForecastCost = Array.from(weeklyForecasts.values()).reduce((sum, w) => sum + w.cost, 0)
      const totalHeadcount = Array.from(weeklyForecasts.values()).reduce((sum, w) => sum + w.headcount, 0) / weeklyForecasts.size

      setKpiData({
        totalActualCost,
        totalForecastCost,
        costVariance: totalActualCost - totalForecastCost,
        costVariancePercent: totalForecastCost > 0 ? ((totalActualCost - totalForecastCost) / totalForecastCost) * 100 : 0,
        totalActualHours,
        avgProductivity: totalActualHours > 0 ? totalActualCost / totalActualHours : 0,
        activeCrafts: crafts.length,
        totalHeadcount: Math.round(totalHeadcount)
      })

      setLoading(false)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      setLoading(false)
    }
  }, [projectId, dateRange, categoryFilter])

  useEffect(() => {
    if (!projectId) {
      router.push('/labor')
      return
    }

    fetchAnalyticsData()
  }, [projectId, dateRange, categoryFilter, router, fetchAnalyticsData])

  const exportData = () => {
    // Create CSV content
    const headers = ['Week Ending', 'Actual Cost', 'Actual Hours', 'Forecast Cost', 'Forecast Hours', 'Variance', 'Avg Rate']
    const rows = weeklyData.map(week => [
      format(new Date(week.weekEnding), 'MM/dd/yyyy'),
      week.actualCost.toFixed(2),
      week.actualHours.toFixed(2),
      week.forecastCost.toFixed(2),
      week.forecastHours.toFixed(2),
      week.variance.toFixed(2),
      week.avgRate.toFixed(2)
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labor-analytics-${projectInfo?.jobNumber}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!projectInfo) {
    return null
  }

  // Prepare pie chart data
  const pieData = craftData.reduce((acc, craft) => {
    const existing = acc.find(item => item.category === craft.category)
    if (existing) {
      existing.value += craft.totalCost
    } else {
      acc.push({
        name: craft.category.charAt(0).toUpperCase() + craft.category.slice(1),
        category: craft.category,
        value: craft.totalCost
      })
    }
    return acc
  }, [] as Array<{ name: string; category: string; value: number }>)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/labor?project_id=${projectId}`}
          className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Labor Dashboard
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Labor Analytics</h1>
            <p className="text-foreground mt-1">
              Project {projectInfo.jobNumber} - {projectInfo.name}
            </p>
          </div>
          
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <Label htmlFor="dateRange">Date Range</Label>
            <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
              <SelectTrigger id="dateRange" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">Last 4 weeks</SelectItem>
                <SelectItem value="8">Last 8 weeks</SelectItem>
                <SelectItem value="12">Last 12 weeks</SelectItem>
                <SelectItem value="26">Last 26 weeks</SelectItem>
                <SelectItem value="52">Last 52 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="category">Category Filter</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="category" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="indirect">Indirect</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      {kpiData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Total Actual Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpiData.totalActualCost)}
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  {kpiData.totalActualHours.toLocaleString()} hours
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-foreground" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Cost Variance</p>
                <p className={`text-2xl font-bold ${kpiData.costVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(kpiData.costVariance))}
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  {kpiData.costVariancePercent > 0 ? '+' : ''}{kpiData.costVariancePercent.toFixed(1)}% vs forecast
                </p>
              </div>
              <TrendingUp className={`h-8 w-8 ${kpiData.costVariance > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Avg Productivity</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpiData.avgProductivity)}
                </p>
                <p className="text-xs text-foreground/80 mt-1">Per hour</p>
              </div>
              <BarChart3 className="h-8 w-8 text-foreground" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Active Resources</p>
                <p className="text-2xl font-bold text-foreground">
                  {kpiData.activeCrafts}
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  Avg {kpiData.totalHeadcount} headcount
                </p>
              </div>
              <Users className="h-8 w-8 text-foreground" />
            </div>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Trend Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Cost Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="weekEnding" 
                tickFormatter={(value) => format(new Date(value), 'MM/dd')}
              />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="actualCost" 
                stroke="#3B82F6" 
                name="Actual Cost"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="forecastCost" 
                stroke="#10B981" 
                name="Forecast Cost"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cost by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.category as keyof typeof COLORS] || CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </RePieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Craft Performance Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Craft Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/80 uppercase">Craft</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground/80 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-foreground/80 uppercase">Total Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-foreground/80 uppercase">Total Hours</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-foreground/80 uppercase">Avg Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-foreground/80 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {craftData.map((craft, index) => {
                const percentOfTotal = kpiData ? (craft.totalCost / kpiData.totalActualCost) * 100 : 0
                
                return (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div>
                        <p className="font-medium">{craft.craftName}</p>
                        <p className="text-xs text-foreground/60">{craft.craftCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full bg-opacity-20 ${
                        craft.category === 'direct' ? 'bg-blue-500 text-blue-700' :
                        craft.category === 'indirect' ? 'bg-green-500 text-green-700' :
                        'bg-amber-500 text-amber-700'
                      }`}>
                        {craft.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-medium">
                      {formatCurrency(craft.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      {craft.totalHours.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      {formatCurrency(craft.avgRate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      {percentOfTotal.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}