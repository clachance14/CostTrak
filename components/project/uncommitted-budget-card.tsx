'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DollarSign, TrendingDown, AlertTriangle, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetCategory {
  category: string
  budget: number
  committed: number
  uncommitted: number
  percentage: number
  expectedSpend: number
}

interface UncommittedBudgetCardProps {
  totalBudget: number
  totalCommitted: number
  baseMarginPercentage: number
  projectCompletionPercentage: number
  spendPercentage: number
  categories: BudgetCategory[]
}

export function UncommittedBudgetCard({
  totalBudget,
  totalCommitted,
  baseMarginPercentage,
  projectCompletionPercentage,
  spendPercentage,
  categories
}: UncommittedBudgetCardProps) {
  const uncommitted = totalBudget - totalCommitted
  const uncommittedPercentage = (uncommitted / totalBudget) * 100
  const expectedTotalSpend = totalBudget * (1 - baseMarginPercentage / 100)
  const projectedMargin = ((totalBudget - totalCommitted) / totalBudget) * 100
  
  // Determine margin health based on current commitments
  const getMarginHealth = () => {
    const marginDiff = projectedMargin - baseMarginPercentage
    if (marginDiff < -5) return { status: 'critical', color: 'destructive', icon: AlertTriangle }
    if (marginDiff < -2) return { status: 'at-risk', color: 'warning', icon: TrendingDown }
    return { status: 'on-target', color: 'success', icon: CircleCheck }
  }
  
  // Color coding based on project phase and uncommitted percentage
  const getUncommittedStatus = () => {
    if (spendPercentage < 25) {
      // Early stage - using margin-based expectations
      if (uncommittedPercentage < baseMarginPercentage - 5) return 'destructive'
      if (uncommittedPercentage < baseMarginPercentage) return 'warning'
      return 'success'
    } else {
      // Later stage - more aggressive thresholds
      if (projectCompletionPercentage > 20 && uncommittedPercentage < 10) return 'destructive'
      if (projectCompletionPercentage > 20 && uncommittedPercentage < 30) return 'warning'
      return 'default'
    }
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }
  
  const marginHealth = getMarginHealth()
  const uncommittedStatus = getUncommittedStatus()
  
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Uncommitted Budget</CardTitle>
          <Badge variant={marginHealth.color as any} className="flex items-center gap-1">
            <marginHealth.icon className="h-3 w-3" />
            Margin {marginHealth.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Uncommitted</p>
            <p className="text-2xl font-bold">{formatCurrency(uncommitted)}</p>
            <Badge 
              variant={uncommittedStatus as any}
              className="mt-1"
            >
              {formatPercentage(uncommittedPercentage)} of budget
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Final Margin</p>
            <p className="text-2xl font-bold">{formatPercentage(projectedMargin)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {formatPercentage(baseMarginPercentage)}
            </p>
          </div>
        </div>
        
        {/* Progress bar showing commitment status */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Budget Committed</span>
            <span>{formatCurrency(totalCommitted)} / {formatCurrency(totalBudget)}</span>
          </div>
          <div className="relative">
            <Progress 
              value={(totalCommitted / totalBudget) * 100} 
              className="h-8"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-white drop-shadow">
                {formatPercentage((totalCommitted / totalBudget) * 100)} Committed
              </span>
            </div>
          </div>
        </div>
        
        {/* Category breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">By Category</p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => {
              const categoryStatus = category.committed > category.expectedSpend 
                ? 'destructive' 
                : category.committed > category.expectedSpend * 0.9 
                  ? 'warning' 
                  : 'default'
              
              return (
                <div key={category.category} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <p className="text-xs font-medium">{category.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(category.uncommitted)} uncommitted
                    </p>
                  </div>
                  <Badge variant={categoryStatus as any} className="text-xs">
                    {formatPercentage(category.percentage)}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Phase indicator */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Projection Method: {spendPercentage < 25 ? 'Margin-Based' : 'Data-Driven'}
          </span>
          <span className="text-xs text-muted-foreground">
            Project {formatPercentage(spendPercentage)} Spent
          </span>
        </div>
      </CardContent>
    </Card>
  )
}