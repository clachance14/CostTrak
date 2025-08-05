'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, AlertTriangle, Calendar, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatWeekEnding } from '@/lib/validations/labor-forecast'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface LaborForecast {
  id: string
  projectId: string
  craftTypeId: string
  weekEnding: string
  forecastedHours: number
  forecastedRate: number
  forecastedCost: number
  actualHours: number
  actualCost: number
  createdAt: string
  updatedAt: string
  project: {
    id: string
    jobNumber: string
    name: string
    division: string
  }
  craftType: {
    id: string
    name: string
    code: string
    category: string
  }
  createdBy: string | null
  variance: {
    hours: {
      amount: number
      percentage: number
      exceeds_threshold: boolean
    }
    cost: {
      amount: number
      percentage: number
      exceeds_threshold: boolean
    }
    exceedsThreshold: boolean
  }
}

interface UserDetails {
  id: string
  role: string
  email: string
}

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

const categoryColors: Record<string, string> = {
  mechanical: 'bg-blue-100 text-blue-800',
  electrical: 'bg-yellow-100 text-yellow-800',
  civil: 'bg-green-100 text-green-800',
  instrumentation: 'bg-purple-100 text-purple-800',
  other: 'bg-foreground/5 text-foreground'
}

export default function LaborForecastsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('project_id')
  
  const [laborForecasts, setLaborForecasts] = useState<LaborForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setUser] = useState<User | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [weekFilter, setWeekFilter] = useState<string>('')
  const [varianceOnly, setVarianceOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [projectFilter] = useState<string | null>(projectIdParam)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const supabase = createClient()

  const fetchUserAndForecasts = useCallback(async () => {
    try {
      // Get current user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // Get user details
      const { data: userDetailsData, error: userDetailsError } = await supabase
        .from('profiles')
        .select('id, role, email')
        .eq('id', currentUser.id)
        .single()

      if (userDetailsError || !userDetailsData) {
        setError('Failed to fetch user details')
        return
      }
      setUserDetails(userDetailsData)

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })

      if (projectFilter) {
        params.append('project_id', projectFilter)
      }

      if (weekFilter) {
        params.append('week_start', weekFilter)
        params.append('week_end', weekFilter)
      }

      if (varianceOnly) {
        params.append('has_variance', 'true')
      }

      // Fetch labor forecasts
      const response = await fetch(`/api/labor-forecasts?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch labor forecasts')
      }

      setLaborForecasts(data.laborForecasts)
      setTotalPages(data.pagination.totalPages)

      // If viewing a specific project, get project info
      if (projectFilter && data.laborForecasts.length > 0) {
        const firstForecast = data.laborForecasts[0]
        if (firstForecast.project) {
          setProjectInfo({
            id: firstForecast.project.id,
            jobNumber: firstForecast.project.jobNumber,
            name: firstForecast.project.name
          })
        }
      } else {
        setProjectInfo(null)
      }
    } catch (err) {
      console.error('Error fetching labor forecasts:', err)
      setError('Failed to load labor forecasts')
    } finally {
      setLoading(false)
    }
  }, [currentPage, weekFilter, varianceOnly, projectFilter, router, supabase])

  useEffect(() => {
    fetchUserAndForecasts()
  }, [fetchUserAndForecasts])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this labor forecast?')) {
      return
    }

    try {
      const response = await fetch(`/api/labor-forecasts/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete labor forecast')
      }

      // Refresh list
      fetchUserAndForecasts()
    } catch (err) {
      console.error('Error deleting labor forecast:', err)
      alert('Failed to delete labor forecast')
    }
  }

  const canCreateForecast = userDetails && userDetails.role === 'project_manager'
  const canDelete = userDetails && userDetails.role === 'project_manager'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading labor forecasts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        {projectInfo && (
          <div className="mb-4">
            <Link
              href={`/projects/${projectInfo.id}`}
              className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project {projectInfo.jobNumber} - {projectInfo.name}
            </Link>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Labor Forecasts</h1>
            {projectInfo && (
              <p className="text-foreground mt-1">
                For Project {projectInfo.jobNumber} - {projectInfo.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canCreateForecast && (
              <>
                <Link
                  href={projectFilter ? `/labor-forecasts/weekly?project_id=${projectFilter}` : "/labor-forecasts/weekly"}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Calendar className="h-5 w-5" />
                  Weekly Entry
                </Link>
                <Link
                  href={projectFilter ? `/labor-forecasts/new?project_id=${projectFilter}` : "/labor-forecasts/new"}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  New Forecast
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <input
            type="week"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="px-4 py-2 border border-foreground/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Filter by week"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={varianceOnly}
              onChange={(e) => setVarianceOnly(e.target.checked)}
              className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-foreground/80">Show variance alerts only</span>
          </label>
        </div>
      </div>

      {laborForecasts.length === 0 ? (
        <div className="bg-background rounded-lg p-8 text-center">
          <Calendar className="h-12 w-12 text-foreground mx-auto mb-4" />
          <p className="text-foreground">No labor forecasts found</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Craft Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Forecast
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {laborForecasts.map((forecast) => (
                  <tr key={forecast.id} className="hover:bg-background">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      <Link href={`/labor-forecasts/${forecast.id}`} className="text-blue-600 hover:text-blue-800">
                        {formatWeekEnding(new Date(forecast.weekEnding))}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                      <div>
                        <div className="font-medium text-foreground">{forecast.project.jobNumber}</div>
                        <div className="text-foreground/80">{forecast.project.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[forecast.craftType.category] || categoryColors.other}`}>
                          {forecast.craftType.category}
                        </span>
                        <span>{forecast.craftType.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div>
                        <div>{forecast.forecastedHours.toFixed(1)} hrs @ ${forecast.forecastedRate.toFixed(2)}</div>
                        <div className="text-foreground/80">{formatCurrency(forecast.forecastedCost)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div>
                        <div>{forecast.actualHours.toFixed(1)} hrs</div>
                        <div className="text-foreground/80">{formatCurrency(forecast.actualCost)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {forecast.variance.exceedsThreshold ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <div>
                            <div>{forecast.variance.hours.percentage.toFixed(1)}% hrs</div>
                            <div className="text-xs">{forecast.variance.cost.percentage.toFixed(1)}% cost</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-foreground/80">
                          <div>{forecast.variance.hours.percentage.toFixed(1)}% hrs</div>
                          <div className="text-xs">{forecast.variance.cost.percentage.toFixed(1)}% cost</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/labor-forecasts/${forecast.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="h-5 w-5" />
                        </Link>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(forecast.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-foreground/80">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-foreground/30 rounded-md text-sm font-medium text-foreground/80 bg-white hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-foreground/30 rounded-md text-sm font-medium text-foreground/80 bg-white hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}