'use client'

import { useState, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Settings, ChevronsUpDown, ChevronUp, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExcelFilterDropdown } from '@/components/ui/excel-filter-dropdown'
import type { SortDirection } from '@/components/ui/excel-filter-dropdown'
import { ExpandableRow } from '@/components/ui/expandable-row'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface PurchaseOrder {
  id: string
  po_number: string
  vendor_name: string
  description: string
  committed_amount: number
  forecast_amount?: number
  invoiced_amount?: number
  status: string
  cost_center?: string | null
  cost_code?: {
    id: string
    code: string
    description: string
  }
}

type SortField = 'po_number' | 'vendor_name' | 'description' | 'committed_amount' | 'forecast_amount' | 'invoiced_amount' | 'status' | 'cost_center'

interface SortConfig {
  field: SortField | null
  direction: SortDirection
}

interface ColumnFilter {
  column: string
  values: string[]
}

interface POLogTableProps {
  purchaseOrders: PurchaseOrder[]
  className?: string
  projectId?: string
}

// Custom table header component for PO Log that includes projectId in API calls
interface POLogTableHeaderProps {
  children: React.ReactNode
  sortKey: string
  currentSort: { field: string | null; direction: SortDirection }
  onSort: (field: string) => void
  filterable?: boolean
  currentFilters: ColumnFilter[]
  onFilterChange: (column: string, values: string[]) => void
  className?: string
  align?: 'left' | 'center' | 'right'
  projectId?: string
}

