'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Users, Calendar, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface PerDiemCost {
  id: string
  employee_id: string
  work_date: string
  employee_type: 'Direct' | 'Indirect'
  rate_applied: number
  days_worked: number
  amount: number
  employee?: {
    first_name: string
    last_name: string
    employee_number: string
  }
}

interface PerDiemTrend {
  period: string
  directAmount: number
  indirectAmount: number
  totalAmount: number
  employeeCount: number
}

interface LaborPerDiemSectionProps {
  projectId: string
  refreshTrigger?: number
}

export function LaborPerDiemSection({ projectId, refreshTrigger }: LaborPerDiemSectionProps) {
  const [loading, setLoading] = useState(true)
  const [perDiemCosts, setPerDiemCosts] = useState<PerDiemCost[]>([])
  const [trends, setTrends] = useState<PerDiemTrend[]>([])
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    fetchPerDiemData()
  }, [projectId, refreshTrigger])

  const fetchPerDiemData = async () => {
    setLoading(true)
    try {
      // Fetch summary
      const summaryRes = await fetch(`/api/projects/${projectId}/per-diem`)
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json()
        setSummary(summaryData)
      }

      // Fetch detailed costs
      const costsRes = await fetch(`/api/projects/${projectId}/per-diem?view=costs`)
      if (costsRes.ok) {
        const costsData = await costsRes.json()
        setPerDiemCosts(costsData.costs || [])
      }

      // Fetch trends
      const trendsRes = await fetch(`/api/projects/${projectId}/per-diem?view=trends&groupBy=week`)
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json()
        setTrends(trendsData.trends || [])
      }
    } catch (error) {
      console.error('Failed to fetch per diem data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!perDiemCosts.length) return

    const headers = ['Week Ending', 'Employee', 'Type', 'Days', 'Rate', 'Amount']
    const rows = perDiemCosts.map(cost => [
      cost.work_date,
      cost.employee ? `${cost.employee.last_name}, ${cost.employee.first_name}` : cost.employee_id,
      cost.employee_type,
      cost.days_worked,
      cost.rate_applied,
      cost.amount,
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `per-diem-${projectId}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (!summary?.per_diem_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Per Diem Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Per diem is not enabled for this project</p>
            <p className="text-sm text-muted-foreground mt-2">
              Enable per diem in project settings to track daily allowances
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Per Diem Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group costs by week for the table
  const costsByWeek = perDiemCosts.reduce((acc, cost) => {
    const week = cost.work_date
    if (!acc[week]) {
      acc[week] = {
        direct: { count: 0, amount: 0 },
        indirect: { count: 0, amount: 0 },
        total: 0,
      }
    }
    if (cost.employee_type === 'Direct') {
      acc[week].direct.count++
      acc[week].direct.amount += cost.amount
    } else {
      acc[week].indirect.count++
      acc[week].indirect.amount += cost.amount
    }
    acc[week].total += cost.amount
    return acc
  }, {} as Record<string, any>)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Per Diem</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_per_diem_amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all pay periods
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Labor</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_direct_per_diem || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${summary?.per_diem_rate_direct || 0}/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indirect/Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_indirect_per_diem || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${summary?.per_diem_rate_indirect || 0}/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.unique_employees || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.days_with_per_diem || 0} weeks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Per Diem Trends</CardTitle>
              <Button onClick={exportToCSV} size="sm" variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                />
                <Legend />
                <Bar dataKey="directAmount" name="Direct" fill="#3b82f6" stackId="a" />
                <Bar dataKey="indirectAmount" name="Indirect" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Per Diem Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week Ending</TableHead>
                <TableHead className="text-center">Direct</TableHead>
                <TableHead className="text-center">Indirect</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(costsByWeek)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([week, data]) => (
                  <TableRow key={week}>
                    <TableCell>
                      {format(new Date(week), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <div className="font-medium">
                          {formatCurrency(data.direct.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.direct.count} employees
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <div className="font-medium">
                          {formatCurrency(data.indirect.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.indirect.count} employees
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(data.total)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}