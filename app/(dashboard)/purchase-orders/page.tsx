'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  Download,
  Eye,
  DollarSign,
  Package,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SortableTableHeader } from '@/components/ui/sortable-table-header'
import type { SortDirection } from '@/components/ui/sortable-table-header'
import { ExpandableRow } from '@/components/ui/expandable-row'
import { RiskStatusBadge } from '@/components/ui/risk-status-badge'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface PurchaseOrder {
  id: string
  po_number: string
  vendor_name: string
  description: string
  total_amount: number
  committed_amount?: number
  invoiced_amount: number
  forecasted_overrun?: number
  risk_status?: 'normal' | 'at-risk' | 'over-budget'
  status: 'draft' | 'approved' | 'closed' | 'cancelled'
  order_date: string | null
  project: {
    id: string
    job_number: string
    name: string
  }
  po_line_items: { count: number; total_amount: number }
}

type SortField = 'po_number' | 'vendor_name' | 'committed_amount' | 'total_amount' | 'order_date' | 'status'
interface SortConfig {
  field: SortField | null
  direction: SortDirection
}

interface ColumnFilter {
  column: string
  values: string[]
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const [limit, setLimit] = useState<string>('50')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])

  const canImport = user && user.role === 'project_manager'

  // Sort handler
  const handleSort = (field: string) => {
    const sortField = field as SortField
    setSortConfig(current => {
      if (current.field === sortField) {
        // Cycle through: asc -> desc -> null
        const newDirection = current.direction === 'asc' ? 'desc' : 
                           current.direction === 'desc' ? null : 'asc'
        return { field: newDirection ? sortField : null, direction: newDirection }
      } else {
        // New field, start with ascending
        return { field: sortField, direction: 'asc' }
      }
    })
  }

  // Handle column filter changes
  const handleFilterChange = (column: string, values: string[]) => {
    setColumnFilters(current => {
      const filtered = current.filter(f => f.column !== column)
      if (values.length > 0) {
        return [...filtered, { column, values }]
      }
      return filtered
    })
  }

  // Fetch purchase orders
  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', limit, columnFilters, sortConfig],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit
      })
      
      // Apply column filters
      columnFilters.forEach(filter => {
        if (filter.values.length > 0) {
          params.append(`filter_${filter.column}`, filter.values.join(','))
        }
      })
      
      if (sortConfig.field && sortConfig.direction) {
        params.append('sort_by', sortConfig.field)
        params.append('sort_direction', sortConfig.direction)
      }

      const response = await fetch(`/api/purchase-orders?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Purchase orders API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(errorData.error || `Failed to fetch purchase orders: ${response.status} ${response.statusText}`)
      }
      return response.json()
    }
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'closed': return 'bg-foreground/5 text-foreground'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-foreground/5 text-foreground'
    }
  }

  const handleExport = () => {
    if (!data?.purchase_orders) return
    
    const headers = ['PO Number', 'Project', 'Vendor', 'Description', 'PO Value', 'Line Item Value', 'Forecasted Overrun', 'Risk Status', 'Status', 'Issue Date']
    const rows = data.purchase_orders.map((po: PurchaseOrder) => [
      po.po_number,
      `${po.project.job_number} - ${po.project.name}`,
      po.vendor_name,
      po.description || '',
      po.committed_amount ?? po.total_amount,
      po.po_line_items?.total_amount || 0,
      po.forecasted_overrun || 0,
      po.risk_status || 'normal',
      po.status,
      po.order_date ? format(new Date(po.order_date), 'yyyy-MM-dd') : ''
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: string | number) => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearAllFilters = () => {
    setColumnFilters([])
    setSortConfig({ field: null, direction: null })
  }

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = columnFilters.length
    if (sortConfig.field) count++
    return count
  }, [columnFilters.length, sortConfig.field])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-foreground mt-1">View and import purchase orders from external systems</p>
        </div>
        <div className="flex gap-3">
          {activeFiltersCount > 0 && (
            <Button
              onClick={clearAllFilters}
              variant="outline"
              className="border-orange-500 text-orange-700 hover:bg-orange-50 flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Clear All Filters ({activeFiltersCount})
            </Button>
          )}
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          {canImport && (
            <Button
              onClick={() => router.push('/purchase-orders/import')}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          )}
        </div>
      </div>


      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">Total PO Value</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(data.summary.totalCommitted)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">Total Line Item Value</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalInvoiced)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">Remaining</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.summary.totalRemaining)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">Total POs</p>
                <p className="text-2xl font-bold text-blue-600">{data.pagination.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Table Controls */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground/80">Show:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="px-2 py-1 border border-foreground/30 rounded text-sm"
              >
                <option value="25">25 entries</option>
                <option value="50">50 entries</option>
                <option value="100">100 entries</option>
                <option value="all">All entries</option>
              </select>
            </div>
            {data?.pagination && (
              <div className="text-sm text-foreground/70">
                Showing {data.purchase_orders?.length || 0} of {data.pagination.total} entries
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <div className="text-sm text-blue-600 font-medium">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Enhanced Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background">
              {/* Header Row */}
              <tr>
                <th className="px-6 py-3 w-12">
                  {/* Expand column header */}
                </th>
                <SortableTableHeader
                  sortKey="po_number"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  PO Number
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="project_name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  Project
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="vendor_name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  Vendor
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="description"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  Description
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="committed_amount"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                  align="right"
                >
                  PO Value
                </SortableTableHeader>
                <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider">
                  Line Item Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider">
                  Forecasted Overrun
                </th>
                <th className="px-6 py-3 text-xs font-medium text-foreground uppercase tracking-wider">
                  Risk Status
                </th>
                <SortableTableHeader
                  sortKey="status"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  Status
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="order_date"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterable={true}
                  currentFilters={columnFilters}
                  onFilterChange={handleFilterChange}
                >
                  Issue Date
                </SortableTableHeader>
                <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-foreground">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-red-600">
                    Error loading purchase orders
                  </td>
                </tr>
              ) : data?.purchase_orders?.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-foreground">
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                data?.purchase_orders?.map((po: PurchaseOrder) => (
                  <ExpandableRow key={po.id} purchaseOrderId={po.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {po.po_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-foreground">{po.project.job_number}</p>
                        <p className="text-sm text-foreground/80">{po.project.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">
                      {po.vendor_name}
                    </td>
                    <td className="px-6 py-4">
                      <p className="truncate max-w-xs text-foreground" title={po.description}>
                        {po.description || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {formatCurrency(po.committed_amount ?? po.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">
                      {formatCurrency(po.po_line_items?.total_amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={po.forecasted_overrun && po.forecasted_overrun > 0 ? 'text-red-600 font-medium' : 'text-foreground'}>
                        {formatCurrency(po.forecasted_overrun || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RiskStatusBadge status={po.risk_status || 'normal'} showIcon={true} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {po.order_date ? format(new Date(po.order_date), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/purchase-orders/${po.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </ExpandableRow>
                ))
              )}
            </tbody>
          </table>
        </div>

      </Card>
    </div>
  )
}