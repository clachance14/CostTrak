'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'
import type { Project, Client, Division, User, ProjectFormData as ProjectFormDataType } from '@/types/api'

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  job_number: z.string().min(1, 'Job number is required').max(50),
  client_id: z.string().uuid('Please select a client'),
  division_id: z.string().uuid('Please select a division'),
  project_manager_id: z.string().uuid('Please select a project manager'),
  original_contract: z.string().min(1, 'Contract amount is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip_code: z.string().max(10).optional(),
  description: z.string().optional()
})

type ProjectFormData = z.infer<typeof projectSchema>

interface ProjectFormProps {
  project?: Project
  onSubmit: (data: ProjectFormDataType) => Promise<void>
  onCancel: () => void
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: project ? {
      ...project,
      original_contract: project.original_contract.toString(),
      start_date: format(new Date(project.start_date), 'yyyy-MM-dd'),
      end_date: format(new Date(project.end_date), 'yyyy-MM-dd')
    } : {
      status: 'planning' as const
    }
  })

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients')
      if (!response.ok) return []
      const data = await response.json()
      return data.clients || []
    }
  })

  // Fetch divisions
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const response = await fetch('/api/divisions')
      if (!response.ok) return []
      const data = await response.json()
      return data.divisions || []
    }
  })

  // Fetch users (project managers)
  const { data: users } = useQuery({
    queryKey: ['users', 'project_manager'],
    queryFn: async () => {
      const response = await fetch('/api/users?role=project_manager')
      if (!response.ok) return []
      const data = await response.json()
      return data.users || []
    }
  })

  const onFormSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true)
    try {
      // Transform data for API
      const apiData: ProjectFormDataType = {
        ...data,
        original_contract: parseFloat(data.original_contract.toString()),
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString()
      }
      await onSubmit(apiData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <Input
              {...register('name')}
              placeholder="Enter project name"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Number *
            </label>
            <Input
              {...register('job_number')}
              placeholder="Enter job number"
              disabled={!!project}
            />
            {errors.job_number && (
              <p className="text-red-500 text-sm mt-1">{errors.job_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client *
            </label>
            <select
              {...register('client_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!project}
            >
              <option value="">Select a client</option>
              {clients?.map((client: Client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {errors.client_id && (
              <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Division *
            </label>
            <select
              {...register('division_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!project}
            >
              <option value="">Select a division</option>
              {divisions?.map((division: Division) => (
                <option key={division.id} value={division.id}>
                  {division.name} ({division.code})
                </option>
              ))}
            </select>
            {errors.division_id && (
              <p className="text-red-500 text-sm mt-1">{errors.division_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Manager *
            </label>
            <select
              {...register('project_manager_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project manager</option>
              {users?.map((user: User) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
            {errors.project_manager_id && (
              <p className="text-red-500 text-sm mt-1">{errors.project_manager_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {errors.status && (
              <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Contract & Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Original Contract Amount *
            </label>
            <Input
              {...register('original_contract')}
              type="number"
              step="0.01"
              placeholder="0.00"
            />
            {errors.original_contract && (
              <p className="text-red-500 text-sm mt-1">{errors.original_contract.message}</p>
            )}
          </div>

          <div>
            {/* Empty column for layout */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <Input
              {...register('start_date')}
              type="date"
            />
            {errors.start_date && (
              <p className="text-red-500 text-sm mt-1">{errors.start_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <Input
              {...register('end_date')}
              type="date"
            />
            {errors.end_date && (
              <p className="text-red-500 text-sm mt-1">{errors.end_date.message}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <Input
              {...register('address')}
              placeholder="Enter street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <Input
              {...register('city')}
              placeholder="Enter city"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <Input
                {...register('state')}
                placeholder="XX"
                maxLength={2}
              />
              {errors.state && (
                <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <Input
                {...register('zip_code')}
                placeholder="00000"
                maxLength={10}
              />
              {errors.zip_code && (
                <p className="text-red-500 text-sm mt-1">{errors.zip_code.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter project description"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}