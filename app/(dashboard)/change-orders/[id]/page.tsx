'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Check, X, AlertCircle, Clock, User, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface ChangeOrderDetails {
  id: string
  projectId: string
  coNumber: string
  description: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  impactScheduleDays: number
  submittedDate: string
  approvedDate: string | null
  createdAt: string
  updatedAt: string
  project: {
    id: string
    jobNumber: string
    name: string
    originalContract: number
    revisedContract: number
    division: {
      id: string
      name: string
      code: string
    }
    client: {
      id: string
      name: string
    }
  }
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  approvedBy: {
    id: string
    name: string
    email: string
  } | null
}

interface AuditEntry {
  action: string
  changes: Record<string, unknown>
  timestamp: string
  user: string
}

interface UserDetails {
  id: string
  role: string
  email: string
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800', icon: Check },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: X },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800', icon: X }
}

export default function ChangeOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [changeOrder, setChangeOrder] = useState<ChangeOrderDetails | null>(null)
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setUser] = useState<SupabaseUser | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const supabase = createClient()

  const fetchChangeOrderDetails = useCallback(async () => {
    try {
      // Get current user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // Get user details
      const { data: userDetailsData, error: userDetailsError } = await supabase
        .from('profiles')
        .select('id, role, email')
        .eq('id', currentUser.id)
        .single()

      if (userDetailsError || !userDetailsData) {
        setError('Failed to fetch user details')
        return
      }
      setUserDetails(userDetailsData)

      // Check if user has access to change orders
      if (userDetailsData.role === 'viewer') {
        router.push('/unauthorized')
        return
      }

      // Fetch change order details
      const response = await fetch(`/api/change-orders/${params.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch change order')
      }

      setChangeOrder(data.changeOrder)
      setAuditTrail(data.auditTrail || [])
    } catch (err) {
      console.error('Error fetching change order:', err)
      setError('Failed to load change order details')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, supabase])

  useEffect(() => {
    fetchChangeOrderDetails()
  }, [fetchChangeOrderDetails])

  const handleApprove = async () => {
    if (!changeOrder || !confirm(`Are you sure you want to approve change order ${changeOrder.coNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/change-orders/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve change order')
      }

      // Refresh details
      fetchChangeOrderDetails()
    } catch (err) {
      console.error('Error approving change order:', err)
      alert(err instanceof Error ? err.message : 'Failed to approve change order')
    }
  }

  const handleReject = async () => {
    if (!changeOrder) return
    
    const reason = prompt(`Please provide a reason for rejecting change order ${changeOrder.coNumber}:`)
    if (!reason) {
      return
    }

    try {
      const response = await fetch(`/api/change-orders/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject change order')
      }

      // Refresh details
      fetchChangeOrderDetails()
    } catch (err) {
      console.error('Error rejecting change order:', err)
      alert('Failed to reject change order')
    }
  }

  const canApproveReject = userDetails && ['controller', 'ops_manager'].includes(userDetails.role)
  const canEdit = userDetails && !['viewer', 'accounting', 'executive'].includes(userDetails.role)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading change order details...</p>
        </div>
      </div>
    )
  }

  if (error || !changeOrder) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error || 'Change order not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const StatusIcon = statusConfig[changeOrder.status].icon

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/change-orders"
          className="inline-flex items-center text-sm text-gray-700 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Change Orders
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">{changeOrder.coNumber}</h1>
              <span className={`px-3 py-1 inline-flex items-center gap-1 text-sm font-semibold rounded-full ${statusConfig[changeOrder.status].className}`}>
                <StatusIcon className="h-4 w-4" />
                {statusConfig[changeOrder.status].label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {changeOrder.status === 'pending' && canApproveReject && (
                <>
                  <button
                    onClick={handleApprove}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Check className="h-5 w-5" />
                    Approve
                  </button>
                  <button
                    onClick={handleReject}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <X className="h-5 w-5" />
                    Reject
                  </button>
                </>
              )}
              {canEdit && changeOrder.status === 'pending' && (
                <Link
                  href={`/change-orders/${changeOrder.id}/edit`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit className="h-5 w-5" />
                  Edit
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Order Details</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-700">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{changeOrder.description}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Amount</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(changeOrder.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Schedule Impact</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {changeOrder.impactScheduleDays > 0 ? `+${changeOrder.impactScheduleDays} days` : 
                     changeOrder.impactScheduleDays < 0 ? `${changeOrder.impactScheduleDays} days` : 
                     'No impact'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Submitted Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(changeOrder.submittedDate)}</dd>
                </div>
                {changeOrder.approvedDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-700">Approved Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(changeOrder.approvedDate)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-700">Project</dt>
                  <dd className="mt-1">
                    <Link href={`/projects/${changeOrder.project.id}`} className="text-blue-600 hover:text-blue-800">
                      {changeOrder.project.jobNumber} - {changeOrder.project.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Client</dt>
                  <dd className="mt-1 text-sm text-gray-900">{changeOrder.project.client.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Division</dt>
                  <dd className="mt-1 text-sm text-gray-900">{changeOrder.project.division.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Original Contract</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatCurrency(changeOrder.project.originalContract)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-700">Revised Contract</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {formatCurrency(changeOrder.project.revisedContract)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {(changeOrder.createdBy || changeOrder.approvedBy) && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {changeOrder.createdBy && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Created by</p>
                      <p className="text-sm text-gray-700">{changeOrder.createdBy.name}</p>
                    </div>
                  </div>
                )}
                {changeOrder.approvedBy && (
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Approved by</p>
                      <p className="text-sm text-gray-700">{changeOrder.approvedBy.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {auditTrail.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h2>
              <div className="space-y-4">
                {auditTrail.map((entry, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{entry.user}</span> {entry.action}
                      </p>
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="mt-1 text-sm text-gray-700">
                          {Object.entries(entry.changes).map(([key, value]: [string, unknown]) => {
                            if (typeof value === 'object' && value !== null && 'from' in value) {
                              const val = value as { from: unknown; to: unknown }
                              return (
                                <div key={key}>
                                  {key}: {String(val.from)} → {String(val.to)}
                                </div>
                              )
                            }
                            return (
                              <div key={key}>
                                {key}: {JSON.stringify(value)}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(entry.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}