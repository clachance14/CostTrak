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
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CraftBreakdown {
  craftCode: string
  craftName: string
  category: string
  actualHours: number
  forecastedHours: number
  actualCost: number
  forecastedCost: number
  varianceDollars: number
  variancePercent: number
}

interface LaborCraftTableProps {
  craftBreakdown: CraftBreakdown[]
  onDrillDown?: (craftCode: string) => void
}

type SortField = 'craftName' | 'category' | 'actualHours' | 'actualCost' | 'varianceDollars' | 'variancePercent'
type SortOrder = 'asc' | 'desc'

export function LaborCraftTable({ craftBreakdown, onDrillDown }: LaborCraftTableProps) {
  const [sortField, setSortField] = useState<SortField>('craftName')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['direct', 'indirect', 'staff'])
  )

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Group by category
  const groupedData = craftBreakdown.reduce((acc, craft) => {
    const category = craft.category || 'uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(craft)
    return acc
  }, {} as Record<string, CraftBreakdown[]>)

  // Sort within groups
  Object.keys(groupedData).forEach(category => {
    groupedData[category].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue)
      }
      
      return sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  })

  // Calculate totals
  const totals = craftBreakdown.reduce((acc, craft) => {
    acc.actualHours += craft.actualHours
    acc.forecastedHours += craft.forecastedHours
    acc.actualCost += craft.actualCost
    acc.forecastedCost += craft.forecastedCost
    acc.varianceDollars += craft.varianceDollars
    return acc
  }, {
    actualHours: 0,
    forecastedHours: 0,
    actualCost: 0,
    forecastedCost: 0,
    varianceDollars: 0
  })

  const totalVariancePercent = totals.forecastedCost > 0 
    ? (totals.varianceDollars / totals.forecastedCost) * 100 
    : 0

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'direct': return 'Direct Labor'
      case 'indirect': return 'Indirect Labor'
      case 'staff': return 'Staff'
      default: return 'Other'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'direct': return 'bg-blue-100 text-blue-800'
      case 'indirect': return 'bg-orange-100 text-orange-800'
      case 'staff': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return 'text-destructive font-semibold'
    if (variance > 5) return 'text-orange-600'
    if (variance < -5) return 'text-green-600'
    return 'text-muted-foreground'
  }

  const categoryOrder = ['direct', 'indirect', 'staff', 'uncategorized']

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('craftName')}
              >
                Craft
                {sortField === 'craftName' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('category')}
              >
                Group
                {sortField === 'category' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('actualHours')}
              >
                Actual Hours
                {sortField === 'actualHours' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="text-right">Forecasted Hours</TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('actualCost')}
              >
                Actual Cost
                {sortField === 'actualCost' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="text-right">Forecasted Cost</TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('varianceDollars')}
              >
                Variance $
                {sortField === 'varianceDollars' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                className="h-auto p-0 font-semibold"
                onClick={() => handleSort('variancePercent')}
              >
                Variance %
                {sortField === 'variancePercent' && (
                  sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                )}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoryOrder.map(category => {
            const crafts = groupedData[category]
            if (!crafts || crafts.length === 0) return null

            const categoryTotals = crafts.reduce((acc, craft) => {
              acc.actualHours += craft.actualHours
              acc.forecastedHours += craft.forecastedHours
              acc.actualCost += craft.actualCost
              acc.forecastedCost += craft.forecastedCost
              acc.varianceDollars += craft.varianceDollars
              return acc
            }, {
              actualHours: 0,
              forecastedHours: 0,
              actualCost: 0,
              forecastedCost: 0,
              varianceDollars: 0
            })

            const categoryVariancePercent = categoryTotals.forecastedCost > 0 
              ? (categoryTotals.varianceDollars / categoryTotals.forecastedCost) * 100 
              : 0

            return (
              <React.Fragment key={category}>
                {/* Category Header */}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={8} className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => toggleCategory(category)}
                      >
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </Button>
                      <Badge className={cn("text-xs", getCategoryColor(category))}>
                        {getCategoryLabel(category)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({crafts.length} crafts)
                      </span>
                      <span className="ml-auto text-sm">
                        {formatCurrency(categoryTotals.actualCost)} / {formatCurrency(categoryTotals.forecastedCost)}
                        <span className={cn("ml-2", getVarianceColor(categoryVariancePercent))}>
                          ({categoryVariancePercent > 0 ? '+' : ''}{categoryVariancePercent.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Craft Rows */}
                {expandedCategories.has(category) && crafts.map(craft => (
                  <TableRow 
                    key={craft.craftCode}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => onDrillDown?.(craft.craftCode)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <div>{craft.craftName}</div>
                        <div className="text-xs text-muted-foreground">{craft.craftCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getCategoryLabel(craft.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(craft.actualHours)}</TableCell>
                    <TableCell className="text-right">{formatNumber(craft.forecastedHours)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(craft.actualCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(craft.forecastedCost)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {craft.varianceDollars > 0 ? (
                          <TrendingUp className="h-3 w-3 text-destructive" />
                        ) : craft.varianceDollars < 0 ? (
                          <TrendingDown className="h-3 w-3 text-green-600" />
                        ) : null}
                        <span className={getVarianceColor(craft.variancePercent)}>
                          {formatCurrency(Math.abs(craft.varianceDollars))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={getVarianceColor(craft.variancePercent)}>
                        {craft.variancePercent > 0 ? '+' : ''}{craft.variancePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            )
          })}

          {/* Total Row */}
          <TableRow className="font-semibold bg-muted">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">{formatNumber(totals.actualHours)}</TableCell>
            <TableCell className="text-right">{formatNumber(totals.forecastedHours)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.actualCost)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.forecastedCost)}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {totals.varianceDollars > 0 ? (
                  <TrendingUp className="h-3 w-3 text-destructive" />
                ) : totals.varianceDollars < 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-600" />
                ) : null}
                <span className={getVarianceColor(totalVariancePercent)}>
                  {formatCurrency(Math.abs(totals.varianceDollars))}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <span className={getVarianceColor(totalVariancePercent)}>
                {totalVariancePercent > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}