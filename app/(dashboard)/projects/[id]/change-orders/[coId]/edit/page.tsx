'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChangeOrderForm } from '@/components/change-orders/change-order-form'
import { ChangeOrderStatusBadge } from '@/components/change-orders/change-order-status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'

interface EditChangeOrderPageProps {
  params: Promise<{ id: string; coId: string }>
}

export default function EditChangeOrderPage({ params }: EditChangeOrderPageProps) {
  const router = useRouter()
  const { id: projectId, coId } = use(params)

  // Fetch change order details
  const { data: changeOrderData, isLoading: coLoading } = useQuery({
    queryKey: ['change-order', coId],
    queryFn: async () => {
      const response = await fetch(`/api/change-orders/${coId}`)
      if (!response.ok) throw new Error('Failed to fetch change order')
      const data = await response.json()
      return data.change_order
    }
  })

  // Update change order mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<{
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
    }>) => {
      const response = await fetch(`/api/change-orders/${coId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update change order')
      }
      
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Change order updated successfully.'
      })
      router.push(`/projects/${projectId}/overview`)
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update change order.',
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
    // Remove fields that shouldn't be updated
    const { co_number: _, ...updateData } = data
    await updateMutation.mutateAsync(updateData)
  }

  const handleCancel = () => {
    router.push(`/projects/${projectId}/overview`)
  }

  if (coLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading change order...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!changeOrderData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <Alert>
            <AlertDescription>Change order not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // Check if the change order can be edited
  const canEdit = changeOrderData.status === 'pending'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/projects/${projectId}/overview`)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Edit Change Order</h1>
                <p className="text-gray-600">{changeOrderData.co_number}</p>
              </div>
            </div>
            <ChangeOrderStatusBadge status={changeOrderData.status} />
          </div>
        </div>

        {/* Form or Read-only View */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {!canEdit && (
            <Alert className="mb-6">
              <AlertDescription>
                This change order has been {changeOrderData.status} and cannot be edited.
              </AlertDescription>
            </Alert>
          )}

          {canEdit ? (
            <ChangeOrderForm
              projectId={projectId}
              projectName={changeOrderData.project?.name}
              jobNumber={changeOrderData.project?.job_number}
              initialData={{
                co_number: changeOrderData.co_number,
                description: changeOrderData.description,
                pricing_type: changeOrderData.pricing_type,
                impact_schedule_days: changeOrderData.impact_schedule_days || 0,
                submitted_date: changeOrderData.submitted_date,
                labor_amount: changeOrderData.labor_amount || 0,
                manhours: changeOrderData.manhours || 0,
                equipment_amount: changeOrderData.equipment_amount || 0,
                material_amount: changeOrderData.material_amount || 0,
                subcontract_amount: changeOrderData.subcontract_amount || 0,
                markup_amount: changeOrderData.markup_amount || 0,
                tax_amount: changeOrderData.tax_amount || 0,
                notes: changeOrderData.notes || '',
              }}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={updateMutation.isPending}
              mode="edit"
            />
          ) : (
            <div className="space-y-6">
              {/* Read-only view */}
              <div>
                <h3 className="text-lg font-medium mb-4">Change Order Details</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-600">CO Number</dt>
                    <dd className="font-medium">{changeOrderData.co_number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Status</dt>
                    <dd><ChangeOrderStatusBadge status={changeOrderData.status} /></dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-600">Description</dt>
                    <dd className="font-medium">{changeOrderData.description}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Amount</dt>
                    <dd className="font-medium">
                      ${changeOrderData.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Pricing Type</dt>
                    <dd className="font-medium">{changeOrderData.pricing_type}</dd>
                  </div>
                  {changeOrderData.approved_date && (
                    <div>
                      <dt className="text-sm text-gray-600">Approved Date</dt>
                      <dd className="font-medium">
                        {new Date(changeOrderData.approved_date).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {changeOrderData.approved_by_user && (
                    <div>
                      <dt className="text-sm text-gray-600">Approved By</dt>
                      <dd className="font-medium">
                        {changeOrderData.approved_by_user.first_name} {changeOrderData.approved_by_user.last_name}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleCancel}>Back to Project</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}