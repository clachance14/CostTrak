'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CircleCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LaborKPICardsProps {
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
}

export function LaborKPICards({ kpis }: LaborKPICardsProps) {
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

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4" />
    if (variance < 0) return <TrendingDown className="h-4 w-4" />
    return <CircleCheck className="h-4 w-4" />
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-destructive'
    if (variance < 0) return 'text-green-600'
    return 'text-muted-foreground'
  }

  const getBurnRateStatus = () => {
    const burnDiff = kpis.laborBurnPercent - kpis.projectCompletionPercent
    if (burnDiff > 10) return { color: 'destructive', text: 'Over Budget' }
    if (burnDiff > 5) return { color: 'warning', text: 'At Risk' }
    if (burnDiff < -5) return { color: 'success', text: 'Under Budget' }
    return { color: 'default', text: 'On Track' }
  }

  const burnStatus = getBurnRateStatus()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Actual Cost */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-primary/10 rounded">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <Badge variant={kpis.varianceDollars > 0 ? 'destructive' : 'success'}>
            {kpis.variancePercent > 0 ? '+' : ''}{kpis.variancePercent.toFixed(1)}%
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Actual Labor Cost</p>
          <p className="text-2xl font-bold">{formatCurrency(kpis.totalActualCost)}</p>
          <p className="text-xs text-muted-foreground">
            Budget: {formatCurrency(kpis.totalBudgetedCost)}
          </p>
          <div className={cn("flex items-center gap-1 text-xs", getVarianceColor(kpis.varianceDollars))}>
            {getVarianceIcon(kpis.varianceDollars)}
            <span>{formatCurrency(Math.abs(kpis.varianceDollars))}</span>
          </div>
        </div>
      </Card>

      {/* Forecasted Cost (EAC) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-blue-100 rounded">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Forecasted Labor Cost (EAC)</p>
          <p className="text-2xl font-bold">{formatCurrency(kpis.totalForecastedCost)}</p>
          <p className="text-xs text-muted-foreground">
            Variance to Budget: {formatCurrency(kpis.totalForecastedCost - kpis.totalBudgetedCost)}
          </p>
        </div>
      </Card>

      {/* Total Hours */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-orange-100 rounded">
            <Clock className="h-4 w-4 text-orange-600" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Labor Hours</p>
          <p className="text-2xl font-bold">{formatNumber(kpis.totalActualHours)}</p>
          <p className="text-xs text-muted-foreground">
            Forecast: {formatNumber(kpis.totalForecastedHours)} hrs
          </p>
          <div className="text-xs text-muted-foreground">
            {((kpis.totalActualHours / kpis.totalForecastedHours) * 100).toFixed(1)}% of forecast
          </div>
        </div>
      </Card>

      {/* Composite Rate */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-purple-100 rounded">
            <DollarSign className="h-4 w-4 text-purple-600" />
          </div>
          {kpis.averageActualRate > kpis.averageForecastRate && (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Average Labor Rate</p>
          <p className="text-2xl font-bold">{formatRate(kpis.averageActualRate)}/hr</p>
          <p className="text-xs text-muted-foreground">
            Forecast: {formatRate(kpis.averageForecastRate)}/hr
          </p>
          <div className={cn(
            "text-xs",
            kpis.averageActualRate > kpis.averageForecastRate ? 'text-destructive' : 'text-green-600'
          )}>
            {kpis.averageActualRate > kpis.averageForecastRate ? '+' : ''}
            {formatRate(kpis.averageActualRate - kpis.averageForecastRate)}/hr
          </div>
        </div>
      </Card>

      {/* Labor Burn Status Bar */}
      <Card className="p-6 md:col-span-2 lg:col-span-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Labor Burn Status</h3>
              <p className="text-sm text-muted-foreground">
                Labor burn: {kpis.laborBurnPercent.toFixed(1)}% of budget, 
                Project: {kpis.projectCompletionPercent.toFixed(1)}% complete
              </p>
            </div>
            <Badge variant={burnStatus.color as any}>
              {burnStatus.text}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Labor Budget Used</span>
              <span>{kpis.laborBurnPercent.toFixed(1)}%</span>
            </div>
            <Progress value={kpis.laborBurnPercent} className="h-2" />
            
            <div className="flex justify-between text-sm mt-2">
              <span>Project Completion</span>
              <span>{kpis.projectCompletionPercent.toFixed(1)}%</span>
            </div>
            <Progress value={kpis.projectCompletionPercent} className="h-2 bg-blue-100">
              <div 
                className="h-full bg-blue-600 transition-all" 
                style={{ width: `${kpis.projectCompletionPercent}%` }}
              />
            </Progress>
          </div>
        </div>
      </Card>
    </div>
  )
}