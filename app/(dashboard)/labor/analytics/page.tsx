"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft,
  Download, 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  Search, 
  Loader2 
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { PivotTable, type PivotDimension, type PivotMeasure, type PivotFilters } from "@/components/labor/pivot-table"
import { laborPivotPresets, dimensionFormatters, measureFormatters, exportPivotToCSV } from "@/lib/utils/pivot-helpers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import { getMonthFromWeekEnding } from "@/lib/utils/date-helpers"

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

interface WeeklyData {
  weekEnding: string
  weekLabel: string
  directLaborCost: number
  indirectLaborCost: number
  staffLaborCost: number
  totalHours: number
  overtimeHours: number
  totalCostWithBurden: number
}

interface EmployeeData {
  id: string
  weekEnding: string
  month: string
  name: string
  employeeNumber: string
  craft: string
  category: string
  regularHours: number
  overtimeHours: number
  totalCostWithBurden: number
}

export default function LaborAnalyticsDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project_id")

  const [isLoading, setIsLoading] = useState(true)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [employeeData, setEmployeeData] = useState<EmployeeData[]>([])
  const [currentWeekStats, setCurrentWeekStats] = useState<{
    totalFTE: number
    directFTE: number
    indirectFTE: number
    staffFTE: number
    totalHours: number
    directHours: number
    indirectHours: number
    staffHours: number
    categoryRates: { direct: number; indirect: number; staff: number }
  } | null>(null)
  const [activeView, setActiveView] = useState("pivot-analysis")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({ 
    key: null, 
    direction: "asc" 
  })
  const [selectedPivotPreset, setSelectedPivotPreset] = useState(laborPivotPresets[0].id)
  const [pivotFilters, setPivotFilters] = useState<PivotFilters>({})

  // Calculate KPIs - sum across ALL weeks
  const totalLaborCost = weeklyData.reduce((sum, week) => sum + (week.totalCostWithBurden || 0), 0)
  const totalHours = weeklyData.reduce((sum, week) => sum + (week.totalHours || 0), 0)
  const totalOvertimeHours = weeklyData.reduce((sum, week) => sum + (week.overtimeHours || 0), 0)
  const regularHours = totalHours - totalOvertimeHours
  
  // Use FTE and rates from API response
  const activeHeadcount = currentWeekStats?.totalFTE || 0
  const directCount = currentWeekStats?.directFTE || 0
  const indirectCount = currentWeekStats?.indirectFTE || 0
  const staffCount = currentWeekStats?.staffFTE || 0
  
  
  // For backward compatibility with other parts of the code
  const latestWeekWithEmployees = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1].weekEnding : null
  
  // Use average hourly costs from API response
  const categoryRates = useMemo(() => {
    return currentWeekStats?.categoryRates || { direct: 0, indirect: 0, staff: 0 }
  }, [currentWeekStats])
  
  const otPercentage = totalHours > 0 ? (totalOvertimeHours / totalHours) * 100 : 0

  // Chart data with cumulative totals (costs already include burden from API)
  const chartData = weeklyData.reduce((acc, week, index) => {
    const weekTotal = week.directLaborCost + week.indirectLaborCost + week.staffLaborCost
    const previousCumulative = index > 0 ? acc[index - 1].cumulativeTotal : 0
    
    acc.push({
      week: format(new Date(week.weekEnding), "MMM d"),
      directCost: week.directLaborCost,
      indirectCost: week.indirectLaborCost,
      staffCost: week.staffLaborCost,
      totalCost: weekTotal,
      cumulativeTotal: previousCumulative + weekTotal,
    })
    
    return acc
  }, [] as Array<{
    week: string
    directCost: number
    indirectCost: number
    staffCost: number
    totalCost: number
    cumulativeTotal: number
  }>)

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    const filtered = employeeData.filter(
      (emp) =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.craft.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof EmployeeData]
        const bValue = b[sortConfig.key as keyof EmployeeData]
        
        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1
        }
        return 0
      })
    }

    return filtered
  }, [employeeData, searchTerm, sortConfig])

  // Category summary (for current week only)
  const categorySummary = useMemo(() => {
    const summary: Record<string, { count: number; cost: number }> = { 
      Direct: { count: 0, cost: 0 }, 
      Indirect: { count: 0, cost: 0 }, 
      Staff: { count: 0, cost: 0 } 
    }

    // Use the same latest week with employees that we calculated above
    const latestWeekEmployeesForSummary = latestWeekWithEmployees 
      ? employeeData.filter(emp => emp.weekEnding === latestWeekWithEmployees)
      : []
    
    latestWeekEmployeesForSummary.forEach((emp) => {
      if (summary[emp.category]) {
        summary[emp.category].count += 1
        summary[emp.category].cost += emp.totalCostWithBurden
      }
    })

    return summary
  }, [employeeData, latestWeekWithEmployees])

  // Calculate filter options from employee data
  const filterOptions = useMemo(() => {
    const monthOptions: MultiSelectOption[] = []
    const weekOptions: MultiSelectOption[] = []
    const employeeOptions: MultiSelectOption[] = []
    const craftOptions: MultiSelectOption[] = []
    const categoryOptions: MultiSelectOption[] = []
    
    // Count occurrences
    const monthCounts = new Map<string, number>()
    const weekCounts = new Map<string, number>()
    const employeeCounts = new Map<string, number>()
    const craftCounts = new Map<string, number>()
    const categoryCounts = new Map<string, number>()
    
    employeeData.forEach(emp => {
      // Months
      monthCounts.set(emp.month, (monthCounts.get(emp.month) || 0) + 1)
      // Weeks
      weekCounts.set(emp.weekEnding, (weekCounts.get(emp.weekEnding) || 0) + 1)
      // Employees
      employeeCounts.set(emp.name, (employeeCounts.get(emp.name) || 0) + 1)
      // Crafts
      craftCounts.set(emp.craft, (craftCounts.get(emp.craft) || 0) + 1)
      // Categories
      categoryCounts.set(emp.category, (categoryCounts.get(emp.category) || 0) + 1)
    })
    
    // Convert to options
    Array.from(monthCounts.entries()).forEach(([value, count]) => {
      monthOptions.push({ 
        value, 
        label: dimensionFormatters.month(value),
        count 
      })
    })
    monthOptions.sort((a, b) => a.value.localeCompare(b.value))
    
    Array.from(weekCounts.entries()).forEach(([value, count]) => {
      weekOptions.push({ 
        value, 
        label: format(new Date(value), "MMM d, yyyy"),
        count 
      })
    })
    weekOptions.sort((a, b) => b.value.localeCompare(a.value))
    
    Array.from(employeeCounts.entries()).forEach(([value, count]) => {
      employeeOptions.push({ value, label: value, count })
    })
    employeeOptions.sort((a, b) => a.label.localeCompare(b.label))
    
    Array.from(craftCounts.entries()).forEach(([value, count]) => {
      craftOptions.push({ value, label: value, count })
    })
    craftOptions.sort((a, b) => a.label.localeCompare(b.label))
    
    Array.from(categoryCounts.entries()).forEach(([value, count]) => {
      categoryOptions.push({ value, label: value, count })
    })
    categoryOptions.sort((a, b) => a.label.localeCompare(b.label))
    
    return { monthOptions, weekOptions, employeeOptions, craftOptions, categoryOptions }
  }, [employeeData])

  // Pivot table configuration based on selected preset
  const pivotConfig = useMemo(() => {
    const preset = laborPivotPresets.find(p => p.id === selectedPivotPreset) || laborPivotPresets[0]
    
    const dimensions: PivotDimension[] = preset.config.dimensions.map(dim => ({
      key: dim,
      label: dim.charAt(0).toUpperCase() + dim.slice(1).replace(/([A-Z])/g, ' $1').trim(),
      formatter: dimensionFormatters[dim as keyof typeof dimensionFormatters]
    }))
    
    const measures: PivotMeasure[] = preset.config.measures.map(measure => {
      const label = measure.key.charAt(0).toUpperCase() + measure.key.slice(1).replace(/([A-Z])/g, ' $1').trim()
      let formatter = measureFormatters.count
      
      if (measure.key.includes('Hours')) {
        formatter = measureFormatters.hours
      } else if (measure.key.includes('Cost') || measure.key.includes('Wages')) {
        formatter = measureFormatters.currency
      }
      
      return {
        key: measure.key,
        label,
        aggregation: measure.aggregation,
        formatter
      }
    })
    
    return { dimensions, measures }
  }, [selectedPivotPreset])

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const fetchAnalyticsData = useCallback(async () => {
    if (!projectId) return

    try {
      setIsLoading(true)

      // Fetch project info and analytics data
      const response = await fetch(`/api/projects/${projectId}/labor-analytics`)
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      
      const data = await response.json()
      

      // Set project info
      setProjectInfo({
        id: projectId,
        jobNumber: data.project.job_number,
        name: data.project.name
      })

      // Process weekly data
      const processedWeekly: WeeklyData[] = data.weeklyData.map((week: {
        weekEnding: string
        directCost: number
        indirectCost: number
        staffCost: number
        actualHours: number
        overtimeHours: number
        actualCost: number
      }) => ({
        weekEnding: week.weekEnding,
        weekLabel: `Week of ${format(new Date(week.weekEnding), "MMM d")}`,
        directLaborCost: week.directCost || 0,
        indirectLaborCost: week.indirectCost || 0,
        staffLaborCost: week.staffCost || 0,
        totalHours: week.actualHours || 0,
        overtimeHours: week.overtimeHours || 0,
        totalCostWithBurden: week.actualCost || 0,
      }))
      setWeeklyData(processedWeekly)

      // Process employee data for all weeks
      const allEmployees: EmployeeData[] = data.employeeDetails
        .map((emp: {
          employee_id: string
          weekEnding: string
          firstName: string
          lastName: string
          employeeNumber: string
          craft: string
          category: string
          st_hours: number
          ot_hours: number
          totalCostWithBurden: number
        }) => ({
          id: `${emp.employee_id}-${emp.weekEnding}`,
          weekEnding: emp.weekEnding,
          month: getMonthFromWeekEnding(emp.weekEnding),
          name: `${emp.firstName} ${emp.lastName}`,
          employeeNumber: emp.employeeNumber,
          craft: emp.craft || 'Unknown',
          category: emp.category || 'Direct',
          regularHours: emp.st_hours || 0,
          overtimeHours: emp.ot_hours || 0,
          totalCostWithBurden: emp.totalCostWithBurden || 0
        }))
      setEmployeeData(allEmployees)
      // Set current week stats
      setCurrentWeekStats(data.currentWeekStats)

    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) {
      router.push('/labor')
      return
    }

    fetchAnalyticsData()
  }, [projectId, router, fetchAnalyticsData])

  const handleExportCSV = () => {
    const headers = [
      'Employee Name',
      'Employee Number',
      'Craft',
      'Category',
      'Regular Hours',
      'Overtime Hours',
      'Total Hours',
      'Total Cost (incl. Burden)'
    ]

    const rows = filteredEmployees.map(emp => [
      emp.name,
      emp.employeeNumber,
      emp.craft,
      emp.category,
      emp.regularHours,
      emp.overtimeHours,
      emp.regularHours + emp.overtimeHours,
      emp.totalCostWithBurden
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labor-details-${projectInfo?.jobNumber}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePivotExport = (data: Array<Record<string, unknown>>) => {
    const filename = `labor-pivot-${projectInfo?.jobNumber}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    exportPivotToCSV(data, pivotConfig.dimensions, pivotConfig.measures, filename)
  }

  const handleFilterChange = (filterKey: string, values: string[]) => {
    setPivotFilters(prev => ({
      ...prev,
      [filterKey]: values.length > 0 ? values : undefined
    }))
  }

  const clearAllFilters = () => {
    setPivotFilters({})
  }

  const activeFilterCount = Object.values(pivotFilters).filter(v => v && v.length > 0).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!projectInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Link
            href={`/labor?project_id=${projectId}`}
            className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Labor Dashboard
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{projectInfo.name}</h1>
              <p className="text-gray-600">Job #{projectInfo.jobNumber}</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={activeView} onValueChange={setActiveView}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pivot-analysis">Pivot Analysis</SelectItem>
                  <SelectItem value="weekly-summary">Weekly Summary</SelectItem>
                  <SelectItem value="crew-details">Crew Details</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExportCSV} className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Labor Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalLaborCost)}</div>
              <p className="text-xs text-gray-600 mt-1">
                Direct: {formatCurrency(weeklyData.reduce((sum, w) => sum + (w.directLaborCost || 0), 0))} | Indirect: {formatCurrency(weeklyData.reduce((sum, w) => sum + (w.indirectLaborCost || 0), 0))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toLocaleString()}</div>
              <p className="text-xs text-gray-600 mt-1">
                ST: {regularHours.toLocaleString()} | OT: {totalOvertimeHours.toLocaleString()} ({otPercentage.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Headcount (FTE)</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeHeadcount.toFixed(1)}</div>
              <p className="text-xs text-gray-600 mt-1">
                Direct: {directCount.toFixed(1)} | Indirect: {indirectCount.toFixed(1)}{staffCount > 0 ? ` | Staff: ${staffCount.toFixed(1)}` : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Hourly Cost</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Direct:</span> <span className="font-semibold">{formatCurrency(categoryRates.direct)}/hr</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Indirect:</span> <span className="font-semibold">{formatCurrency(categoryRates.indirect)}/hr</span>
                </div>
                {categoryRates.staff > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-600">Staff:</span> <span className="font-semibold">{formatCurrency(categoryRates.staff)}/hr</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        {activeView === "pivot-analysis" && (
          <div className="space-y-4">
            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Labor Costs (with Burden) - Last 12 Weeks</CardTitle>
                <CardDescription>All values include 28% burden for insurance and taxes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Week of ${label}`}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="directCost" fill="#2563eb" name="Direct Labor" />
                      <Bar yAxisId="left" dataKey="indirectCost" fill="#7c3aed" name="Indirect Labor" />
                      <Bar yAxisId="left" dataKey="staffCost" fill="#f97316" name="Staff Labor" />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="cumulativeTotal" 
                        stroke="#059669" 
                        strokeWidth={3}
                        name="Cumulative Total" 
                        dot={{ fill: '#059669', r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pivot Analysis */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Pivot Analysis</CardTitle>
                    <CardDescription>
                      Group and analyze labor data like Excel pivot tables
                    </CardDescription>
                  </div>
                  <Select value={selectedPivotPreset} onValueChange={setSelectedPivotPreset}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder="Select a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {laborPivotPresets.map(preset => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <div>
                            <div className="font-medium">{preset.name}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter Controls */}
                <div className="space-y-4 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filters</h3>
                    {activeFilterCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearAllFilters}
                        className="text-xs"
                      >
                        Clear all ({activeFilterCount})
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Month</label>
                      <MultiSelect
                        options={filterOptions.monthOptions}
                        selected={pivotFilters.month || []}
                        onChange={(values) => handleFilterChange('month', values)}
                        placeholder="All months"
                        searchPlaceholder="Search months..."
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block">Week Ending</label>
                      <MultiSelect
                        options={filterOptions.weekOptions}
                        selected={pivotFilters.weekEnding || []}
                        onChange={(values) => handleFilterChange('weekEnding', values)}
                        placeholder="All weeks"
                        searchPlaceholder="Search weeks..."
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block">Employee</label>
                      <MultiSelect
                        options={filterOptions.employeeOptions}
                        selected={pivotFilters.name || []}
                        onChange={(values) => handleFilterChange('name', values)}
                        placeholder="All employees"
                        searchPlaceholder="Search employees..."
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block">Craft Type</label>
                      <MultiSelect
                        options={filterOptions.craftOptions}
                        selected={pivotFilters.craft || []}
                        onChange={(values) => handleFilterChange('craft', values)}
                        placeholder="All crafts"
                        searchPlaceholder="Search crafts..."
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block">Category</label>
                      <MultiSelect
                        options={filterOptions.categoryOptions}
                        selected={pivotFilters.category || []}
                        onChange={(values) => handleFilterChange('category', values)}
                        placeholder="All categories"
                        searchPlaceholder="Search categories..."
                      />
                    </div>
                  </div>
                </div>

                {/* Pivot Table */}
                <PivotTable
                  data={employeeData}
                  dimensions={pivotConfig.dimensions}
                  measures={pivotConfig.measures}
                  filters={pivotFilters}
                  defaultExpanded={true}
                  onExport={handlePivotExport}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "weekly-summary" && (
          <div className="space-y-4">
            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Labor Costs (with Burden) - Last 12 Weeks</CardTitle>
                <CardDescription>All values include 28% burden for insurance and taxes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Week of ${label}`}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="directCost" fill="#2563eb" name="Direct Labor" />
                      <Bar yAxisId="left" dataKey="indirectCost" fill="#7c3aed" name="Indirect Labor" />
                      <Bar yAxisId="left" dataKey="staffCost" fill="#f97316" name="Staff Labor" />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="cumulativeTotal" 
                        stroke="#059669" 
                        strokeWidth={3}
                        name="Cumulative Total" 
                        dot={{ fill: '#059669', r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Labor Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week Ending</TableHead>
                        <TableHead>Direct Labor Cost (w/ Burden)</TableHead>
                        <TableHead>Indirect Labor Cost (w/ Burden)</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Overtime Hours</TableHead>
                        <TableHead>OT %</TableHead>
                        <TableHead>Total Cost (w/ Burden)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyData.slice(-8).map((week) => (
                        <TableRow key={week.weekEnding}>
                          <TableCell>{format(new Date(week.weekEnding), 'MM/dd/yyyy')}</TableCell>
                          <TableCell>{formatCurrency(week.directLaborCost)}</TableCell>
                          <TableCell>{formatCurrency(week.indirectLaborCost)}</TableCell>
                          <TableCell>{week.totalHours.toLocaleString()}</TableCell>
                          <TableCell>{week.overtimeHours}</TableCell>
                          <TableCell>{week.totalHours > 0 ? ((week.overtimeHours / week.totalHours) * 100).toFixed(1) : '0.0'}%</TableCell>
                          <TableCell>{formatCurrency(week.totalCostWithBurden)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "crew-details" && (
          <div className="space-y-4">
            {/* Category Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(categorySummary).map(([category, data]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{category} Labor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-2xl font-bold">{data.count}</div>
                        <p className="text-sm text-gray-600">employees</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold">{formatCurrency(data.cost)}</div>
                        <p className="text-sm text-gray-600">this week</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Employee Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Employee Details</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("weekEnding")}>
                          Week Ending
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("name")}>
                          Employee Name/Number
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("craft")}>
                          Craft Type
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("category")}>
                          Category
                        </TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("totalCostWithBurden")}>
                          Total Cost
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            No employees found matching your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">
                              {format(new Date(employee.weekEnding), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{employee.name}</div>
                                <div className="text-sm text-gray-600">{employee.employeeNumber}</div>
                              </div>
                            </TableCell>
                            <TableCell>{employee.craft}</TableCell>
                            <TableCell>
                              <Badge
                                variant={employee.category === "Direct" ? "default" : "secondary"}
                                className={employee.category === "Direct" ? "bg-blue-100 text-blue-800" : ""}
                              >
                                {employee.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>ST: {employee.regularHours}h</div>
                                {employee.overtimeHours > 0 && (
                                  <div className="text-orange-600">OT: {employee.overtimeHours}h</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(employee.totalCostWithBurden)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}