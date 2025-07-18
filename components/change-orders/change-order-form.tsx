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
      project_id: initialData?.project_id || '',
      co_number: initialData?.co_number || '',
      description: initialData?.description || '',
      amount: initialData?.amount || '',
      status: initialData?.status || 'pending' as const,
      pricing_type: initialData?.pricing_type || 'LS' as const,
      impact_schedule_days: initialData?.impact_schedule_days || '0',
      submitted_date: initialData?.submitted_date || new Date().toISOString().split('T')[0],
      reason: initialData?.reason || '',
      manhours: initialData?.manhours || '0',
      labor_amount: initialData?.labor_amount || '0',
      equipment_amount: initialData?.equipment_amount || '0',
      material_amount: initialData?.material_amount || '0',
      subcontract_amount: initialData?.subcontract_amount || '0',
      markup_amount: initialData?.markup_amount || '0',
      tax_amount: initialData?.tax_amount || '0'
    }
  })

  const selectedProjectId = watch('project_id')
  const laborAmount = watch('labor_amount')
  const equipmentAmount = watch('equipment_amount')
  const materialAmount = watch('material_amount')
  const subcontractAmount = watch('subcontract_amount')
  const markupAmount = watch('markup_amount')
  const taxAmount = watch('tax_amount')
  const pricingType = watch('pricing_type')
  const amount = watch('amount')

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

  // Calculate total from breakdown amounts
  useEffect(() => {
    const amounts = [
      laborAmount,
      equipmentAmount,
      materialAmount,
      subcontractAmount,
      markupAmount,
      taxAmount
    ]
    
    const hasBreakdown = amounts.some(amt => amt && parseFloat(amt) > 0)
    
    if (hasBreakdown) {
      const total = amounts.reduce((sum, amt) => {
        const value = parseFloat(amt || '0')
        return sum + (isNaN(value) ? 0 : value)
      }, 0)
      
      setValue('amount', total.toFixed(2))
    }
  }, [laborAmount, equipmentAmount, materialAmount, subcontractAmount, markupAmount, taxAmount, setValue])

  const onSubmit = async (formData: ChangeOrderFormData) => {
    console.log('Form submission data:', formData)
    setLoading(true)
    setError(null)

    try {
      // Log the data being sent
      console.log('Submitting form data:', formData)
      // Transform form data to API format
      const apiData = {
        project_id: formData.project_id,
        co_number: formData.co_number,
        description: formData.description,
        amount: parseFloat(formData.amount),
        impact_schedule_days: parseInt(formData.impact_schedule_days || '0'),
        submitted_date: formData.submitted_date,
        status: formData.status,
        pricing_type: formData.pricing_type,
        reason: formData.reason || undefined,
        manhours: parseFloat(formData.manhours || '0'),
        labor_amount: parseFloat(formData.labor_amount || '0'),
        equipment_amount: parseFloat(formData.equipment_amount || '0'),
        material_amount: parseFloat(formData.material_amount || '0'),
        subcontract_amount: parseFloat(formData.subcontract_amount || '0'),
        markup_amount: parseFloat(formData.markup_amount || '0'),
        tax_amount: parseFloat(formData.tax_amount || '0')
      }

      const url = mode === 'create' 
        ? '/api/change-orders' 
        : `/api/change-orders/${changeOrderId}`
      
      const method = mode === 'create' ? 'POST' : 'PATCH'

      console.log('API data to send:', apiData)
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      })

      const result = await response.json()
      console.log('API response:', result)

      if (!response.ok) {
        console.error('API error response:', result)
        
        // Handle validation errors with more detail
        if (result.details && Array.isArray(result.details)) {
          // This is a Zod validation error
          const errorMessages = result.details.map((detail: { path?: string[]; message: string }) => {
            const field = detail.path?.join('.') || 'Field'
            return `${field}: ${detail.message}`
          }).join(', ')
          throw new Error(`Validation failed: ${errorMessages}`)
        } else if (result.error) {
          // Regular error message
          throw new Error(result.error)
        } else {
          throw new Error(`Failed to ${mode} change order`)
        }
      }

      // Redirect to project overview Change Orders tab
      router.push(`/projects/${result.changeOrder.projectId}/overview?tab=change-orders`)
    } catch (err) {
      console.error(`Error ${mode}ing change order:`, err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(`Failed to ${mode} change order`)
      }
    } finally {
      setLoading(false)
    }
  }

  const canEditStatus = userRole && ['controller', 'ops_manager'].includes(userRole)

  return (
    <form onSubmit={handleSubmit(onSubmit, (errors) => {
      console.error('Form validation errors:', errors)
      // Log detailed validation errors for debugging
      Object.entries(errors).forEach(([field, error]) => {
        console.error(`Field '${field}' error:`, error)
      })
      setError('Please fix the validation errors below')
    })} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="project_id" className="block text-sm font-medium text-foreground/80">
          Project *
        </label>
        <select
          {...register('project_id')}
          disabled={mode === 'edit'}
          className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-foreground/5"
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
        <label htmlFor="co_number" className="block text-sm font-medium text-foreground/80">
          CO Number *
        </label>
        <input
          type="text"
          {...register('co_number')}
          className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="CO-001"
        />
        {errors.co_number && (
          <p className="mt-1 text-sm text-red-600">{errors.co_number.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">Format: CO-001, CO-002, etc.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="pricing_type" className="block text-sm font-medium text-foreground/80">
            Pricing Type *
          </label>
          <select
            {...register('pricing_type')}
            className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="LS">Lump Sum (LS)</option>
            <option value="T&M">Time & Materials (T&M)</option>
            <option value="Estimate">Estimate</option>
            <option value="Credit">Credit</option>
          </select>
          {errors.pricing_type && (
            <p className="mt-1 text-sm text-red-600">{errors.pricing_type.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="manhours" className="block text-sm font-medium text-foreground/80">
            Manhours
          </label>
          <input
            type="number"
            {...register('manhours')}
            className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="0"
            step="0.5"
          />
          {errors.manhours && (
            <p className="mt-1 text-sm text-red-600">{errors.manhours.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground/80">
          Description of Work *
        </label>
        <textarea
          {...register('description')}
          rows={4}
          className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Describe the change order work..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-foreground/80">
          Reason/Justification
        </label>
        <textarea
          {...register('reason')}
          rows={3}
          className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Explain the reason for this change order..."
        />
        {errors.reason && (
          <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-foreground/80">
            Amount *
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-foreground/80 sm:text-sm">$</span>
            </div>
            <input
              type="text"
              {...register('amount')}
              className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="0.00"
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
          )}
          {!errors.amount && amount === '0' && pricingType !== 'Credit' && (
            <p className="mt-1 text-sm text-amber-600">Warning: Amount cannot be zero unless pricing type is Credit</p>
          )}
          {!errors.amount && amount === '0' && pricingType === 'Credit' && (
            <p className="mt-1 text-sm text-green-600">Zero amount is allowed for Credit type change orders</p>
          )}
        </div>

        <div>
          <label htmlFor="impact_schedule_days" className="block text-sm font-medium text-foreground/80">
            Schedule Impact (days)
          </label>
          <input
            type="number"
            {...register('impact_schedule_days')}
            className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="0"
          />
          {errors.impact_schedule_days && (
            <p className="mt-1 text-sm text-red-600">{errors.impact_schedule_days.message}</p>
          )}
          <p className="mt-1 text-xs text-foreground/80">Positive for delays, negative for acceleration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="submitted_date" className="block text-sm font-medium text-foreground/80">
            Submitted Date
          </label>
          <input
            type="date"
            {...register('submitted_date')}
            className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
          {errors.submitted_date && (
            <p className="mt-1 text-sm text-red-600">{errors.submitted_date.message}</p>
          )}
        </div>

        {canEditStatus && (
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-foreground/80">
              Status
            </label>
            <select
              {...register('status')}
              className="mt-1 block w-full rounded-md border-foreground/30 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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

      {/* Cost Breakdown Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-foreground/90 mb-4">Cost Breakdown (Optional)</h3>
        <p className="text-sm text-foreground/70 mb-4">
          Enter individual cost components below. The total will be calculated automatically.
        </p>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="labor_amount" className="block text-sm font-medium text-foreground/80">
              Labor
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('labor_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.labor_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.labor_amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="material_amount" className="block text-sm font-medium text-foreground/80">
              Materials
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('material_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.material_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.material_amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="equipment_amount" className="block text-sm font-medium text-foreground/80">
              Equipment
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('equipment_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.equipment_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.equipment_amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="subcontract_amount" className="block text-sm font-medium text-foreground/80">
              Subcontractor
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('subcontract_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.subcontract_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.subcontract_amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="markup_amount" className="block text-sm font-medium text-foreground/80">
              Markup/Overhead
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('markup_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.markup_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.markup_amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="tax_amount" className="block text-sm font-medium text-foreground/80">
              Tax
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-foreground/80 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                {...register('tax_amount')}
                className="block w-full pl-7 pr-3 rounded-md border-foreground/30 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.tax_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.tax_amount.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.push('/change-orders')}
          className="px-4 py-2 border border-foreground/30 rounded-md shadow-sm text-sm font-medium text-foreground/80 bg-white hover:bg-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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