function POLogTableHeader({
  children,
  sortKey,
  currentSort,
  onSort,
  filterable = false,
  currentFilters,
  onFilterChange,
  className,
  align = 'left',
  projectId
}: POLogTableHeaderProps) {
  const isActive = currentSort.field === sortKey
  const direction = isActive ? currentSort.direction : null

  // Get current filter for this column
  const currentFilter = currentFilters.find(f => f.column === sortKey)
  const selectedValues = currentFilter?.values || []

  // Fetch distinct values for this column when filterable
  const { data: distinctValuesData, isLoading: isLoadingValues } = useQuery({
    queryKey: ['distinct-values', sortKey, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ column: sortKey })
      if (projectId) {
        params.append('projectId', projectId)
      }
      
      const response = await fetch(`/api/purchase-orders/distinct-values?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch distinct values')
      }
      return response.json()
    },
    enabled: filterable
  })

  const getSortIcon = () => {
    if (!isActive || direction === null) {
      return <ChevronsUpDown className="h-4 w-4 text-foreground" />
    }
    if (direction === 'asc') {
      return <ChevronUp className="h-4 w-4 text-blue-600" />
    }
    return <ChevronDown className="h-4 w-4 text-blue-600" />
  }

  const getTextAlignment = () => {
    switch (align) {
      case 'center':
        return 'text-center'
      case 'right':
        return 'text-right'
      default:
        return 'text-left'
    }
  }

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Don't trigger sort when clicking on filter dropdown
    if (filterable && e.target !== e.currentTarget) {
      return
    }
    onSort(sortKey)
  }

  const handleFilterChange = (values: string[]) => {
    onFilterChange(sortKey, values)
  }

  const handleSortChange = (newDirection: SortDirection) => {
    if (newDirection !== direction) {
      onSort(sortKey)
    }
  }

  return (
    <th
      className={cn(
        'px-6 py-3 text-xs font-medium text-foreground uppercase tracking-wider select-none transition-colors relative',
        !filterable && 'cursor-pointer hover:bg-foreground/5',
        getTextAlignment(),
        className
      )}
      onClick={handleHeaderClick}
    >
      <div className={cn(
        'flex items-center gap-2',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}>
        <span className={filterable ? 'cursor-pointer' : ''} onClick={() => !filterable && onSort(sortKey)}>
          {children}
        </span>
        
        <div className="flex items-center gap-1">
          {!filterable && getSortIcon()}
          
          {filterable && (
            <ExcelFilterDropdown
              columnKey={sortKey}
              title={children as string}
              values={distinctValuesData?.values || []}
              selectedValues={selectedValues}
              onFilterChange={handleFilterChange}
              sortDirection={direction}
              onSortChange={handleSortChange}
              isLoading={isLoadingValues}
            />
          )}
        </div>
      </div>
    </th>
  )
}

// Mobile expandable card component
function MobileExpandableCard({ purchaseOrderId, children }: { purchaseOrderId: string; children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Fetch line items when expanded
  const { data: lineItemsData, isLoading, error } = useQuery({
    queryKey: ['po-line-items', purchaseOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/line-items`)
      if (!response.ok) {
        throw new Error('Failed to fetch line items')
      }
      return response.json()
    },
    enabled: isExpanded
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {children}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight 
            className={cn(
              "h-5 w-5 text-gray-600 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        </button>
      </div>
      
      {isExpanded && (
        <div className="ml-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              <span className="ml-2 text-gray-600">Loading invoices...</span>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-600">
              Error loading line items
            </div>
          ) : lineItemsData?.line_items?.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No invoices found
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Invoice Line Items
              </h4>
              {lineItemsData?.line_items?.map((item: any, index: number) => (
                <div key={item.id} className="p-3 bg-white rounded border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      Line #{item.line_number}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.total_amount)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{item.description}</p>
                  {item.invoice_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Invoice Date: {format(new Date(item.invoice_date), 'MMM d, yyyy')}
                    </p>
                  )}
                  {item.quantity && item.unit_price && (
                    <p className="text-xs text-gray-500 mt-1">
                      {item.quantity} @ {formatCurrency(item.unit_price)}
                    </p>
                  )}
                </div>
              ))}
              <div className="pt-3 border-t border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(lineItemsData?.summary?.total_amount || 0)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {lineItemsData?.summary?.line_count || 0} line items
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function POLogTable({ purchaseOrders, className, projectId }: POLogTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])

  // Helper function to format cost center display
  const formatCostCenter = (costCenter: string | null | undefined) => {
    if (!costCenter) return '-'
    switch (costCenter) {
      case '2000': return 'Equipment'
      case '3000': return 'Materials'
      case '4000': return 'Subcontracts'
      case '5000': return 'Small Tools'
      default: return costCenter
    }
  }

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

  // Clear all filters
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

  // Apply sorting and filtering to purchase orders
  const processedOrders = useMemo(() => {
    let filtered = [...purchaseOrders]

    // Apply filters
    columnFilters.forEach(filter => {
      filtered = filtered.filter(po => {
        let value: string | number | undefined
        if (filter.column === 'cost_center') {
          value = formatCostCenter(po.cost_center)
        } else {
          value = po[filter.column as keyof PurchaseOrder] as string | number | undefined
        }
        return filter.values.includes(String(value))
      })
    })

    // Apply sorting
    if (sortConfig.field && sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: string | number | undefined = a[sortConfig.field as keyof PurchaseOrder] as string | number | undefined
        let bValue: string | number | undefined = b[sortConfig.field as keyof PurchaseOrder] as string | number | undefined

        if (sortConfig.field === 'cost_center') {
          aValue = formatCostCenter(a.cost_center)
          bValue = formatCostCenter(b.cost_center)
        }

        if (aValue !== undefined && bValue !== undefined) {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    return filtered
  }, [purchaseOrders, columnFilters, sortConfig])
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)
  }

  const calculatePercentage = (invoiced: number, poValue: number) => {
    if (poValue === 0) return 0
    return Math.round((invoiced / poValue) * 100)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Controls */}
      {activeFiltersCount > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            onClick={clearAllFilters}
            variant="outline"
            size="sm"
            className="border-orange-500 text-orange-700 hover:bg-orange-50 flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Clear All Filters ({activeFiltersCount})
          </Button>
        </div>
      )}
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-12 px-6 py-3">
                {/* Expand/collapse column */}
              </th>
              <POLogTableHeader
                sortKey="po_number"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                projectId={projectId}
              >
                PO #
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="vendor_name"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                projectId={projectId}
              >
                Vendor
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="description"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                projectId={projectId}
              >
                Scope
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="cost_center"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                projectId={projectId}
              >
                Cost Code
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="committed_amount"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                align="right"
                projectId={projectId}
              >
                PO Value
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="forecast_amount"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                align="right"
                projectId={projectId}
              >
                Forecast Final
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="invoiced_amount"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                align="right"
                projectId={projectId}
              >
                Invoiced
              </POLogTableHeader>
              <POLogTableHeader
                sortKey="status"
                currentSort={sortConfig}
                onSort={handleSort}
                filterable={true}
                currentFilters={columnFilters}
                onFilterChange={handleFilterChange}
                className="py-3 px-2"
                align="center"
                projectId={projectId}
              >
                Status
              </POLogTableHeader>
            </tr>
          </thead>
          <tbody>
            {processedOrders.map((po, index) => {
              const isOverInvoiced = (po.invoiced_amount || 0) > (po.committed_amount || 0)
              const percentage = calculatePercentage(po.invoiced_amount || 0, po.committed_amount || 0)
              
              return (
                <ExpandableRow key={po.id} purchaseOrderId={po.id} colSpan={9}>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{po.po_number}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-gray-700">{po.vendor_name}</td>
                  <td className="py-4 px-2 text-gray-700 max-w-xs">
                    <span className="line-clamp-2" title={po.description}>
                      {po.description}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-gray-700">
                    <span>{formatCostCenter(po.cost_center)}</span>
                  </td>
                  <td className="text-right py-4 px-2 text-gray-900">
                    {formatCurrency(po.committed_amount)}
                  </td>
                  <td className={cn(
                    "text-right py-4 px-2 font-medium",
                    (po.forecast_amount || po.committed_amount) > po.committed_amount && "text-yellow-600"
                  )}>
                    {formatCurrency(po.forecast_amount || po.committed_amount)}
                  </td>
                  <td className="text-right py-4 px-2 relative">
                    <div className="flex items-center justify-end gap-2">
                      <span className={cn(
                        "font-medium",
                        isOverInvoiced && "text-red-600"
                      )}>
                        {formatCurrency(po.invoiced_amount || 0)}
                        <span className={cn(
                          "ml-1 text-sm",
                          percentage > 100 ? "text-red-600" : "text-gray-500"
                        )}>
                          ({percentage}%)
                        </span>
                      </span>
                      {isOverInvoiced && (
                        <div className="relative group">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                              Over-invoiced by {formatCurrency((po.invoiced_amount || 0) - po.committed_amount)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-4 px-2">
                    <Badge 
                      variant={po.status === 'open' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {po.status}
                    </Badge>
                  </td>
                </ExpandableRow>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {processedOrders.map((po) => {
          const isOverInvoiced = (po.invoiced_amount || 0) > (po.committed_amount || 0)
          const percentage = calculatePercentage(po.invoiced_amount || 0, po.committed_amount || 0)
          
          return (
            <MobileExpandableCard key={po.id} purchaseOrderId={po.id}>
            <div 
              key={po.id} 
              className={cn(
                'bg-white rounded-lg border p-4 space-y-3',
                isOverInvoiced && 'border-red-300 bg-red-50'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{po.po_number}</span>
                  {isOverInvoiced && (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <Badge 
                  variant={po.status === 'open' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {po.status}
                </Badge>
              </div>
              
              {/* Vendor & Description */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">{po.vendor_name}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{po.description}</p>
                {po.cost_center && (
                  <p className="text-sm text-gray-500">
                    Cost Code: {formatCostCenter(po.cost_center)}
                  </p>
                )}
              </div>
              
              {/* Financial Values */}
              <div className="pt-2 space-y-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">PO Value:</span>
                  <span className="text-sm font-medium">{formatCurrency(po.committed_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Forecast Final:</span>
                  <span className={cn(
                    "text-sm font-medium",
                    (po.forecast_amount || po.committed_amount) > po.committed_amount && "text-yellow-600"
                  )}>
                    {formatCurrency(po.forecast_amount || po.committed_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Invoiced:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isOverInvoiced && "text-red-600"
                    )}>
                      {formatCurrency(po.invoiced_amount || 0)}
                      <span className={cn(
                        "ml-1 text-xs",
                        percentage > 100 ? "text-red-600" : "text-gray-500"
                      )}>
                        ({percentage}%)
                      </span>
                    </span>
                    {isOverInvoiced && (
                      <div className="relative group">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                            Over-invoiced by {formatCurrency((po.invoiced_amount || 0) - po.committed_amount)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </MobileExpandableCard>
          )
        })}
      </div>
    </div>
  )
}