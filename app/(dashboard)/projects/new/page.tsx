'use client'

import { useRouter } from 'next/navigation'
import { ProjectForm } from '@/components/forms/project-form'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectFormData } from '@/types/api'

export default function NewProjectPage() {
  const router = useRouter()

  const handleSubmit = async (data: ProjectFormData) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.error === 'Job number already exists') {
          alert('This job number already exists. Please use a different job number.')
        } else {
          alert(error.error || 'Failed to create project')
        }
        return
      }

      const { project } = await response.json()
      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      alert('An error occurred while creating the project')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Create New Project</h1>
        <p className="text-gray-600 mt-1">Fill in the details to create a new project</p>
      </div>

      <ProjectForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/projects')}
      />
    </div>
  )
}