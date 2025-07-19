'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ChevronDown, 
  ChevronUp, 
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { format } from 'date-fns'

interface EmployeeDetail {
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
}

interface PeriodBreakdown {
  weekEnding: string
  employees: EmployeeDetail[]
  totalActualHours: number
  totalActualCost: number
  totalForecastedHours: number
  totalForecastedCost: number
  varianceDollars: number
  variancePercent: number
}

interface LaborPeriodTableProps {
  periodBreakdown: PeriodBreakdown[]
  onDrillDown?: (weekEnding: string, employeeId: string) => void
}

export function LaborPeriodTable({ periodBreakdown, onDrillDown }: LaborPeriodTableProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [varianceFilter, setVarianceFilter] = useState<string>('all')
  const [craftFilter, setCraftFilter] = useState<string>('all')

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatRate = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatWeek = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const toggleWeek = (week: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(week)) {
      newExpanded.delete(week)
    } else {
      newExpanded.add(week)
    }
    setExpandedWeeks(newExpanded)
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'direct': return 'Direct'
      case 'indirect': return 'Indirect'
      case 'staff': return 'Staff'
      default: return 'Other'
    }
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return 'text-destructive'
    if (variance > 5) return 'text-orange-600'
    if (variance < -5) return 'text-green-600'
    return 'text-muted-foreground'
  }

  const getVarianceIcon = (variance: number) => {
    if (variance > 5) return <TrendingUp className="h-3 w-3 text-destructive" />
    if (variance < -5) return <TrendingDown className="h-3 w-3 text-green-600" />
    return null
  }

  // Filter data
  let filteredData = periodBreakdown.map(period => {
    let filteredEmployees = period.employees

    if (searchTerm) {
      filteredEmployees = filteredEmployees.filter(emp =>
        emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.craftName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== 'all') {
      filteredEmployees = filteredEmployees.filter(emp => emp.category === categoryFilter)
    }

    if (craftFilter !== 'all') {
      filteredEmployees = filteredEmployees.filter(emp => emp.craftCode === craftFilter)
    }

    return {
      ...period,
      employees: filteredEmployees
    }
  })

  if (varianceFilter !== 'all') {
    filteredData = filteredData.filter(period => {
      if (varianceFilter === 'over') return period.variancePercent > 10
      if (varianceFilter === 'risk') return period.variancePercent > 5 && period.variancePercent <= 10
      if (varianceFilter === 'under') return period.variancePercent < -5
      return true
    })
  }

  // Filter out weeks with no employees after filtering
  filteredData = filteredData.filter(period => period.employees.length > 0 || period.totalForecastedHours > 0)

  // Get unique craft types for filter
  const allCraftTypes = new Set<string>()
  periodBreakdown.forEach(period => {
    period.employees.forEach(emp => {
      allCraftTypes.add(emp.craftCode)
    })
  })

  // Find weeks with high variance
  const flaggedWeeks = filteredData.filter(period => Math.abs(period.variancePercent) > 10)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search craft..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="direct">Direct</SelectItem>
            <SelectItem value="indirect">Indirect</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
        <Select value={varianceFilter} onValueChange={setVarianceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Variance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Variances</SelectItem>
            <SelectItem value="over">Over Budget (&gt;10%)</SelectItem>
            <SelectItem value="risk">At Risk (5-10%)</SelectItem>
            <SelectItem value="under">Under Budget (&lt;-5%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Variance Alerts */}
      {flaggedWeeks.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h4 className="font-semibold text-sm">Variance Alerts</h4>
          </div>
          <div className="space-y-1">
            {flaggedWeeks.map((period) => (
              <p key={period.weekEnding} className="text-sm text-muted-foreground">
                Week ending {formatWeek(period.weekEnding)}: {period.variancePercent > 0 ? '+' : ''}{period.variancePercent.toFixed(1)}% variance
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Period Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Week Ending</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Craft</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">ST Hours</TableHead>
              <TableHead className="text-right">OT Hours</TableHead>
              <TableHead className="text-right">Total Hours</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No data matching filters
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((period) => (
                <React.Fragment key={period.weekEnding}>
                  {/* Week Header Row */}
                  <TableRow 
                    className="bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => toggleWeek(period.weekEnding)}
                  >
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleWeek(period.weekEnding)
                          }}
                        >
                          {expandedWeeks.has(period.weekEnding) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </Button>
                        {formatWeek(period.weekEnding)}
                        {Math.abs(period.variancePercent) > 10 && (
                          <Badge variant="destructive" className="text-xs">
                            High Variance
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {period.employees.length} employees
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* Empty cell for Craft column */}
                    </TableCell>
                    <TableCell>
                      {/* Empty cell for Category column */}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {/* Calculate total ST hours */}
                      {formatNumber(period.employees.reduce((sum, emp) => sum + emp.stHours, 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {/* Calculate total OT hours */}
                      {formatNumber(period.employees.reduce((sum, emp) => sum + emp.otHours, 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(period.totalActualHours)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {/* Calculate average rate */}
                      {period.totalActualHours > 0 
                        ? formatRate(period.totalActualCost / period.totalActualHours)
                        : '$0.00'
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="space-y-1">
                        <div>Actual: {formatCurrency(period.totalActualCost)}</div>
                        <div className="text-xs text-muted-foreground">
                          Forecast: {formatCurrency(period.totalForecastedCost)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {getVarianceIcon(period.variancePercent)}
                          <span className={`text-xs ${getVarianceColor(period.variancePercent)}`}>
                            {period.variancePercent > 0 ? '+' : ''}{period.variancePercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Employee Detail Rows */}
                  {expandedWeeks.has(period.weekEnding) && period.employees.map((employee) => (
                    <TableRow 
                      key={`${period.weekEnding}-${employee.employeeId}`}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => onDrillDown?.(period.weekEnding, employee.employeeId)}
                    >
                      <TableCell className="pl-10">&nbsp;</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.employeeName}</div>
                          <div className="text-xs text-muted-foreground">{employee.employeeNumber}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{employee.craftName}</div>
                        <div className="text-xs text-muted-foreground">{employee.craftCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(employee.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(employee.stHours)}</TableCell>
                      <TableCell className="text-right">{formatNumber(employee.otHours)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(employee.totalHours)}</TableCell>
                      <TableCell className="text-right">{formatRate(employee.rate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(employee.actualCost)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}