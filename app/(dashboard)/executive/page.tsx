'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Building, 
  DollarSign, 
  TrendingUp, 
  Users,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { DivisionBreakdown } from '@/components/dashboard/division-breakdown'
import { TopProjects } from '@/components/dashboard/top-projects'
import { StatusDistribution } from '@/components/dashboard/status-distribution'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'

interface DashboardData {
  overview: {
    activeProjects: number
    totalBacklog: number
    averageMargin: number
    recentCommittedCosts: number
    lastUpdated: string
  }
  divisionBreakdown: Array<{
    name: string
    projectCount: number
    totalValue: number
  }>
  statusDistribution: Record<string, number>
  topProjects: Array<{
    id: string
    jobNumber: string
    name: string
    value: number
    status: string
    projectManager: string
  }>
  financialSnapshot: Record<string, unknown> | null
}

export default function ExecutiveDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboards/company')
      
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/unauthorized')
          return
        }
        throw new Error('Failed to fetch dashboard data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load dashboard data'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-gray-700">
          Company-wide performance overview
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value={data.overview.activeProjects}
          description="Currently in progress"
          icon={Building}
        />
        <MetricCard
          title="Total Backlog"
          value={formatCurrency(data.overview.totalBacklog)}
          description="Active project value"
          icon={DollarSign}
        />
        <MetricCard
          title="Average Margin"
          value={`${data.overview.averageMargin}%`}
          description="Across all projects"
          icon={TrendingUp}
          trend={{
            value: 2.5,
            isPositive: true
          }}
        />
        <MetricCard
          title="Recent Commitments"
          value={formatCurrency(data.overview.recentCommittedCosts)}
          description="Last 30 days"
          icon={Users}
        />
      </div>

      {/* Division Breakdown and Status Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <DivisionBreakdown data={data.divisionBreakdown} />
        <StatusDistribution data={data.statusDistribution} />
      </div>

      {/* Top Projects */}
      <TopProjects projects={data.topProjects} />

      {/* Last Updated */}
      <div className="text-sm text-gray-700 text-right">
        Last updated: {new Date(data.overview.lastUpdated).toLocaleString()}
      </div>
    </div>
  )
}