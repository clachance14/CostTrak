'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import ChangeOrderForm from '@/components/change-orders/change-order-form'
import { createClient } from '@/lib/supabase/client'
import type { ChangeOrderFormData } from '@/lib/validations/change-order'

interface EditChangeOrderPageProps {
  params: Promise<{ id: string }>
}

export default function EditChangeOrderPage({ params }: EditChangeOrderPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialData, setInitialData] = useState<ChangeOrderFormData | null>(null)
  const supabase = createClient()

  const fetchChangeOrder = useCallback(async () => {
    try {
      // Check authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }

      // Fetch change order details
      const response = await fetch(`/api/change-orders/${id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch change order')
      }

      // Check if change order can be edited
      if (['approved', 'cancelled'].includes(data.changeOrder.status)) {
        setError(`Cannot edit ${data.changeOrder.status} change orders`)
        return
      }

      // Transform API data to form data
      const formData: ChangeOrderFormData = {
        project_id: data.changeOrder.projectId,
        co_number: data.changeOrder.coNumber,
        description: data.changeOrder.description,
        amount: data.changeOrder.amount.toString(),
        impact_schedule_days: data.changeOrder.impactScheduleDays.toString(),
        submitted_date: data.changeOrder.submittedDate?.split('T')[0] || '',
        status: data.changeOrder.status
      }

      setInitialData(formData)
    } catch (err) {
      console.error('Error fetching change order:', err)
      setError(err instanceof Error ? err.message : 'Failed to load change order')
    } finally {
      setLoading(false)
    }
  }, [id, router, supabase])

  useEffect(() => {
    fetchChangeOrder()
  }, [fetchChangeOrder])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading change order...</p>
        </div>
      </div>
    )
  }

  if (error || !initialData) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <Link
            href="/change-orders"
            className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground/80"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Change Orders
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error || 'Change order not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/change-orders/${id}`}
          className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground/80"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Change Order Details
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-foreground/20">
          <h1 className="text-2xl font-bold text-foreground">Edit Change Order</h1>
        </div>
        <div className="p-6">
          <ChangeOrderForm 
            mode="edit" 
            initialData={initialData} 
            changeOrderId={id}
          />
        </div>
      </div>
    </div>
  )
}