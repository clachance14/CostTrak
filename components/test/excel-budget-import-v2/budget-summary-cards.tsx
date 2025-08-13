'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, FileText, CircleAlert, CircleCheck2, Users, Hammer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetSummaryCardsProps {
  totals: {
    labor: number
    material: number
    equipment: number
    subcontract: number
    other: number
    grand_total: number
  }
  stats: {
    sheetsProcessed: number
    totalItems: number
    wbsCodesFound: number
    totalBudget: number
    disciplinesIncluded: string[]
    phaseAllocations: number
    directLaborAllocations: number
    validationStatus: string
  }
  validationResult?: {
    isValid: boolean
    summary: {
      totalErrors: number
      totalWarnings: number
    }
  }
}

export function BudgetSummaryCards({ totals, stats, validationResult }: BudgetSummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%'
    return `${((value / total) * 100).toFixed(1)}%`
  }

  const categoryData = [
    { 
      name: 'Labor', 
      value: totals.labor, 
      icon: Users, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950'
    },
    { 
      name: 'Materials', 
      value: totals.material, 
      icon: FileText, 
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950'
    },
    { 
      name: 'Equipment', 
      value: totals.equipment, 
      icon: Hammer, 
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950'
    },
    { 
      name: 'Subcontracts', 
      value: totals.subcontract, 
      icon: FileText, 
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950'
    },
  ]

  return (
    <div className="space-y-4">
      {/* Grand Total and Validation Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.grand_total)}</div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.totalItems} line items across {stats.sheetsProcessed} sheets
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validation Status</CardTitle>
            {validationResult?.isValid ? (
              <CircleCheck2 className="h-4 w-4 text-green-600" />
            ) : (
              <CircleAlert className="h-4 w-4 text-amber-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge 
                variant={validationResult?.isValid ? "default" : "secondary"}
                className={cn(
                  validationResult?.isValid 
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                )}
              >
                {stats.validationStatus}
              </Badge>
            </div>
            {validationResult && (
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-red-600 dark:text-red-400">
                  {validationResult.summary.totalErrors} errors
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {validationResult.summary.totalWarnings} warnings
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categoryData.map((category) => (
          <Card key={category.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
              <div className={cn("p-2 rounded-md", category.bgColor)}>
                <category.icon className={cn("h-4 w-4", category.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(category.value)}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage(category.value, totals.grand_total)} of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">WBS Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.wbsCodesFound}</div>
            <p className="text-xs text-muted-foreground">5-level hierarchy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disciplines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.disciplinesIncluded.length}</div>
            <p className="text-xs text-muted-foreground">from BUDGETS sheet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Phase Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.phaseAllocations}</div>
            <p className="text-xs text-muted-foreground">4 phases × 23 roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Direct Labor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.directLaborAllocations}</div>
            <p className="text-xs text-muted-foreground">39 categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Other Costs if significant */}
      {totals.other > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Other Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">{formatCurrency(totals.other)}</span>
              <Badge variant="outline">
                {formatPercentage(totals.other, totals.grand_total)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}