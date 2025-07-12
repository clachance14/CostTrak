'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  FileText, 
  DollarSign, 
  Calendar,
  Building,
  User,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'

interface PODetailPageProps {
  params: Promise<{ id: string }>
}

export default function PurchaseOrderDetailPage({ params }: PODetailPageProps) {
  const router = useRouter()
  const { id } = use(params)

  // Fetch PO details
  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const response = await fetch(`/api/purchase-orders/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch purchase order')
      }
      const data = await response.json()
      return data.purchase_order
    }
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Purchase Order</h2>
          <p className="text-gray-600 mb-4">Unable to load purchase order details.</p>
          <Button
            variant="outline"
            onClick={() => router.push('/purchase-orders')}
          >
            Back to Purchase Orders
          </Button>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-700">Loading purchase order...</p>
        </div>
      </div>
    )
  }

  if (!po) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Purchase Order Not Found</h2>
          <Button
            variant="outline"
            onClick={() => router.push('/purchase-orders')}
            className="mt-4"
          >
            Back to Purchase Orders
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/purchase-orders')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PO #{po.po_number}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                {po.status.toUpperCase()}
              </span>
              <span className="text-gray-600">{po.vendor_name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* PO Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Purchase Order Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Vendor</p>
                <p className="font-medium">{po.vendor_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium capitalize">{po.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Issue Date</p>
                <p className="font-medium">
                  {po.issue_date ? format(new Date(po.issue_date), 'MMMM d, yyyy') : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expected Delivery</p>
                <p className="font-medium">
                  {po.expected_delivery ? format(new Date(po.expected_delivery), 'MMMM d, yyyy') : 'Not specified'}
                </p>
              </div>
              {po.description && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="mt-1">{po.description}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Project Info */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Project Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Job Number</p>
                <p className="font-medium">{po.project.job_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Name</p>
                <p className="font-medium">{po.project.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Division</p>
                <p className="font-medium">{po.project.division.name} ({po.project.division.code})</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="font-medium">{po.project.client.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Manager</p>
                <p className="font-medium">
                  {po.project.project_manager.first_name} {po.project.project_manager.last_name}
                </p>
                <p className="text-sm text-gray-700">{po.project.project_manager.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Status</p>
                <p className="font-medium capitalize">{po.project.status}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${po.project.id}`)}
              >
                View Project Details
              </Button>
            </div>
          </Card>

          {/* Line Items */}
          {po.po_line_items && po.po_line_items.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Line Items</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Line #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {po.po_line_items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm">{item.line_number}</td>
                        <td className="px-4 py-3 text-sm">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-medium text-right">
                        Line Items Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {formatCurrency(po.calculated.lineItemsTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* Audit Trail */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Audit Information</h2>
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Created by:</span>
                <span className="ml-2 font-medium">
                  {po.created_by_user?.first_name} {po.created_by_user?.last_name}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Created on:</span>
                <span className="ml-2 font-medium">
                  {format(new Date(po.created_at), 'MMMM d, yyyy h:mm a')}
                </span>
              </div>
              {po.approved_by_user && (
                <div className="flex items-center text-sm">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Approved by:</span>
                  <span className="ml-2 font-medium">
                    {po.approved_by_user.first_name} {po.approved_by_user.last_name}
                  </span>
                </div>
              )}
              {po.approved_at && (
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Approved on:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(po.approved_at), 'MMMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Last updated:</span>
                <span className="ml-2 font-medium">
                  {format(new Date(po.updated_at), 'MMMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Committed Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(po.committed_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoiced Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(po.invoiced_amount)}
                </p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">Remaining</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(po.calculated.remainingAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoiced %</p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(po.calculated.invoicedPercentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {po.calculated.invoicedPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Line Items Summary */}
          {po.po_line_items && po.po_line_items.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Line Items Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Package className="h-4 w-4 mr-2" />
                    Total Line Items
                  </span>
                  <span className="font-semibold">{po.po_line_items.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Line Items Total
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(po.calculated.lineItemsTotal)}
                  </span>
                </div>
                {po.calculated.variance !== 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-gray-600">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Variance
                    </span>
                    <span className={`font-semibold ${
                      po.calculated.variance < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(po.calculated.variance)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => router.push(`/projects/${po.project.id}/purchase-orders`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View All Project POs
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => window.print()}
              >
                <FileText className="h-4 w-4 mr-2" />
                Print PO Details
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}