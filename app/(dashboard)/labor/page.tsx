'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Calculator,
  FileSpreadsheet,
  BarChart3,
  Upload as UploadIcon,
  Clock,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

interface LaborSummary {
  weeklyActualsCost: number
  weeklyActualsHours: number
  runningAvgRate: number
  activeCraftTypes: number
  lastEntryDate: string | null
  lastImportDate: string | null
  forecastedHeadcount: number
  projectedWeeklyCost: number
}

export default function LaborDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '')
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [summary, setSummary] = useState<LaborSummary | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  
  const supabase = createClient()

  const fetchProjectSummary = useCallback(async (projectId: string) => {
    try {
      // Get project info
      const project = projects.find(p => p.id === projectId)
      if (project) {
        setProjectInfo(project)
      }

      // Fetch labor summary data (using existing endpoints)
      const [actualsRes, avgRes, forecastRes] = await Promise.all([
        fetch(`/api/labor-forecasts/weekly-actuals?project_id=${projectId}`), // Removed limit to get all weeks
        fetch(`/api/labor-forecasts/running-averages?project_id=${projectId}`),
        fetch(`/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=1`)
      ])

      let weeklyActualsCost = 0
      let weeklyActualsHours = 0
      let lastEntryDate = null
      let totalCost = 0
      let totalHours = 0
      let weekCount = 0
      
      if (actualsRes.ok) {
        const actualsData = await actualsRes.json()
        if (actualsData.actuals && actualsData.actuals.length > 0) {
          // Calculate totals across all weeks
          totalCost = actualsData.actuals.reduce((sum: number, a: {
            totalCost: number;
            totalHours: number;
            weekEnding: string;
          }) => sum + a.totalCost, 0)
          totalHours = actualsData.actuals.reduce((sum: number, a: {
            totalCost: number;
            totalHours: number;
            weekEnding: string;
          }) => sum + a.totalHours, 0)
          
          // Get unique weeks count
          const uniqueWeeks = new Set(actualsData.actuals.map((a: {
            totalCost: number;
            totalHours: number;
            weekEnding: string;
          }) => a.weekEnding))
          weekCount = uniqueWeeks.size
          
          // Calculate average weekly cost
          weeklyActualsCost = weekCount > 0 ? totalCost / weekCount : 0
          weeklyActualsHours = totalHours // Keep total hours for display
          
          lastEntryDate = actualsData.actuals[0].weekEnding
        }
      }

      let runningAvgRate = 0
      let activeCraftTypes = 0
      
      // Get active craft types count from running averages
      if (avgRes.ok) {
        const avgData = await avgRes.json()
        if (avgData.averages) {
          activeCraftTypes = avgData.averages.length
        }
      }
      
      // Calculate overall average rate from total cost and hours
      if (totalHours > 0) {
        runningAvgRate = totalCost / totalHours
      }

      let forecastedHeadcount = 0
      let projectedWeeklyCost = 0
      
      if (forecastRes.ok) {
        const forecastData = await forecastRes.json()
        if (forecastData.weeks && forecastData.weeks.length > 0) {
          forecastedHeadcount = forecastData.weeks[0].totals.headcount || 0
          projectedWeeklyCost = forecastData.weeks[0].totals.forecastedCost || 0
        }
      }

      // Get last import date from audit log
      const { data: auditData } = await supabase
        .from('audit_log')
        .select('created_at')
        .eq('entity_type', 'labor_actuals')
        .eq('action', 'import')
        .eq('entity_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastImportDate = auditData?.[0]?.created_at || null

      setSummary({
        weeklyActualsCost,
        weeklyActualsHours,
        runningAvgRate,
        activeCraftTypes,
        lastEntryDate,
        lastImportDate,
        forecastedHeadcount,
        projectedWeeklyCost
      })

    } catch (error) {
      console.error('Error fetching project summary:', error)
    }
  }, [projects, supabase])

  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch projects
        const projectsResponse = await fetch('/api/projects?limit=100')
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json()
          setProjects(projectsData.projects || [])
        }

        // If project is selected, fetch summary data
        if (selectedProject) {
          await fetchProjectSummary(selectedProject)
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedProject, router, supabase, fetchProjectSummary])

  const handleProjectChange = (value: string) => {
    setSelectedProject(value)
    router.push(`/labor?project_id=${value}`)
  }

  const canEdit = userRole && ['controller', 'ops_manager', 'project_manager'].includes(userRole)

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Labor Management</h1>
            <p className="text-foreground mt-1">
              Manage labor costs, forecasts, and analytics
            </p>
          </div>
          
          {/* Project Selection */}
          <div className="w-64">
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.jobNumber} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projectInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Selected Project: <span className="font-semibold">{projectInfo.jobNumber} - {projectInfo.name}</span>
            </p>
          </div>
        )}
      </div>

      {!selectedProject ? (
        <Card className="p-8 text-center">
          <Calculator className="h-12 w-12 text-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Select a Project</h2>
          <p className="text-foreground mb-4">Choose a project from the dropdown above to view labor data and access labor management tools.</p>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Weekly Cost</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(summary.weeklyActualsCost)}
                    </p>
                    <p className="text-xs text-foreground/80 mt-1">
                      {summary.weeklyActualsHours.toFixed(0)} hours
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-foreground" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Avg Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(summary.runningAvgRate)}
                    </p>
                    <p className="text-xs text-foreground/80 mt-1">Per hour</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-foreground" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Active Crafts</p>
                    <p className="text-2xl font-bold text-foreground">
                      {summary.activeCraftTypes}
                    </p>
                    <p className="text-xs text-foreground/80 mt-1">With data</p>
                  </div>
                  <Users className="h-8 w-8 text-foreground" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Projected Weekly</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(summary.projectedWeeklyCost)}
                    </p>
                    <p className="text-xs text-foreground/80 mt-1">
                      {summary.forecastedHeadcount} headcount
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-foreground" />
                </div>
              </Card>
            </div>
          )}

          {/* Labor Modules */}
          <div className="space-y-6">
            {/* Forecasts Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Labor Forecasts</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href={`/labor/forecasts/weekly-entry?project_id=${selectedProject}`}
                  className="block"
                >
                  <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                          Enter Weekly Actuals
                        </h3>
                        <p className="text-sm text-foreground mt-1">
                          Record actual labor costs and hours by craft
                        </p>
                        {summary?.lastEntryDate && (
                          <p className="text-xs text-foreground/60 mt-2 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Last entry: {new Date(summary.lastEntryDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Calendar className="h-8 w-8 text-foreground group-hover:text-blue-600" />
                    </div>
                  </Card>
                </Link>

                <Link
                  href={`/labor/forecasts/headcount?project_id=${selectedProject}`}
                  className="block"
                >
                  <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                          Headcount Forecast
                        </h3>
                        <p className="text-sm text-foreground mt-1">
                          Plan future labor needs by headcount
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-foreground group-hover:text-blue-600" />
                    </div>
                  </Card>
                </Link>

                <Link
                  href={`/labor/analytics?project_id=${selectedProject}`}
                  className="block"
                >
                  <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                          Analytics Dashboard
                        </h3>
                        <p className="text-sm text-foreground mt-1">
                          View trends, metrics, and insights
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-foreground group-hover:text-blue-600" />
                    </div>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Import Section */}
            {canEdit && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Data Import</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    href={`/labor/import?project_id=${selectedProject}`}
                    className="block"
                  >
                    <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                            Import Labor Costs
                          </h3>
                          <p className="text-sm text-foreground mt-1">
                            Upload Excel timesheets to import weekly labor data
                          </p>
                          {summary?.lastImportDate && (
                            <p className="text-xs text-foreground/60 mt-2 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Last import: {new Date(summary.lastImportDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <UploadIcon className="h-8 w-8 text-foreground group-hover:text-blue-600" />
                      </div>
                    </Card>
                  </Link>
                  
                  <Link
                    href="/employees/import"
                    className="block"
                  >
                    <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-blue-600">
                            Import Employees
                          </h3>
                          <p className="text-sm text-foreground mt-1">
                            Upload Excel file to import employee master data
                          </p>
                          <p className="text-xs text-foreground/60 mt-2">
                            One-time setup for new projects
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-foreground group-hover:text-blue-600" />
                      </div>
                    </Card>
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <Link
                    href={`/labor/forecasts?project_id=${selectedProject}`}
                    className="flex items-center justify-between hover:text-blue-600"
                  >
                    <span className="font-medium">View All Forecasts</span>
                    <FileSpreadsheet className="h-5 w-5" />
                  </Link>
                </Card>
                
                <Card className="p-4">
                  <Link
                    href="/employees"
                    className="flex items-center justify-between hover:text-blue-600"
                  >
                    <span className="font-medium">Manage Employees</span>
                    <Users className="h-5 w-5" />
                  </Link>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}