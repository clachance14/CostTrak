'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ExpandableRowProps {
  purchaseOrderId: string
  children: React.ReactNode
  onExpand?: (isExpanded: boolean) => void
  colSpan?: number
}

export function ExpandableRow({ purchaseOrderId, children, onExpand, colSpan = 10 }: ExpandableRowProps) {
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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newState = !isExpanded
    setIsExpanded(newState)
    onExpand?.(newState)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <>
      <tr className="hover:bg-background cursor-pointer transition-colors">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <button
              onClick={handleToggle}
              className="p-1 hover:bg-foreground/10 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              title={isExpanded ? 'Click to collapse' : 'Click to view invoices'}
            >
              <ChevronRight 
                className={cn(
                  "h-4 w-4 text-foreground/70 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          </div>
        </td>
        {children}
      </tr>
      
      {isExpanded && (
        <tr className="transition-all duration-300">
          <td colSpan={colSpan} className="px-0 py-0">
            <div className="bg-background border-t border-b border-foreground/20 animate-in fade-in slide-in-from-top-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground/70" />
                  <span className="ml-2 text-foreground/70">Loading invoices...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-600">
                  Error loading line items
                </div>
              ) : lineItemsData?.line_items?.length === 0 ? (
                <div className="text-center py-8 text-foreground/70">
                  No invoices found for this purchase order
                </div>
              ) : (
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Invoice Line Items for PO #{lineItemsData?.po_number}
                  </h3>
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-foreground/20">
                        <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                          Line #
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                          Invoice Date
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                          Category
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">
                          Quantity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                          Unit
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">
                          Unit Price
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineItemsData?.line_items?.map((item: {
                        id: string
                        line_number: number
                        description: string
                        quantity: number
                        unit_price: number
                        total_amount: number
                        invoice_date?: string | null
                        category?: string
                        unit_of_measure?: string
                      }) => (
                        <tr key={item.id} className="hover:bg-foreground/5">
                          <td className="px-4 py-3 text-sm text-foreground">
                            {item.line_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {item.invoice_date ? format(new Date(item.invoice_date), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {item.category || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">
                            {item.quantity || 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {item.unit_of_measure || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground text-right">
                            {item.unit_price ? formatCurrency(item.unit_price) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                            {formatCurrency(item.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-foreground/30">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-sm font-medium text-foreground/80 text-right">
                          Total Invoice Amount:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground text-right">
                          {formatCurrency(lineItemsData?.summary?.total_amount || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={7} className="px-4 py-2 text-xs text-foreground/70 text-right">
                          {lineItemsData?.summary?.line_count || 0} line items • 
                          Total quantity: {lineItemsData?.summary?.total_quantity || 0}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}