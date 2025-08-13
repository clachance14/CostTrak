'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface PerDiemSummaryData {
  total_per_diem_amount: number
  total_direct_per_diem: number
  total_indirect_per_diem: number
  unique_employees: number
  days_with_per_diem: number
  per_diem_enabled: boolean
  per_diem_rate_direct: number
  per_diem_rate_indirect: number
  last_per_diem_date?: string
  first_per_diem_date?: string
}

interface PerDiemSummaryCardProps {
  projectId: string
  className?: string
}

export function PerDiemSummaryCard({ projectId, className }: PerDiemSummaryCardProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerDiemSummaryData | null>(null)

  useEffect(() => {
    fetchPerDiemSummary()
  }, [projectId])

  const fetchPerDiemSummary = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/per-diem`)
      if (response.ok) {
        const summary = await response.json()
        setData(summary)
      }
    } catch (error) {
      console.error('Failed to fetch per diem summary:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Per Diem Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.per_diem_enabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Per Diem Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Per diem not enabled</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure per diem rates in project settings
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const directPercentage = data.total_per_diem_amount > 0
    ? (data.total_direct_per_diem / data.total_per_diem_amount * 100).toFixed(1)
    : '0'

  const indirectPercentage = data.total_per_diem_amount > 0
    ? (data.total_indirect_per_diem / data.total_per_diem_amount * 100).toFixed(1)
    : '0'

  // Calculate date range
  const dateRange = data.first_per_diem_date && data.last_per_diem_date
    ? `${new Date(data.first_per_diem_date).toLocaleDateString()} - ${new Date(data.last_per_diem_date).toLocaleDateString()}`
    : 'No data'

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Per Diem Costs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Amount */}
          <div>
            <p className="text-3xl font-bold">
              {formatCurrency(data.total_per_diem_amount)}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Total per diem costs
            </p>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Direct Labor</span>
              <div className="text-right">
                <span className="text-sm font-medium">
                  {formatCurrency(data.total_direct_per_diem)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({directPercentage}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Indirect/Staff</span>
              <div className="text-right">
                <span className="text-sm font-medium">
                  {formatCurrency(data.total_indirect_per_diem)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({indirectPercentage}%)
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="bg-blue-500"
                style={{ width: `${directPercentage}%` }}
              />
              <div
                className="bg-green-500"
                style={{ width: `${indirectPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-blue-500">Direct</span>
              <span className="text-green-500">Indirect/Staff</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{data.unique_employees}</p>
                <p className="text-xs text-muted-foreground">Employees</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{data.days_with_per_diem}</p>
                <p className="text-xs text-muted-foreground">Weeks</p>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Period: {dateRange}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Rates: Direct ${data.per_diem_rate_direct}/day • Indirect ${data.per_diem_rate_indirect}/day
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}