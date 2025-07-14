'use client'

import { useEffect, useState } from 'react'
import { 
  Building,
  Calendar,
  Users,
  Loader2,
  AlertCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ViewerProject {
  id: string
  jobNumber: string
  name: string
  status: string
  client: { name: string }
  division: { name: string }
  projectManager: { name: string; email: string } | null
  startDate: string
  endDate: string
  description?: string
  address?: string
  city?: string
  state?: string
  revisedContract: number
  percentComplete: number
}

export default function ViewerDashboard() {
  const [projects, setProjects] = useState<ViewerProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchViewerProjects()
  }, [])

  const fetchViewerProjects = async () => {
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      // Get projects viewer has access to
      const { data: accessData, error: accessError } = await supabase
        .from('project_viewer_access')
        .select('project_id')
        .eq('user_id', user.id)

      if (accessError) throw accessError

      if (!accessData || accessData.length === 0) {
        setProjects([])
        setLoading(false)
        return
      }

      const projectIds = accessData.map(a => a.project_id)

      // Fetch project details for each accessible project
      const projectPromises = projectIds.map(async (projectId) => {
        const response = await fetch(`/api/dashboards/project/${projectId}`)
        if (!response.ok) throw new Error('Failed to fetch project data')
        const result = await response.json()
        return result.data
      })

      const projectsData = await Promise.all(projectPromises)

      // Transform data for viewer display (limited information)
      const viewerProjects: ViewerProject[] = projectsData.map(data => ({
        id: data.project.id,
        jobNumber: data.project.jobNumber,
        name: data.project.name,
        status: data.project.status,
        client: { name: data.project.client.name },
        division: { name: data.project.division.name },
        projectManager: data.project.projectManager ? {
          name: data.project.projectManager.name,
          email: data.project.projectManager.email
        } : null,
        startDate: data.project.startDate,
        endDate: data.project.endDate,
        description: data.project.description,
        address: data.project.address,
        city: data.project.city,
        state: data.project.state,
        revisedContract: data.financialSummary.revisedContract,
        percentComplete: data.financialSummary.percentComplete
      }))

      setProjects(viewerProjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Viewer Dashboard</h1>
          <p className="text-foreground/80">Project overview</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have access to any projects yet. Please contact your administrator to request access to specific projects.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Viewer Dashboard</h1>
        <p className="text-foreground/80">
          You have read-only access to {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Project Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{project.jobNumber}</CardTitle>
                  <CardDescription className="mt-1">{project.name}</CardDescription>
                </div>
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client & Division */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-foreground/80" />
                  <span className="font-medium">Client:</span>
                  <span>{project.client.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-foreground/80" />
                  <span className="font-medium">Division:</span>
                  <span>{project.division.name}</span>
                </div>
              </div>

              {/* Project Manager */}
              {project.projectManager && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-foreground/80" />
                    <span className="font-medium">Project Manager:</span>
                  </div>
                  <div className="ml-6">
                    <div>{project.projectManager.name}</div>
                    <div className="text-foreground/80">{project.projectManager.email}</div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-foreground/80" />
                  <span className="font-medium">Timeline:</span>
                </div>
                <div className="ml-6">
                  <div>{formatDate(project.startDate)} - {formatDate(project.endDate)}</div>
                </div>
              </div>

              {/* Location */}
              {project.address && (
                <div className="text-sm">
                  <span className="font-medium">Location:</span>
                  <div className="text-foreground/80 mt-1">
                    {project.address}
                    {project.city && project.state && (
                      <div>{project.city}, {project.state}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Basic Metrics */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Contract Value:</span>
                  <span>{formatCurrency(project.revisedContract)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Progress:</span>
                  <span>{project.percentComplete.toFixed(1)}%</span>
                </div>
              </div>

              {/* View Details Link */}
              <div className="pt-4">
                <Link href={`/projects/${project.id}`} className="text-sm text-primary hover:underline">
                  View Project Details →
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          As a viewer, you have read-only access to these projects. Contact the project manager or your administrator if you need additional access or have questions about a project.
        </AlertDescription>
      </Alert>
    </div>
  )
}