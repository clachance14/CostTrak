'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  RefreshCw, 
  CircleAlert,
  Calendar,
  FileSpreadsheet,
  Upload
} from 'lucide-react'
import { LaborKPICards } from './labor-kpi-cards'
import { LaborCraftTable } from './labor-craft-table'
import { LaborTrendCharts } from './labor-trend-charts'
import { LaborPeriodTable } from './labor-period-table'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

interface LaborTabProps {
  projectId: string
  projectName: string
  jobNumber: string
}

interface LaborAnalytics {
  kpis: {
    totalActualCost: number
    totalForecastedCost: number
    totalBudgetedCost: number
    varianceDollars: number
    variancePercent: number
    totalActualHours: number
    totalForecastedHours: number
    averageActualRate: number
    averageForecastRate: number
    laborBurnPercent: number
    projectCompletionPercent: number
  }
  craftBreakdown: Array<{
    craftCode: string
    craftName: string
    category: string
    actualHours: number
    forecastedHours: number
    actualCost: number
    forecastedCost: number
    varianceDollars: number
    variancePercent: number
  }>
  weeklyTrends: Array<{
    weekEnding: string
    actualCost: number
    forecastedCost: number
    actualHours: number
    forecastedHours: number
    compositeRate: number
  }>
  periodBreakdown: Array<{
    weekEnding: string
    employees: Array<{
      employeeId: string
      employeeNumber: string
      employeeName: string
      craftCode: string
      craftName: string
      category: string
      stHours: number
      otHours: number
      totalHours: number
      actualCost: number
      rate: number
    }>
    totalActualHours: number
    totalActualCost: number
    totalForecastedHours: number
    totalForecastedCost: number
    varianceDollars: number
    variancePercent: number
  }>
  lastUpdated: string
}

