'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChangeOrderTable } from '@/components/change-orders/change-order-table'
import { toast } from '@/hooks/use-toast'

interface ChangeOrdersTabProps {
  projectId: string
  projectData?: {
    original_contract?: number
    revised_contract?: number
  }
}

export function ChangeOrdersTab({ projectId, projectData }: ChangeOrdersTabProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch change orders for this project
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['change-orders', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/change-orders?project_id=${projectId}&limit=100`)
      if (!response.ok) throw new Error('Failed to fetch change orders')
      return response.json()
    }
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (coId: string) => {
      const response = await fetch(`/api/change-orders/${coId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      })
      if (!response.ok) throw new Error('Failed to approve change order')
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Change order approved',
        description: 'The change order has been approved successfully.'
      })
      refetch()
      queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to approve change order. Please try again.',
        variant: 'destructive'
      })
      console.error('Approve error:', error)
    }
  })

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: async (coId: string) => {
      const response = await fetch(`/api/change-orders/${coId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      })
      if (!response.ok) throw new Error('Failed to deny change order')
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Change order denied',
        description: 'The change order has been denied and soft deleted.'
      })
      refetch()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to deny change order. Please try again.',
        variant: 'destructive'
      })
      console.error('Deny error:', error)
    }
  })

  const changeOrders = data?.change_orders || []
  
  // Debug logging
  console.log('Change orders data:', data)
  console.log('Change orders array:', changeOrders)
  
  // Calculate summary data
  const totalChangeOrders = changeOrders.length
  const approvedAmount = changeOrders
    .filter((co: any) => co.status === 'approved')
    .reduce((sum: number, co: any) => sum + (co.amount || 0), 0)
  const submittedAmount = changeOrders
    .filter((co: any) => co.status === 'pending')
    .reduce((sum: number, co: any) => sum + (co.amount || 0), 0)
  const deniedAmount = changeOrders
    .filter((co: any) => co.status === 'rejected')
    .reduce((sum: number, co: any) => sum + (co.amount || 0), 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const handleNewChangeOrder = () => {
    router.push(`/projects/${projectId}/change-orders/new`)
  }

  const handleApprove = async (coId: string) => {
    setIsProcessing(true)
    try {
      await approveMutation.mutateAsync(coId)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeny = async (coId: string) => {
    setIsProcessing(true)
    try {
      await denyMutation.mutateAsync(coId)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Change Orders Summary</h3>
        <Button onClick={handleNewChangeOrder} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Change Order
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total COs</p>
              <p className="text-2xl font-bold">{totalChangeOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(approvedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(submittedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Denied</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(deniedAmount)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Orders Table */}
      <div className="space-y-4">
        <ChangeOrderTable
          changeOrders={changeOrders}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onRefresh={refetch}
          showProject={false}
          projectId={projectId}
          isLoading={isLoading || isProcessing}
        />
      </div>

      {/* Financial Impact Summary */}
      {projectData && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-4">Financial Impact</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Original Contract:</span>
                <span className="font-medium">{formatCurrency(projectData.original_contract || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Approved Changes:</span>
                <span className="font-medium text-green-600">
                  {approvedAmount >= 0 ? '+' : ''}{formatCurrency(approvedAmount)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Revised Contract:</span>
                <span className="font-bold text-lg">
                  {formatCurrency((projectData.original_contract || 0) + approvedAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}