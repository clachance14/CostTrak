'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { POLogTable } from '@/components/purchase-orders/po-log-table'

interface PurchaseOrder {
  id: string
  po_number: string
  created_at: string
  vendor_name: string
  category?: string
  total_amount: number
  status: 'draft' | 'pending' | 'approved' | 'rejected'
}

interface VendorBreakdown {
  name: string
  value: number
  color: string
}

interface CategoryBreakdown {
  name: string
  value: number
  budget: number
  percentage: number
  remaining: number
  status: 'normal' | 'warning' | 'over'
  label: string
  budgetLabel: string
}

interface CategorySummary {
  totalBudget: number
  totalSpent: number
  totalRemaining: number
  percentageUsed: number
}

interface WeeklyTrend {
  week: string
  value: number
}

interface PurchaseOrdersTabProps {
  projectId: string
  purchaseOrders: PurchaseOrder[]
  totalPOValue: number
  monthlyPOValue: number
  monthlyTrend: number
  topVendor: { name: string; value: number }
  vendorBreakdown: VendorBreakdown[]
  categoryBreakdown: CategoryBreakdown[]
  categorySummary?: CategorySummary
  weeklyTrend: WeeklyTrend[]
}

export function PurchaseOrdersTab({
  projectId,
  purchaseOrders,
  totalPOValue,
  monthlyPOValue,
  monthlyTrend,
  topVendor,
  vendorBreakdown,
  categoryBreakdown,
  categorySummary,
  weeklyTrend,
}: PurchaseOrdersTabProps) {
  const [animatedValues, setAnimatedValues] = useState<Record<number, boolean>>({})
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Animate bars on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const newAnimatedValues: Record<number, boolean> = {}
      categoryBreakdown.forEach((_, index) => {
        newAnimatedValues[index] = true
      })
      setAnimatedValues(newAnimatedValues)
    }, 100)

    return () => clearTimeout(timer)
  }, [categoryBreakdown])

  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Custom X-axis tick component for better label handling
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const maxChars = 12
    const value = payload.value as string
    
    // Handle abbreviations directly in the component
    let displayValue = value
    if (value.includes('ST&C')) {
      displayValue = 'ST&C'
    }
    
    // Split long labels into multiple lines
    const words = displayValue.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxChars) {
        currentLine = currentLine ? currentLine + ' ' + word : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)
    
    // For single line labels, just return simple text
    if (lines.length === 1) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={16}
            textAnchor="middle"
            className="fill-gray-600 text-xs"
          >
            {lines[0]}
          </text>
        </g>
      )
    }
    
    // For multi-line labels
    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, index) => (
          <text
            key={index}
            x={0}
            y={0}
            dy={16 + index * 14}
            textAnchor="middle"
            className="fill-gray-600 text-xs"
          >
            {line}
          </text>
        ))}
      </g>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PO Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPOValue)}</div>
            <p className="text-xs text-gray-500">{purchaseOrders.length} Purchase Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            {monthlyTrend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyPOValue)}</div>
            <p className={`text-xs ${monthlyTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthlyTrend > 0 ? '+' : ''}{monthlyTrend}% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{topVendor.name}</div>
            <p className="text-xs text-gray-500">{formatCurrency(topVendor.value)} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">PO Breakdown by Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={vendorBreakdown} 
                    cx="50%" 
                    cy="50%" 
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100} 
                    fill="#8884d8" 
                    dataKey="value"
                  >
                    {vendorBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {vendorBreakdown.slice(0, 4).map((vendor, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: vendor.color }} />
                  <span className="text-xs text-gray-600 truncate">{vendor.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">PO Breakdown by Category</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Track spending against budgeted amounts for each category</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {categoryBreakdown.map((category, index) => {
                const isHovered = hoveredIndex === index
                const isAnimated = animatedValues[index]
                
                // Determine bar color based on status
                let barColorClass = 'bg-blue-500'
                let barGradientClass = 'from-blue-500 to-blue-600'
                if (category.status === 'warning') {
                  barColorClass = 'bg-amber-500'
                  barGradientClass = 'from-amber-500 to-amber-600'
                } else if (category.status === 'over') {
                  barColorClass = 'bg-red-500'
                  barGradientClass = 'from-red-500 to-red-600'
                }
                
                return (
                  <div 
                    key={index} 
                    className="space-y-2"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Header with category name and budget */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 min-w-[180px]">
                        {category.name}
                      </span>
                      <span className="text-sm text-gray-500 ml-4">
                        Budget: {category.budgetLabel}
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="relative w-full">
                      <div className="w-full bg-gray-100 rounded-md h-8 overflow-hidden">
                        <div
                          className={`
                            ${barColorClass} h-full rounded-md transition-all duration-700 ease-out relative
                            ${isHovered ? 'shadow-lg' : ''}
                          `}
                          style={{ 
                            width: isAnimated ? `${Math.min(category.percentage, 100)}%` : '0%',
                            transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)'
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-r ${barGradientClass} rounded-md`} />
                          
                          {/* Subtle shine effect on hover */}
                          {isHovered && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 rounded-md" />
                          )}
                        </div>
                      </div>
                      
                      {/* Percentage and amount label */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {category.label} / {category.percentage.toFixed(1)}%
                        </span>
                        {category.status === 'warning' && (
                          <span className="text-xs text-amber-600 flex items-center">
                            ⚠️ Warning: {category.percentage.toFixed(0)}% used
                          </span>
                        )}
                        {category.status === 'over' && (
                          <span className="text-xs text-red-600 flex items-center">
                            🚫 Over budget by {formatCurrency(Math.abs(category.remaining))}
                          </span>
                        )}
                      </div>
                      
                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-10">
                          <div className="space-y-1">
                            <div>{category.name}</div>
                            <div>Spent: {category.label} of {category.budgetLabel}</div>
                            <div>Remaining: {formatCurrency(Math.max(0, category.remaining))}</div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Summary Section */}
            {categorySummary && (
              <>
                <div className="border-t border-gray-200 mt-8 pt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total Budget</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(categorySummary.totalBudget)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total Spent</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(categorySummary.totalSpent)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(categorySummary.totalRemaining)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({(100 - categorySummary.percentageUsed).toFixed(0)}%)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="border-t border-gray-200 mt-6 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Legend</p>
                  <div className="flex items-center space-x-6 text-xs text-gray-600">
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-blue-500 rounded mr-1"></span>
                      Spent
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-gray-200 rounded mr-1"></span>
                      Remaining
                    </span>
                    <span className="flex items-center">
                      ⚠️ &gt;80% Used
                    </span>
                    <span className="flex items-center">
                      🚫 Over Budget
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Weekly PO Trend (Last 12 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <XAxis 
                  dataKey="week" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis hide />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* PO Log Table with Forecasting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Purchase Orders Log</CardTitle>
        </CardHeader>
        <CardContent>
          <POLogTable 
            purchaseOrders={purchaseOrders}
            projectId={projectId}
          />
        </CardContent>
      </Card>
    </div>
  )
}