'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { changeOrderFormSchema, type ChangeOrderFormData } from '@/lib/validations/change-order'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Project {
  id: string
  job_number: string
  name: string
  division: {
    id: string
    name: string
  }
}

interface ChangeOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<ChangeOrderFormData>
  changeOrderId?: string
}

export default function ChangeOrderForm({ mode, initialData, changeOrderId }: ChangeOrderFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    resolver: zodResolver(changeOrderFormSchema),
    defaultValues: {
      project_id: '',
      co_number: '',
      description: '',
      amount: '',
      status: 'pending' as const,
      impact_schedule_days: '0',
      submitted_date: '',
      ...initialData
    }
  })

  const selectedProjectId = watch('project_id')

  const fetchProjectsAndUserRole = useCallback(async () => {
    try {
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

      // Fetch projects based on user role
      let query = supabase
        .from('projects')
        .select(`
          id,
          job_number,
          name,
          division:divisions!inner(id, name)
        `)
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('job_number')

      // Project managers can only see their projects
      if (userDetails?.role === 'project_manager') {
        query = query.eq('project_manager_id', user.id)
      }

      const { data: projectsData, error: projectsError } = await query as { 
        data: Project[] | null
        error: Error | null
      }

      if (projectsError) throw projectsError
      setProjects(projectsData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load projects')
    }
  }, [router, supabase])

  const generateCoNumber = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/change-orders?project_id=${projectId}&limit=100`)
      const data = await response.json()
      
      if (response.ok) {
        const existingNumbers = data.changeOrders
          .map((co: { coNumber: string }) => co.coNumber)
          .filter((num: string) => num.startsWith('CO-'))
          .map((num: string) => parseInt(num.replace('CO-', '')) || 0)
        
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
        setValue('co_number', `CO-${nextNumber.toString().padStart(3, '0')}`)
      }
    } catch {
      // Default to CO-001 if there's an error
      setValue('co_number', 'CO-001')
    }
  }, [setValue])

  useEffect(() => {
    fetchProjectsAndUserRole()
  }, [fetchProjectsAndUserRole])

  useEffect(() => {
    if (mode === 'create' && selectedProjectId && projects.length > 0) {
      // Auto-generate CO number for new change orders
      generateCoNumber(selectedProjectId)
    }
  }, [selectedProjectId, projects, mode, generateCoNumber])

  const onSubmit = async (data: unknown) => {
    const formData = data as ChangeOrderFormData
    setLoading(true)
    setError(null)

    try {
      // Transform form data to API format
      const apiData = {
        project_id: formData.project_id,
        co_number: formData.co_number,
        description: formData.description,
        amount: parseFloat(formData.amount),
        impact_schedule_days: parseInt(formData.impact_schedule_days || '0'),
        submitted_date: formData.submitted_date,
        status: formData.status
      }

      const url = mode === 'create' 
        ? '/api/change-orders' 
        : `/api/change-orders/${changeOrderId}`
      
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${mode} change order`)
      }

      // Redirect to detail page
      router.push(`/change-orders/${result.changeOrder.id}`)
    } catch (err) {
      console.error(`Error ${mode}ing change order:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${mode} change order`)
    } finally {
      setLoading(false)
    }
  }

  const canEditStatus = userRole && ['controller', 'ops_manager'].includes(userRole)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">
          Project *
        </label>
        <select
          {...register('project_id')}
          disabled={mode === 'edit'}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.job_number} - {project.name} ({project.division.name})
            </option>
          ))}
        </select>
        {errors.project_id && (
          <p className="mt-1 text-sm text-red-600">{errors.project_id.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="co_number" className="block text-sm font-medium text-gray-700">
          CO Number *
        </label>
        <input
          type="text"
          {...register('co_number')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="CO-001"
        />
        {errors.co_number && (
          <p className="mt-1 text-sm text-red-600">{errors.co_number.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description *
        </label>
        <textarea
          {...register('description')}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Describe the change order..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount *
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-700 sm:text-sm">$</span>
            </div>
            <input
              type="text"
              {...register('amount')}
              className="block w-full pl-7 pr-3 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="0.00"
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="impact_schedule_days" className="block text-sm font-medium text-gray-700">
            Schedule Impact (days)
          </label>
          <input
            type="number"
            {...register('impact_schedule_days')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="0"
          />
          {errors.impact_schedule_days && (
            <p className="mt-1 text-sm text-red-600">{errors.impact_schedule_days.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-700">Positive for delays, negative for acceleration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="submitted_date" className="block text-sm font-medium text-gray-700">
            Submitted Date
          </label>
          <input
            type="date"
            {...register('submitted_date')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
          {errors.submitted_date && (
            <p className="mt-1 text-sm text-red-600">{errors.submitted_date.message}</p>
          )}
        </div>

        {canEditStatus && (
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              {...register('status')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.push('/change-orders')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Change Order' : 'Update Change Order'}
        </button>
      </div>
    </form>
  )
}