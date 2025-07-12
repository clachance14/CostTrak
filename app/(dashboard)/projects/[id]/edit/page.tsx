'use client'

import { use } from 'react'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ProjectForm } from '@/components/forms/project-form'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectFormData } from '@/types/api'

interface EditProjectPageProps {
  params: Promise<{ id: string }>
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const router = useRouter()
  const { id } = use(params)

  // Fetch project details
  const { data: project, isLoading, error } = useQuery({
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

  const handleSubmit = async (data: ProjectFormData) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to update project')
        return
      }

      router.push(`/projects/${id}`)
    } catch (error) {
      console.error('Error updating project:', error)
      alert('An error occurred while updating the project')
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600">Error loading project</p>
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
        <div className="text-center">
          <p className="text-gray-700">Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/projects/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Edit Project</h1>
        <p className="text-gray-600 mt-1">Update project details</p>
      </div>

      <ProjectForm
        project={project}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/projects/${id}`)}
      />
    </div>
  )
}