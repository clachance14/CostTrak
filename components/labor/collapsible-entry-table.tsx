"use client"

import { useMemo, useEffect } from "react"
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { getMonthFromWeekEnding, formatMonth } from "@/lib/utils/date-helpers"
import { useExpansionState } from "@/lib/hooks/use-expansion-state"

interface CraftType {
  id: string
  name: string
  code: string
  laborCategory: 'direct' | 'indirect' | 'staff'
  runningAvgRate: number
}

interface LaborActual {
  id?: string
  craftTypeId: string
  craftName: string
  craftCode: string
  laborCategory: string
  totalCost: number
  totalHours: number
  ratePerHour: number
  runningAvgRate: number
}

interface CollapsibleEntryTableProps {
  laborEntries: Map<string, LaborActual>
  weekEnding: Date
  updateEntry: (craftTypeId: string, field: 'totalCost' | 'totalHours', value: string) => void
  laborCategoryLabels: Record<string, string>
}

interface WeekData {
  weekEnding: string
  entries: LaborActual[]
  totals: {
    cost: number
    hours: number
  }
}

interface MonthData {
  month: string
  weeks: WeekData[]
  totals: {
    cost: number
    hours: number
  }
}

export function CollapsibleEntryTable({
  laborEntries,
  weekEnding,
  updateEntry,
  laborCategoryLabels
}: CollapsibleEntryTableProps) {
  // Use persistent expansion state for months
  const {
    expandedItems: expandedMonths,
    allExpanded: allMonthsExpanded,
    toggleItem: toggleMonth,
    expandAll: expandAllMonths,
    collapseAll: collapseAllMonths,
    isExpanded: isMonthExpanded
  } = useExpansionState({
    storageKey: 'labor-entry-months',
    defaultExpanded: false
  })
  
  // Use persistent expansion state for weeks
  const {
    expandedItems: expandedWeeks,
    allExpanded: allWeeksExpanded,
    toggleItem: toggleWeek,
    expandAll: expandAllWeeks,
    collapseAll: collapseAllWeeks,
    isExpanded: isWeekExpanded
  } = useExpansionState({
    storageKey: 'labor-entry-weeks',
    defaultExpanded: false
  })
  
  const allExpanded = allMonthsExpanded && allWeeksExpanded

  // Group data by month and week
  const groupedData = useMemo(() => {
    const currentWeekString = weekEnding.toISOString().split('T')[0]
    const currentMonth = getMonthFromWeekEnding(weekEnding)
    
    // For now, we only have data for the current week
    // In a real implementation, you might fetch historical data
    const weekData: WeekData = {
      weekEnding: currentWeekString,
      entries: Array.from(laborEntries.values()),
      totals: {
        cost: Array.from(laborEntries.values()).reduce((sum, entry) => sum + entry.totalCost, 0),
        hours: Array.from(laborEntries.values()).reduce((sum, entry) => sum + entry.totalHours, 0)
      }
    }
    
    const monthData: MonthData = {
      month: currentMonth,
      weeks: [weekData],
      totals: {
        cost: weekData.totals.cost,
        hours: weekData.totals.hours
      }
    }
    
    return [monthData]
  }, [laborEntries, weekEnding])

  // Auto-expand current month and week
  useEffect(() => {
    const currentMonth = getMonthFromWeekEnding(weekEnding)
    const currentWeek = weekEnding.toISOString().split('T')[0]
    
    // Only auto-expand if not already expanded
    if (!isMonthExpanded(currentMonth)) {
      toggleMonth(currentMonth)
    }
    if (!isWeekExpanded(currentWeek)) {
      toggleWeek(currentWeek)
    }
  }, [weekEnding, isMonthExpanded, isWeekExpanded, toggleMonth, toggleWeek])

  const handleToggleMonth = (month: string) => {
    toggleMonth(month)
    
    // If collapsing month, also collapse its weeks
    if (isMonthExpanded(month)) {
      const monthData = groupedData.find(m => m.month === month)
      monthData?.weeks.forEach(week => {
        if (isWeekExpanded(week.weekEnding)) {
          toggleWeek(week.weekEnding)
        }
      })
    }
  }

  const expandAll = () => {
    const allMonthIds = groupedData.map(m => m.month)
    const allWeekIds = groupedData.flatMap(m => m.weeks.map(w => w.weekEnding))
    expandAllMonths(allMonthIds)
    expandAllWeeks(allWeekIds)
  }

  const collapseAll = () => {
    collapseAllMonths()
    collapseAllWeeks()
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Labor Entry by Period</h3>
        <Button
          onClick={allExpanded ? collapseAll : expandAll}
          variant="outline"
          size="sm"
        >
          {allExpanded ? (
            <>
              <Minimize2 className="h-4 w-4 mr-2" />
              Collapse All
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4 mr-2" />
              Expand All
            </>
          )}
        </Button>
      </div>

      {/* Hierarchical Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {groupedData.map(monthData => {
          const monthExpanded = isMonthExpanded(monthData.month)
          
          return (
            <div key={monthData.month}>
              {/* Month Header */}
              <div
                className="bg-gray-200 hover:bg-gray-300 px-6 py-4 cursor-pointer transition-colors"
                onClick={() => handleToggleMonth(monthData.month)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {monthExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <span className="font-bold text-base">
                      {formatMonth(monthData.month)}
                    </span>
                    <span className="text-sm text-gray-600">
                      ({monthData.weeks.length} {monthData.weeks.length === 1 ? 'week' : 'weeks'})
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-600">Total Cost:</span>{' '}
                      <span className="font-bold">{formatCurrency(monthData.totals.cost)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Hours:</span>{' '}
                      <span className="font-bold">{monthData.totals.hours.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weeks in Month */}
              {monthExpanded && monthData.weeks.map(weekData => {
                const weekExpanded = isWeekExpanded(weekData.weekEnding)
                const isCurrentWeek = weekData.weekEnding === weekEnding.toISOString().split('T')[0]
                
                return (
                  <div key={weekData.weekEnding}>
                    {/* Week Header */}
                    <div
                      className={cn(
                        "bg-gray-100 hover:bg-gray-200 px-6 py-3 cursor-pointer transition-colors",
                        isCurrentWeek && "ring-2 ring-blue-500 ring-inset"
                      )}
                      onClick={() => toggleWeek(weekData.weekEnding)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 ml-6">
                          {weekExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-semibold">
                            Week ending {format(new Date(weekData.weekEnding), "MMM d, yyyy")}
                          </span>
                          {isCurrentWeek && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Current Week
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-gray-600">Cost:</span>{' '}
                            <span className="font-semibold">{formatCurrency(weekData.totals.cost)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Hours:</span>{' '}
                            <span className="font-semibold">{weekData.totals.hours.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Labor Entries by Category */}
                    {weekExpanded && (
                      <div className="px-6 py-4 bg-white">
                        {Object.entries(laborCategoryLabels).map(([category, label]) => {
                          const categoryEntries = weekData.entries.filter(
                            entry => entry.laborCategory === category
                          )
                          
                          if (categoryEntries.length === 0) return null
                          
                          const categoryTotals = {
                            cost: categoryEntries.reduce((sum, e) => sum + e.totalCost, 0),
                            hours: categoryEntries.reduce((sum, e) => sum + e.totalHours, 0)
                          }

                          return (
                            <div key={category} className="mb-6 last:mb-0">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">{label}</h4>
                                <div className="text-sm text-gray-600">
                                  Subtotal: {formatCurrency(categoryTotals.cost)} / {categoryTotals.hours.toFixed(1)}h
                                </div>
                              </div>
                              
                              <table className="min-w-full">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Craft Type
                                    </th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Total Cost ($)
                                    </th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Total Hours
                                    </th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Rate/Hour
                                    </th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Running Avg
                                    </th>
                                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                                      Variance
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categoryEntries.map(entry => {
                                    const variance = entry.runningAvgRate > 0 && entry.ratePerHour > 0
                                      ? ((entry.ratePerHour - entry.runningAvgRate) / entry.runningAvgRate) * 100
                                      : 0

                                    return (
                                      <tr key={entry.craftTypeId} className="border-b last:border-0">
                                        <td className="py-3">
                                          <div>
                                            <div className="font-medium text-gray-900">
                                              {entry.craftName}
                                            </div>
                                            <div className="text-sm text-gray-500">{entry.craftCode}</div>
                                          </div>
                                        </td>
                                        <td className="py-3">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={entry.totalCost || ''}
                                            onChange={(e) => updateEntry(entry.craftTypeId, 'totalCost', e.target.value)}
                                            className="w-32 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                            disabled={!isCurrentWeek}
                                          />
                                        </td>
                                        <td className="py-3">
                                          <input
                                            type="number"
                                            step="0.5"
                                            value={entry.totalHours || ''}
                                            onChange={(e) => updateEntry(entry.craftTypeId, 'totalHours', e.target.value)}
                                            className="w-32 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.0"
                                            disabled={!isCurrentWeek}
                                          />
                                        </td>
                                        <td className="py-3 text-sm">
                                          {entry.ratePerHour > 0 ? formatCurrency(entry.ratePerHour) : '-'}
                                        </td>
                                        <td className="py-3 text-sm text-gray-600">
                                          {entry.runningAvgRate > 0 ? formatCurrency(entry.runningAvgRate) : 'No data'}
                                        </td>
                                        <td className="py-3 text-sm">
                                          {variance !== 0 && (
                                            <div className={cn(
                                              "flex items-center",
                                              variance > 10 ? 'text-red-600' : variance < -10 ? 'text-green-600' : 'text-gray-900'
                                            )}>
                                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}