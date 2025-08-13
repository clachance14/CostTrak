'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { POLogTable } from '@/components/purchase-orders/po-log-table'
import { formatCurrency } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'

interface BudgetCategoryPOModalProps {
  projectId: string
  category: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PurchaseOrder {
  id: string
  po_number: string
  vendor_name: string
  description: string
  committed_amount: number
  forecast_amount?: number
  invoiced_amount?: number
  status: string
  cost_code?: {
    id: string
    code: string
    description: string
  }
}

export function BudgetCategoryPOModal({
  projectId,
  category,
  open,
  onOpenChange
}: BudgetCategoryPOModalProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  // Fetch POs filtered by category
  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', projectId, category],
    queryFn: async () => {
      const params = new URLSearchParams({
        project_id: projectId,
        category: category.toLowerCase()
      })
      
      const response = await fetch(`/api/purchase-orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch purchase orders')
      return response.json()
    },
    enabled: open && !!category
  })

  useEffect(() => {
    if (data?.purchaseOrders) {
      setPurchaseOrders(data.purchaseOrders)
    }
  }, [data])

  // Calculate total for this category
  const categoryTotal = purchaseOrders.reduce((sum, po) => sum + (po.committed_amount || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {category} Purchase Orders
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Total Committed: {formatCurrency(categoryTotal)}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoaderCircle className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load purchase orders
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders found for this category
            </div>
          ) : (
            <POLogTable 
              purchaseOrders={purchaseOrders} 
              projectId={projectId}
              className="border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}