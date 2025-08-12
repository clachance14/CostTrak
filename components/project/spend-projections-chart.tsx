'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, TrendingUp } from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts'
import { format, addMonths } from 'date-fns'
import { cn } from '@/lib/utils'

interface ProjectionDataPoint {
  month: string
  actual?: number
  projected: number
  upperBound?: number
  lowerBound?: number
  method: 'margin-based' | 'data-driven'
}

interface ProjectionSummary {
  totalBudget: number
  currentSpend: number
  projectedFinalCost: number
  projectedMargin: number
  projectedVariance: number
  confidenceLevel: string
}

interface SpendProjectionsChartProps {
  currentSpendPercentage: number
  projectionMethod: 'margin-based' | 'data-driven'
  baseMargin?: number
  projections: ProjectionDataPoint[]
  summary: ProjectionSummary
  transitionPoint?: {
    date: string
    spendAmount: number
    message: string
  }
  projectStartDate: string
  projectEndDate: string
}

export function SpendProjectionsChart({
  currentSpendPercentage,
  projectionMethod,
  baseMargin,
  projections,
  summary,
  transitionPoint,
  projectStartDate,
  projectEndDate
}: SpendProjectionsChartProps) {
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

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{label}</p>
          {data.actual !== undefined && (
            <p className="text-sm">
              Actual: <span className="font-medium">{formatCurrency(data.actual)}</span>
            </p>
          )}
          <p className="text-sm">
            Projected: <span className="font-medium">{formatCurrency(data.projected)}</span>
          </p>
          {data.upperBound && (
            <p className="text-xs text-muted-foreground">
              Range: {formatCurrency(data.lowerBound)} - {formatCurrency(data.upperBound)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Method: {data.method === 'margin-based' ? 'Margin-Based' : 'Data-Driven'}
          </p>
        </div>
      )
    }
    return null
  }

  // Determine confidence badge variant
  const getConfidenceBadgeVariant = () => {
    if (projectionMethod === 'margin-based') return 'secondary'
    if (summary.confidenceLevel.includes('high')) return 'success'
    if (summary.confidenceLevel.includes('medium')) return 'warning'
    return 'destructive'
  }

  // Calculate margin variance
  const marginVariance = summary.projectedMargin - (baseMargin || 15)
  const marginVarianceColor = marginVariance >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Spend Projections</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getConfidenceBadgeVariant()}>
              {summary.confidenceLevel}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {projectionMethod === 'margin-based' ? 'Margin-Based' : 'Data-Driven'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Projection Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projections} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: '#6b7280' }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Confidence bands (only for data-driven) */}
              {projectionMethod === 'data-driven' && (
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  stackId="1"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  name="Upper Bound"
                />
              )}
              
              {/* Actual spend line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Actual Spend"
              />
              
              {/* Projected spend line */}
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray={projectionMethod === 'margin-based' ? "5 5" : "0"}
                dot={{ r: 3 }}
                name="Projected Spend"
              />
              
              {/* Transition point marker */}
              {transitionPoint && (
                <ReferenceLine
                  x={transitionPoint.date}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{
                    value: "25% Threshold",
                    position: "top",
                    className: "text-xs fill-amber-600"
                  }}
                />
              )}
              
              {/* Budget line */}
              <ReferenceLine
                y={summary.totalBudget}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: "Total Budget",
                  position: "right",
                  className: "text-xs fill-red-600"
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Projection Details Panel */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Current Spend</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.currentSpend)}
              <span className="text-sm text-muted-foreground ml-2">
                ({formatPercentage(currentSpendPercentage)} of budget)
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projection Method</p>
            <p className="text-lg font-semibold">
              {projectionMethod === 'margin-based' ? 'Margin-Based' : 'Data-Driven'}
              {baseMargin && projectionMethod === 'margin-based' && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({formatPercentage(baseMargin)} margin)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected Final Cost</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.projectedFinalCost)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected Margin</p>
            <p className={cn("text-lg font-semibold", marginVarianceColor)}>
              {formatPercentage(summary.projectedMargin)}
              {marginVariance !== 0 && (
                <span className="text-sm ml-2">
                  ({marginVariance > 0 ? '+' : ''}{formatPercentage(marginVariance)})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Method Explanation */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            {projectionMethod === 'margin-based' ? (
              <>
                <p className="font-medium">Margin-Based Projection</p>
                <p className="text-xs mt-1">
                  Using {formatPercentage(baseMargin || 15)} target margin for linear projection.
                  Will switch to data-driven forecasting after 25% spend.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Data-Driven Projection</p>
                <p className="text-xs mt-1">
                  Using actual burn rate and historical patterns for projection.
                  Confidence intervals based on variance in actual data.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Transition Point Notice */}
        {transitionPoint && currentSpendPercentage < 25 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Projection Method Change</p>
              <p className="text-xs mt-1">
                {transitionPoint.message}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}