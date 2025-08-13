'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerDiemConfig } from '@/components/project/per-diem-config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ProjectSettingsPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const router = useRouter()
  const { id } = use(params)

  // Fetch project details
  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }
      const data = await response.json()
      return data.project
    }
  })

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600">Error loading project settings</p>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/projects/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
        <div className="flex items-center gap-3 mt-4">
          <Settings className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold">{project?.project_name || project?.name} Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure project settings and options
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="per-diem" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="per-diem">Per Diem</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="per-diem" className="space-y-4">
          <PerDiemConfig
            projectId={id}
            initialConfig={{
              per_diem_enabled: project?.per_diem_enabled || false,
              per_diem_rate_direct: project?.per_diem_rate_direct || 0,
              per_diem_rate_indirect: project?.per_diem_rate_indirect || 0,
            }}
            onConfigUpdate={() => refetch()}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure when and how you receive project notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Notification settings coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Advanced project configuration options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-2">Data Retention</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure how long to retain project data after completion
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-2">API Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage API keys and external integrations
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-2">Export Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure default export formats and templates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}