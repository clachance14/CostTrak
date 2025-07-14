'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  ArrowLeft,
  Calculator,
  FileSpreadsheet,
  BarChart3
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatWeekEnding } from '@/lib/validations/labor-forecast-v2'
import { createClient } from '@/lib/supabase/client'

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

interface RunningAverage {
  craftTypeId: string
  craftName: string
  laborCategory: string
  avgRate: number
  weeksOfData: number
  lastActualWeek: string | null
}

interface RecentActual {
  weekEnding: string
  totalCost: number
  totalHours: number
  avgRate: number
}

export default function LaborForecastsMainPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [runningAverages, setRunningAverages] = useState<RunningAverage[]>([])
  const [recentActuals, setRecentActuals] = useState<RecentActual[]>([])
  const [userRole, setUserRole] = useState<string>('')
  
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        setError('No project selected')
        setLoading(false)
        return
      }

      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/login')
          return
        }

        // Get user role
        const { data: userDetails } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (userDetails) {
          setUserRole(userDetails.role)
        }

        // Fetch running averages
        const avgResponse = await fetch(`/api/labor-forecasts/running-averages?project_id=${projectId}`)
        if (!avgResponse.ok) {
          throw new Error('Failed to fetch running averages')
        }
        const avgData = await avgResponse.json()
        
        setProjectInfo(avgData.project)
        setRunningAverages(avgData.averages)

        // Fetch recent actuals for summary
        const actualsResponse = await fetch(
          `/api/labor-forecasts/weekly-actuals?project_id=${projectId}`
        )
        if (!actualsResponse.ok) {
          throw new Error('Failed to fetch recent actuals')
        }
        const actualsData = await actualsResponse.json()
        
        // Group by week for summary
        const weekMap = new Map<string, RecentActual>()
        actualsData.actuals.forEach((actual: { weekEnding: string; actualCost: number; actualHours: number }) => {
          const week = actual.weekEnding
          if (!weekMap.has(week)) {
            weekMap.set(week, {
              weekEnding: week,
              totalCost: 0,
              totalHours: 0,
              avgRate: 0
            })
          }
          const weekData = weekMap.get(week)!
          weekData.totalCost += actual.actualCost
          weekData.totalHours += actual.actualHours
        })
        
        // Calculate average rates
        weekMap.forEach(week => {
          week.avgRate = week.totalHours > 0 ? week.totalCost / week.totalHours : 0
        })
        
        setRecentActuals(Array.from(weekMap.values()).sort((a, b) => 
          new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
        ).slice(0, 4))
        
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, router, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!projectId || !projectInfo) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a project to view labor forecasts.</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            Go to Projects
          </Link>
        </div>
      </div>
    )
  }

  const canEdit = ['controller', 'ops_manager', 'project_manager'].includes(userRole)

  // Calculate summary stats
  const totalCraftTypes = runningAverages.length
  const craftTypesWithData = runningAverages.filter(a => a.weeksOfData > 0).length
  const avgWeightedRate = runningAverages.reduce((sum, avg) => {
    return sum + (avg.avgRate * avg.weeksOfData)
  }, 0) / Math.max(runningAverages.reduce((sum, avg) => sum + avg.weeksOfData, 0), 1)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground/80 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Project
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Labor Forecasts</h1>
            <p className="text-foreground mt-1">
              Project {projectInfo.jobNumber} - {projectInfo.name}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      {canEdit && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href={`/labor-forecasts/weekly-entry?project_id=${projectId}`}
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                  Enter Weekly Actuals
                </h3>
                <p className="text-sm text-foreground mt-1">
                  Record actual costs and hours
                </p>
              </div>
              <Calendar className="h-8 w-8 text-foreground group-hover:text-blue-600" />
            </div>
          </Link>

          <Link
            href={`/labor-forecasts/forecast?project_id=${projectId}`}
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                  Headcount Forecast
                </h3>
                <p className="text-sm text-foreground mt-1">
                  Plan future labor needs
                </p>
              </div>
              <Users className="h-8 w-8 text-foreground group-hover:text-blue-600" />
            </div>
          </Link>

          <Link
            href={`/labor-forecasts/analytics?project_id=${projectId}`}
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                  Analytics Dashboard
                </h3>
                <p className="text-sm text-foreground mt-1">
                  View trends and insights
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-foreground group-hover:text-blue-600" />
            </div>
          </Link>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Craft Types</p>
              <p className="text-2xl font-bold text-foreground">
                {craftTypesWithData} / {totalCraftTypes}
              </p>
              <p className="text-xs text-foreground/80 mt-1">With data</p>
            </div>
            <FileSpreadsheet className="h-8 w-8 text-foreground" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Avg Rate</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(avgWeightedRate)}
              </p>
              <p className="text-xs text-foreground/80 mt-1">Per hour</p>
            </div>
            <DollarSign className="h-8 w-8 text-foreground" />
          </div>
        </div>

        {recentActuals.length > 0 && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Last Week Cost</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(recentActuals[0].totalCost)}
                  </p>
                  <p className="text-xs text-foreground/80 mt-1">
                    {recentActuals[0].totalHours.toFixed(0)} hours
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-foreground" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">4-Week Avg</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(
                      recentActuals.reduce((sum, w) => sum + w.totalCost, 0) / recentActuals.length
                    )}
                  </p>
                  <p className="text-xs text-foreground/80 mt-1">Per week</p>
                </div>
                <Calculator className="h-8 w-8 text-foreground" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-8">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">Recent Weekly Actuals</h2>
        </div>
        <div className="p-6">
          {recentActuals.length > 0 ? (
            <div className="space-y-4">
              {recentActuals.map(week => (
                <div key={week.weekEnding} className="flex items-center justify-between py-3 border-b last:border-b-0">
                  <div>
                    <p className="font-medium text-foreground">
                      Week ending {formatWeekEnding(new Date(week.weekEnding))}
                    </p>
                    <p className="text-sm text-foreground">
                      {week.totalHours.toFixed(1)} hours @ ${week.avgRate.toFixed(2)}/hr
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(week.totalCost)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/80 text-center py-8">
              No weekly actuals recorded yet.
              {canEdit && (
                <Link
                  href={`/labor-forecasts/weekly-entry?project_id=${projectId}`}
                  className="block mt-2 text-blue-600 hover:text-blue-800"
                >
                  Enter your first week
                </Link>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Running Averages by Category */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">Running Average Rates by Craft</h2>
          <p className="text-sm text-foreground mt-1">Based on last 8 weeks of data</p>
        </div>
        <div className="p-6">
          {['direct', 'indirect', 'staff'].map(category => {
            const categoryAverages = runningAverages.filter(a => a.laborCategory === category)
            if (categoryAverages.length === 0) return null

            return (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-medium text-foreground/80 mb-3 capitalize">
                  {category} Labor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryAverages.map(avg => (
                    <div key={avg.craftTypeId} className="border rounded-lg p-4">
                      <p className="font-medium text-foreground">{avg.craftName}</p>
                      {avg.weeksOfData > 0 ? (
                        <>
                          <p className="text-xl font-semibold text-foreground mt-1">
                            {formatCurrency(avg.avgRate)}/hr
                          </p>
                          <p className="text-xs text-foreground/80 mt-1">
                            {avg.weeksOfData} weeks of data
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-foreground/80 mt-1">No data yet</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}