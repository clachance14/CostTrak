'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import ChangeOrderForm from '@/components/change-orders/change-order-form'

export default function NewChangeOrderPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={projectId ? `/change-orders?project_id=${projectId}` : "/change-orders"}
          className="inline-flex items-center text-sm text-gray-700 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Change Orders
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Create Change Order</h1>
        </div>
        <div className="p-6">
          <ChangeOrderForm 
            mode="create" 
            initialData={projectId ? { project_id: projectId } : undefined}
          />
        </div>
      </div>
    </div>
  )
}