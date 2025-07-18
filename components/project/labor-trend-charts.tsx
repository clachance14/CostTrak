'use client'

import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'

interface WeeklyTrend {
  weekEnding: string
  actualCost: number
  forecastedCost: number
  actualHours: number
  forecastedHours: number
  compositeRate: number
}

interface LaborTrendChartsProps {
  weeklyTrends: WeeklyTrend[]
  budgetedCost?: number
}

export function LaborTrendCharts({ weeklyTrends, budgetedCost }: LaborTrendChartsProps) {
  // Handle empty data
  if (!weeklyTrends || weeklyTrends.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No data available yet
            </div>
          </Card>
        ))}
      </div>
    )
  }
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value)
  }

  const formatHours = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
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
      return format(new Date(dateString), 'MMM dd')
    } catch {
      return dateString
    }
  }

  // Calculate cumulative costs for burn rate
  let cumulativeActual = 0
  let cumulativeForecast = 0
  const cumulativeData = weeklyTrends.map(week => {
    cumulativeActual += week.actualCost
    cumulativeForecast += week.forecastedCost
    return {
      ...week,
      cumulativeActual,
      cumulativeForecast,
    }
  })

  // Calculate average composite rate
  const trendsWithRate = weeklyTrends.filter(w => w.compositeRate > 0)
  const avgCompositeRate = trendsWithRate.length > 0
    ? trendsWithRate.reduce((sum, week) => sum + week.compositeRate, 0) / trendsWithRate.length
    : 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">Week: {formatWeek(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{entry.value?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Cost Trend Chart */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Labor Cost Trend</h3>
            <p className="text-sm text-muted-foreground">Weekly actual vs forecast</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="weekEnding"
                  tickFormatter={formatWeek}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '0.875rem' }}
                />
                <Bar
                  dataKey="actualCost"
                  fill="#3b82f6"
                  name="Actual Cost"
                />
                <Bar
                  dataKey="forecastedCost"
                  fill="#10b981"
                  name="Forecast Cost"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Hours Trend Chart */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Labor Hours Trend</h3>
            <p className="text-sm text-muted-foreground">Weekly hours worked vs forecast</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="weekEnding"
                  tickFormatter={formatWeek}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={formatHours}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '0.875rem' }}
                />
                <Bar
                  dataKey="actualHours"
                  fill="#8b5cf6"
                  name="Actual Hours"
                />
                <Bar
                  dataKey="forecastedHours"
                  fill="#f59e0b"
                  name="Forecast Hours"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Composite Rate Trend */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Composite Labor Rate Trend</h3>
            <p className="text-sm text-muted-foreground">Average hourly rate over time</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrends.filter(w => w.compositeRate > 0)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="weekEnding"
                  tickFormatter={formatWeek}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(value) => `$${value}`}
                  className="text-xs"
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  formatter={(value: number) => formatRate(value)}
                  labelFormatter={(label) => `Week: ${formatWeek(label)}`}
                />
                <ReferenceLine
                  y={avgCompositeRate}
                  stroke="#6b7280"
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg: ${formatRate(avgCompositeRate)}`,
                    position: 'right',
                    className: 'text-xs fill-muted-foreground',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="compositeRate"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name="Composite Rate"
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Cumulative Burn Chart */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Cumulative Labor Burn</h3>
            <p className="text-sm text-muted-foreground">Total costs over project duration</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="weekEnding"
                  tickFormatter={formatWeek}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Week: ${formatWeek(label)}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: '0.875rem' }}
                  iconType="line"
                />
                {budgetedCost && (
                  <ReferenceLine
                    y={budgetedCost}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    label={{
                      value: `Budget: ${formatCurrency(budgetedCost)}`,
                      position: 'right',
                      className: 'text-xs fill-destructive',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="cumulativeActual"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Actual (Cumulative)"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeForecast"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  name="Forecast (Cumulative)"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  )
}