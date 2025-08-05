'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChangeOrderForm } from '@/components/change-orders/change-order-form'
import { toast } from '@/hooks/use-toast'

interface NewChangeOrderPageProps {
  params: Promise<{ id: string }>
}

export default function NewChangeOrderPage({ params }: NewChangeOrderPageProps) {
  const router = useRouter()
  const { id: projectId } = use(params)

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      return data.project
    }
  })

  // Create change order mutation
  const createMutation = useMutation({
    mutationFn: async (data: Parameters<typeof handleSubmit>[0]) => {
      const response = await fetch('/api/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          project_id: projectId,
          status: 'pending'
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create change order')
      }
      
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Change order created successfully.'
      })
      router.push(`/projects/${projectId}/overview`)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create change order.',
        variant: 'destructive'
      })
    }
  })

  const handleSubmit = async (data: {
    co_number: string
    description: string
    pricing_type: 'LS' | 'T&M' | 'Estimate' | 'Credit'
    impact_schedule_days: number
    submitted_date: string
    labor_amount: number
    manhours: number
    equipment_amount: number
    material_amount: number
    subcontract_amount: number
    markup_amount: number
    tax_amount: number
    amount: number
  }) => {
    await createMutation.mutateAsync(data)
  }

  const handleCancel = () => {
    router.push(`/projects/${projectId}/overview`)
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading project details...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/projects/${projectId}/overview`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Create Change Order</h1>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <ChangeOrderForm
            projectId={projectId}
            projectName={project?.name}
            jobNumber={project?.job_number}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending}
            mode="create"
          />
        </div>
      </div>
    </div>
  )
}