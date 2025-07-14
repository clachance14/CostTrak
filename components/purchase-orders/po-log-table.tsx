'use client'

import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
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
}

interface POLogTableProps {
  purchaseOrders: PurchaseOrder[]
  className?: string
}

export function POLogTable({ purchaseOrders, className }: POLogTableProps) {
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
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-2 font-medium text-gray-700">PO #</th>
              <th className="text-left py-3 px-2 font-medium text-gray-700">Vendor</th>
              <th className="text-left py-3 px-2 font-medium text-gray-700">Scope</th>
              <th className="text-right py-3 px-2 font-medium text-gray-700">PO Value</th>
              <th className="text-right py-3 px-2 font-medium text-gray-700">Forecast Final</th>
              <th className="text-right py-3 px-2 font-medium text-gray-700">Invoiced</th>
              <th className="text-center py-3 px-2 font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po, index) => {
              const isOverInvoiced = (po.invoiced_amount || 0) > (po.committed_amount || 0)
              const percentage = calculatePercentage(po.invoiced_amount || 0, po.committed_amount || 0)
              
              return (
                <tr 
                  key={po.id} 
                  className={cn(
                    'border-b transition-colors',
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                    'hover:bg-gray-50',
                    isOverInvoiced && 'bg-red-50 hover:bg-red-100'
                  )}
                >
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {purchaseOrders.map((po) => {
          const isOverInvoiced = (po.invoiced_amount || 0) > (po.committed_amount || 0)
          const percentage = calculatePercentage(po.invoiced_amount || 0, po.committed_amount || 0)
          
          return (
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
          )
        })}
      </div>
    </div>
  )
}