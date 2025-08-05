"use client"

import { useState, useMemo, useCallback } from "react"
import { ChevronDown, ChevronRight, Download, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { useExpansionState } from "@/lib/hooks/use-expansion-state"

export type AggregationMethod = "sum" | "average" | "count" | "min" | "max"

export interface PivotDimension {
  key: string
  label: string
  formatter?: (value: any) => string
}

export interface PivotMeasure {
  key: string
  label: string
  aggregation: AggregationMethod
  formatter?: (value: number) => string
}

export interface PivotFilters {
  [key: string]: string[] | undefined
}

export interface PivotTableProps<T> {
  data: T[]
  dimensions: PivotDimension[]
  measures: PivotMeasure[]
  filters?: PivotFilters
  defaultExpanded?: boolean
  className?: string
  onExport?: (data: any[]) => void
}

interface GroupedData<T> {
  key: string
  value: any
  items: T[]
  children?: GroupedData<T>[]
  aggregates: Record<string, number>
  isExpanded?: boolean
  level: number
}

function groupByDimensions<T>(
  data: T[],
  dimensions: PivotDimension[],
  measures: PivotMeasure[],
  level: number = 0
): GroupedData<T>[] {
  if (dimensions.length === 0 || level >= dimensions.length) {
    return []
  }

  const dimension = dimensions[level]
  const groups = new Map<any, T[]>()

  // Group data by current dimension
  data.forEach(item => {
    const key = (item as any)[dimension.key]
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  })

  // Convert groups to array and calculate aggregates
  const result: GroupedData<T>[] = []
  groups.forEach((items, value) => {
    const aggregates: Record<string, number> = {}
    
    // Calculate aggregates for each measure
    measures.forEach(measure => {
      const values = items.map(item => (item as any)[measure.key]).filter(v => v != null && !isNaN(v))
      
      // Debug logging for totalCostWithBurden
      if (measure.key === 'totalCostWithBurden' && dimension.key === 'name' && value === 'Cory LaChance') {
        console.log('Cory LaChance aggregation:', {
          itemCount: items.length,
          values,
          sum: values.reduce((sum, val) => sum + val, 0),
          rawItems: items.map(item => ({
            week: (item as any).weekEnding,
            hours: (item as any).regularHours,
            cost: (item as any).totalCostWithBurden
          }))
        })
      }
      
      switch (measure.aggregation) {
        case "sum":
          aggregates[measure.key] = values.reduce((sum, val) => sum + val, 0)
          break
        case "average":
          aggregates[measure.key] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
          break
        case "count":
          aggregates[measure.key] = items.length
          break
        case "min":
          aggregates[measure.key] = values.length > 0 ? Math.min(...values) : 0
          break
        case "max":
          aggregates[measure.key] = values.length > 0 ? Math.max(...values) : 0
          break
      }
    })

    const group: GroupedData<T> = {
      key: dimension.key,
      value,
      items,
      aggregates,
      level,
      isExpanded: false
    }

    // Recursively group by next dimension
    if (level < dimensions.length - 1) {
      group.children = groupByDimensions(items, dimensions, measures, level + 1)
    }

    result.push(group)
  })

  return result.sort((a, b) => {
    if (a.value < b.value) return -1
    if (a.value > b.value) return 1
    return 0
  })
}

export function PivotTable<T extends Record<string, any>>({
  data,
  dimensions,
  measures,
  filters,
  defaultExpanded = false,
  className,
  onExport
}: PivotTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  
  // Use persistent expansion state
  const {
    expandedItems: expandedRows,
    allExpanded,
    toggleItem: toggleRow,
    expandAll: expandAllRows,
    collapseAll: collapseAllRows,
    isExpanded
  } = useExpansionState({
    storageKey: 'pivot-table-expansion',
    defaultExpanded
  })

  // Filter data based on provided filters
  const filteredData = useMemo(() => {
    if (!filters || Object.keys(filters).length === 0) {
      return data
    }

    return data.filter(item => {
      for (const [key, values] of Object.entries(filters)) {
        if (values && values.length > 0) {
          const itemValue = String(item[key])
          if (!values.includes(itemValue)) {
            return false
          }
        }
      }
      return true
    })
  }, [data, filters])

  // Group data by dimensions
  const groupedData = useMemo(() => {
    const grouped = groupByDimensions(filteredData, dimensions, measures)
    
    // Apply sorting if configured
    if (sortConfig) {
      const sortGroups = (groups: GroupedData<T>[]): GroupedData<T>[] => {
        return groups.sort((a, b) => {
          const aVal = a.aggregates[sortConfig.key] ?? 0
          const bVal = b.aggregates[sortConfig.key] ?? 0
          
          if (sortConfig.direction === "asc") {
            return aVal - bVal
          } else {
            return bVal - aVal
          }
        }).map(group => ({
          ...group,
          children: group.children ? sortGroups(group.children) : undefined
        }))
      }
      
      return sortGroups(grouped)
    }
    
    return grouped
  }, [filteredData, dimensions, measures, sortConfig])

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    
    measures.forEach(measure => {
      const values = filteredData.map(item => item[measure.key]).filter(v => v != null && !isNaN(v))
      
      switch (measure.aggregation) {
        case "sum":
          totals[measure.key] = values.reduce((sum, val) => sum + val, 0)
          break
        case "average":
          totals[measure.key] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
          break
        case "count":
          totals[measure.key] = filteredData.length
          break
        case "min":
          totals[measure.key] = values.length > 0 ? Math.min(...values) : 0
          break
        case "max":
          totals[measure.key] = values.length > 0 ? Math.max(...values) : 0
          break
      }
    })
    
    return totals
  }, [data, measures])

  const expandAll = useCallback(() => {
    const allRowIds: string[] = []
    
    const collectRowIds = (groups: GroupedData<T>[], parentPath: string = "") => {
      groups.forEach((group, index) => {
        const currentPath = parentPath ? `${parentPath}-${index}` : `${index}`
        if (group.children && group.children.length > 0) {
          allRowIds.push(currentPath)
          collectRowIds(group.children, currentPath)
        }
      })
    }
    
    collectRowIds(groupedData)
    expandAllRows(allRowIds)
  }, [groupedData, expandAllRows])

  const collapseAll = useCallback(() => {
    collapseAllRows()
  }, [collapseAllRows])

  const handleSort = useCallback((measureKey: string) => {
    setSortConfig(prev => {
      if (prev?.key === measureKey) {
        return { key: measureKey, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key: measureKey, direction: "asc" }
    })
  }, [])

  const renderGroupedRows = useCallback((
    groups: GroupedData<T>[],
    parentPath: string = ""
  ): JSX.Element[] => {
    const rows: JSX.Element[] = []

    groups.forEach((group, index) => {
      const currentPath = parentPath ? `${parentPath}-${index}` : `${index}`
      const expanded = isExpanded(currentPath)
      const hasChildren = group.children && group.children.length > 0
      const dimension = dimensions[group.level]

      // Render group header row with enhanced visual hierarchy
      const isMonthDimension = dimension.key === 'month'
      const isWeekDimension = dimension.key === 'weekEnding'
      
      rows.push(
        <TableRow key={currentPath} className={cn(
          "font-medium transition-colors",
          isMonthDimension && "bg-gray-200 hover:bg-gray-300",
          isWeekDimension && group.level === 0 && "bg-gray-100 hover:bg-gray-200",
          isWeekDimension && group.level === 1 && "bg-gray-50 hover:bg-gray-100",
          !isMonthDimension && !isWeekDimension && group.level === 0 && "bg-gray-50",
          !isMonthDimension && !isWeekDimension && group.level === 1 && "bg-gray-100/50",
          !isMonthDimension && !isWeekDimension && group.level === 2 && "bg-gray-50/50"
        )}>
          <TableCell 
            className={cn(
              "cursor-pointer",
              isMonthDimension && "font-bold text-base",
              isWeekDimension && "font-semibold"
            )}
            style={{ paddingLeft: `${group.level * 24 + 12}px` }}
            onClick={() => hasChildren && toggleRow(currentPath)}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              )}
              {dimension.formatter ? dimension.formatter(group.value) : group.value}
              <span className="text-muted-foreground text-sm">
                ({group.items.length} {group.items.length === 1 ? 'item' : 'items'})
              </span>
            </div>
          </TableCell>
          {measures.map(measure => (
            <TableCell key={measure.key} className={cn(
              "text-right",
              isMonthDimension && "font-bold text-base",
              isWeekDimension && "font-semibold"
            )}>
              {measure.formatter 
                ? measure.formatter(group.aggregates[measure.key])
                : group.aggregates[measure.key].toLocaleString()
              }
            </TableCell>
          ))}
        </TableRow>
      )

      // Render children if expanded
      if (expanded && hasChildren) {
        rows.push(...renderGroupedRows(group.children!, currentPath))
      }

      // Render individual items if this is the last dimension level and expanded
      if (expanded && !hasChildren && group.level === dimensions.length - 1) {
        group.items.forEach((item, itemIndex) => {
          rows.push(
            <TableRow key={`${currentPath}-item-${itemIndex}`} className="text-sm">
              <TableCell style={{ paddingLeft: `${(group.level + 1) * 24 + 12}px` }}>
                {/* Show additional item details if needed */}
              </TableCell>
              {measures.map(measure => (
                <TableCell key={measure.key} className="text-right text-muted-foreground">
                  {measure.formatter && item[measure.key] != null
                    ? measure.formatter(item[measure.key])
                    : item[measure.key]?.toLocaleString() ?? "-"
                  }
                </TableCell>
              ))}
            </TableRow>
          )
        })
      }
    })

    return rows
  }, [dimensions, measures, expandedRows, defaultExpanded, toggleRow])

  const handleExport = useCallback(() => {
    if (!onExport) return

    // Flatten the grouped data for export
    const exportData: any[] = []
    
    const flattenGroups = (groups: GroupedData<T>[], parentValues: Record<string, any> = {}) => {
      groups.forEach(group => {
        const currentValues = {
          ...parentValues,
          [group.key]: group.value
        }
        
        // Add group totals row
        const row: any = { ...currentValues }
        measures.forEach(measure => {
          row[measure.label] = group.aggregates[measure.key]
        })
        exportData.push(row)
        
        // Recursively flatten children
        if (group.children) {
          flattenGroups(group.children, currentValues)
        }
      })
    }
    
    flattenGroups(groupedData)
    
    // Add grand totals
    const grandTotalRow: any = {}
    dimensions.forEach(dim => {
      grandTotalRow[dim.label] = "Grand Total"
    })
    measures.forEach(measure => {
      grandTotalRow[measure.label] = grandTotals[measure.key]
    })
    exportData.push(grandTotalRow)
    
    onExport(exportData)
  }, [groupedData, dimensions, measures, grandTotals, onExport])

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for pivot analysis
      </div>
    )
  }

  if (filteredData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data matches the current filters
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
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
        {onExport && (
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                {dimensions.map(d => d.label).join(" / ")}
              </TableHead>
              {measures.map(measure => (
                <TableHead 
                  key={measure.key}
                  className="text-right cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort(measure.key)}
                >
                  {measure.label}
                  {sortConfig?.key === measure.key && (
                    <span className="ml-1">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderGroupedRows(groupedData)}
            
            {/* Grand Totals */}
            <TableRow className="font-bold bg-gray-100 border-t-2">
              <TableCell>Grand Total</TableCell>
              {measures.map(measure => (
                <TableCell key={measure.key} className="text-right">
                  {measure.formatter 
                    ? measure.formatter(grandTotals[measure.key])
                    : grandTotals[measure.key].toLocaleString()
                  }
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}