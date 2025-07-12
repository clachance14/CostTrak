'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, Check, X, AlertCircle, FileText, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface ChangeOrder {
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
    division: string
  }
  createdBy: string | null
  approvedBy: string | null
}

interface UserDetails {
  id: string
  role: string
  email: string
}

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' }
}

export default function ChangeOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('project_id')
  
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setUser] = useState<User | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [projectFilter, setProjectFilter] = useState<string | null>(projectIdParam)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const supabase = createClient()

  const fetchUserAndChangeOrders = useCallback(async () => {
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

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (projectFilter) {
        params.append('project_id', projectFilter)
      }

      // Fetch change orders
      const response = await fetch(`/api/change-orders?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch change orders')
      }

      setChangeOrders(data.changeOrders)
      setTotalPages(data.pagination.totalPages)

      // If viewing a specific project, get project info
      if (projectFilter && data.changeOrders.length > 0) {
        const firstCO = data.changeOrders[0]
        if (firstCO.project) {
          setProjectInfo({
            id: firstCO.project.id,
            jobNumber: firstCO.project.jobNumber,
            name: firstCO.project.name
          })
        }
      } else {
        setProjectInfo(null)
      }
    } catch (err) {
      console.error('Error fetching change orders:', err)
      setError('Failed to load change orders')
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, projectFilter, router, supabase])

  useEffect(() => {
    fetchUserAndChangeOrders()
  }, [fetchUserAndChangeOrders])

  const handleDelete = async (id: string, coNumber: string) => {
    if (!confirm(`Are you sure you want to delete change order ${coNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/change-orders/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete change order')
      }

      // Refresh list
      fetchUserAndChangeOrders()
    } catch (err) {
      console.error('Error deleting change order:', err)
      alert('Failed to delete change order')
    }
  }

  const handleApprove = async (id: string, coNumber: string) => {
    if (!confirm(`Are you sure you want to approve change order ${coNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/change-orders/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve change order')
      }

      // Refresh list
      fetchUserAndChangeOrders()
    } catch (err) {
      console.error('Error approving change order:', err)
      alert(err instanceof Error ? err.message : 'Failed to approve change order')
    }
  }

  const handleReject = async (id: string, coNumber: string) => {
    const reason = prompt(`Please provide a reason for rejecting change order ${coNumber}:`)
    if (!reason) {
      return
    }

    try {
      const response = await fetch(`/api/change-orders/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject change order')
      }

      // Refresh list
      fetchUserAndChangeOrders()
    } catch (err) {
      console.error('Error rejecting change order:', err)
      alert('Failed to reject change order')
    }
  }

  const canCreateChangeOrder = userDetails && !['viewer', 'accounting', 'executive'].includes(userDetails.role)
  const canApproveReject = userDetails && ['controller', 'ops_manager'].includes(userDetails.role)
  const canDelete = userDetails && userDetails.role === 'controller'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading change orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        {projectInfo && (
          <div className="mb-4">
            <Link
              href={`/projects/${projectInfo.id}`}
              className="inline-flex items-center text-sm text-gray-700 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project {projectInfo.jobNumber} - {projectInfo.name}
            </Link>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Change Orders</h1>
            {projectInfo && (
              <p className="text-gray-600 mt-1">
                For Project {projectInfo.jobNumber} - {projectInfo.name}
              </p>
            )}
          </div>
          {canCreateChangeOrder && (
            <Link
              href={projectFilter ? `/change-orders/new?project_id=${projectFilter}` : "/change-orders/new"}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              New Change Order
            </Link>
          )}
        </div>

        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search by CO number or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {changeOrders.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No change orders found</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    CO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Schedule Impact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {changeOrders.map((co) => (
                  <tr key={co.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link href={`/change-orders/${co.id}`} className="text-blue-600 hover:text-blue-800">
                        {co.coNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div>
                        <div className="font-medium text-gray-900">{co.project.jobNumber}</div>
                        <div className="text-gray-700">{co.project.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {co.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(co.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {co.impactScheduleDays > 0 ? `+${co.impactScheduleDays} days` : 
                       co.impactScheduleDays < 0 ? `${co.impactScheduleDays} days` : 
                       'No impact'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusConfig[co.status].className}`}>
                        {statusConfig[co.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(co.submittedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {co.status === 'pending' && canApproveReject && (
                          <>
                            <button
                              onClick={() => handleApprove(co.id, co.coNumber)}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleReject(co.id, co.coNumber)}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        <Link
                          href={`/change-orders/${co.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="h-5 w-5" />
                        </Link>
                        {canDelete && co.status !== 'approved' && (
                          <button
                            onClick={() => handleDelete(co.id, co.coNumber)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}