export function LaborTab({ projectId, projectName, jobNumber }: LaborTabProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const [activeTab, setActiveTab] = useState('overview')
  
  // Check if user can import labor data
  const canImport = user && ['controller', 'ops_manager', 'project_manager'].includes(user.role)
  
  // Debug logging
  useEffect(() => {
    console.log('LaborTab mounted with projectId:', projectId)
  }, [projectId])

  const { data, isLoading, error, refetch } = useQuery<LaborAnalytics>({
    queryKey: ['labor-analytics', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/labor-analytics`)
      if (!response.ok) {
        throw new Error('Failed to fetch labor analytics')
      }
      const result = await response.json()
      console.log('Labor analytics data received:', {
        hasData: !!result,
        weeklyTrendsCount: result?.weeklyTrends?.length || 0,
        sampleTrend: result?.weeklyTrends?.[0],
        kpis: result?.kpis
      })
      return result
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  const handleExportToExcel = useCallback(() => {
    if (!data) return

    // Create workbook
    const wb = XLSX.utils.book_new()

    // KPIs Sheet
    const kpisData = [
      ['Labor Analytics Report'],
      ['Project:', projectName],
      ['Job Number:', jobNumber],
      ['Generated:', format(new Date(), 'PPpp')],
      [],
      ['Key Performance Indicators'],
      ['Metric', 'Value'],
      ['Total Actual Cost', data.kpis.totalActualCost],
      ['Total Forecasted Cost (EAC)', data.kpis.totalForecastedCost],
      ['Total Budgeted Cost', data.kpis.totalBudgetedCost],
      ['Variance ($)', data.kpis.varianceDollars],
      ['Variance (%)', `${data.kpis.variancePercent.toFixed(1)}%`],
      ['Total Actual Hours', data.kpis.totalActualHours],
      ['Total Forecasted Hours', data.kpis.totalForecastedHours],
      ['Average Actual Rate', `$${data.kpis.averageActualRate.toFixed(2)}/hr`],
      ['Average Forecast Rate', `$${data.kpis.averageForecastRate.toFixed(2)}/hr`],
      ['Labor Burn %', `${data.kpis.laborBurnPercent.toFixed(1)}%`],
      ['Project Completion %', `${data.kpis.projectCompletionPercent.toFixed(1)}%`],
    ]
    const kpisSheet = XLSX.utils.aoa_to_sheet(kpisData)
    XLSX.utils.book_append_sheet(wb, kpisSheet, 'KPIs')

    // Craft Breakdown Sheet
    const craftHeaders = [
      'Craft Code', 'Craft Name', 'Category', 
      'Actual Hours', 'Forecasted Hours',
      'Actual Cost', 'Forecasted Cost', 
      'Variance $', 'Variance %'
    ]
    const craftData = data.craftBreakdown.map(craft => [
      craft.craftCode,
      craft.craftName,
      craft.category,
      craft.actualHours,
      craft.forecastedHours,
      craft.actualCost,
      craft.forecastedCost,
      craft.varianceDollars,
      `${craft.variancePercent.toFixed(1)}%`
    ])
    const craftSheet = XLSX.utils.aoa_to_sheet([craftHeaders, ...craftData])
    XLSX.utils.book_append_sheet(wb, craftSheet, 'Craft Breakdown')

    // Weekly Trends Sheet
    const trendHeaders = [
      'Week Ending', 'Actual Cost', 'Forecasted Cost',
      'Actual Hours', 'Forecasted Hours', 'Composite Rate'
    ]
    const trendData = data.weeklyTrends.map(week => [
      format(new Date(week.weekEnding), 'PP'),
      week.actualCost,
      week.forecastedCost,
      week.actualHours,
      week.forecastedHours,
      week.compositeRate ? `$${week.compositeRate.toFixed(2)}` : ''
    ])
    const trendSheet = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendData])
    XLSX.utils.book_append_sheet(wb, trendSheet, 'Weekly Trends')

    // Period Detail Sheet - Employee Level
    const employeeHeaders = [
      'Week Ending', 'Employee Name', 'Employee #', 'Craft', 'Category',
      'ST Hours', 'OT Hours', 'Total Hours', 'Rate', 'Total Cost'
    ]
    const employeeData: any[][] = []
    data.periodBreakdown.forEach(period => {
      period.employees.forEach(emp => {
        employeeData.push([
          format(new Date(period.weekEnding), 'PP'),
          emp.employeeName,
          emp.employeeNumber,
          emp.craftName,
          emp.category,
          emp.stHours,
          emp.otHours,
          emp.totalHours,
          `$${emp.rate.toFixed(2)}`,
          emp.actualCost
        ])
      })
    })
    const employeeSheet = XLSX.utils.aoa_to_sheet([employeeHeaders, ...employeeData])
    XLSX.utils.book_append_sheet(wb, employeeSheet, 'Employee Detail')

    // Period Summary Sheet
    const periodHeaders = [
      'Week Ending', 'Employee Count', 'Total Hours', 'Total Cost',
      'Forecast Hours', 'Forecast Cost', 'Variance $', 'Variance %'
    ]
    const periodData = data.periodBreakdown.map(period => [
      format(new Date(period.weekEnding), 'PP'),
      period.employees.length,
      period.totalActualHours,
      period.totalActualCost,
      period.totalForecastedHours,
      period.totalForecastedCost,
      period.varianceDollars,
      `${period.variancePercent.toFixed(1)}%`
    ])
    const periodSheet = XLSX.utils.aoa_to_sheet([periodHeaders, ...periodData])
    XLSX.utils.book_append_sheet(wb, periodSheet, 'Period Summary')

    // Write file
    const fileName = `Labor_Analytics_${jobNumber}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }, [data, projectName, jobNumber])

  const handleCraftDrillDown = useCallback((craftCode: string) => {
    // TODO: Implement drill-down to show all weeks for a specific craft
    console.log('Drill down to craft:', craftCode)
  }, [])

  const handlePeriodDrillDown = useCallback((weekEnding: string, employeeId: string) => {
    // TODO: Implement drill-down to show employee details
    console.log('Drill down to employee:', weekEnding, employeeId)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <AlertDescription>
          Failed to load labor analytics. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return null
  }

  const lastUpdatedDate = data.lastUpdated ? new Date(data.lastUpdated) : new Date()

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Labor Analytics</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Last updated: {format(lastUpdatedDate, 'PPp')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/labor/import?project_id=${projectId}`)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Labor Data
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToExcel}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <LaborKPICards kpis={data.kpis} />

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Period Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Breakdown by Craft & Group</h3>
                {data.craftBreakdown.filter(c => c.variancePercent > 10).length > 0 && (
                  <Badge variant="destructive">
                    {data.craftBreakdown.filter(c => c.variancePercent > 10).length} Crafts Over Budget
                  </Badge>
                )}
              </div>
              <LaborCraftTable 
                craftBreakdown={data.craftBreakdown}
                onDrillDown={handleCraftDrillDown}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <LaborTrendCharts 
            weeklyTrends={data.weeklyTrends}
            budgetedCost={data.kpis.totalBudgetedCost}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Period-to-Period Breakdown</h3>
                <Badge variant="outline">
                  Last {Math.min(8, data.periodBreakdown.length)} weeks
                </Badge>
              </div>
              <LaborPeriodTable 
                periodBreakdown={data.periodBreakdown}
                onDrillDown={handlePeriodDrillDown}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Notes */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Labor costs are calculated using actual employee pay rates. 
              Billing rates are tracked separately for client invoicing.
            </p>
            <p>
              Forecasts are based on headcount projections and historical running averages.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}