'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { 
  Check, 
  X, 
  Edit, 
  Eye,
  MoreHorizontal 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChangeOrderStatusBadge } from './change-order-status-badge'
import { cn } from '@/lib/utils'

interface ChangeOrder {
  id: string
  co_number: string
  description: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | string
  submitted_date?: string
  approved_date?: string
  project?: {
    id: string
    job_number: string
    name: string
  }
  created_by_user?: {
    first_name: string
    last_name: string
  }
  approved_by_user?: {
    first_name: string
    last_name: string
  }
  pricing_type?: string
  impact_schedule_days?: number
  labor_amount?: number
  manhours?: number
  equipment_amount?: number
  material_amount?: number
}

interface ChangeOrderTableProps {
  changeOrders: ChangeOrder[]
  onApprove?: (id: string) => Promise<void>
  onDeny?: (id: string) => Promise<void>
  onRefresh?: () => void
  showProject?: boolean
  projectId?: string
  isLoading?: boolean
}

export function ChangeOrderTable({
  changeOrders,
  onApprove,
  onDeny,
  onRefresh,
  showProject = true,
  projectId,
  isLoading = false
}: ChangeOrderTableProps) {
  const router = useRouter()
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null)
  const [actionDialog, setActionDialog] = useState<'approve' | 'deny' | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleAction = async (action: 'approve' | 'deny') => {
    if (!selectedCO) return
    
    setProcessing(true)
    try {
      if (action === 'approve' && onApprove) {
        await onApprove(selectedCO.id)
      } else if (action === 'deny' && onDeny) {
        await onDeny(selectedCO.id)
      }
      setActionDialog(null)
      setSelectedCO(null)
      onRefresh?.()
    } catch (error) {
      console.error(`Failed to ${action} change order:`, error)
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const handleEdit = (co: ChangeOrder) => {
    if (projectId) {
      router.push(`/projects/${projectId}/change-orders/${co.id}/edit`)
    }
  }

  if (changeOrders.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        No change orders found
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CO Number</TableHead>
              {showProject && <TableHead>Project</TableHead>}
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changeOrders.map((co) => (
              <TableRow key={co.id}>
                <TableCell className="font-medium">{co.co_number}</TableCell>
                {showProject && (
                  <TableCell>
                    <div>
                      <p className="font-medium">Job #{co.project?.job_number}</p>
                      <p className="text-sm text-gray-600">{co.project?.name}</p>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <p className="line-clamp-2">{co.description}</p>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(co.amount)}
                </TableCell>
                <TableCell>
                  <ChangeOrderStatusBadge status={co.status} />
                </TableCell>
                <TableCell>
                  {co.approved_date && co.status === 'approved'
                    ? format(new Date(co.approved_date), 'MM/dd/yyyy')
                    : co.submitted_date
                    ? format(new Date(co.submitted_date), 'MM/dd/yyyy')
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {co.status === 'pending' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                          setSelectedCO(co)
                          setActionDialog('approve')
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedCO(co)
                          setActionDialog('deny')
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(co)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedCO(co)
                        setActionDialog(null)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Quick Approve/Deny Dialog */}
      <Dialog 
        open={!!actionDialog && !!selectedCO} 
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog(null)
            setSelectedCO(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'approve' ? 'Approve' : 'Deny'} Change Order
            </DialogTitle>
            <DialogDescription>
              {selectedCO?.co_number} - {selectedCO?.project?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCO && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Description</h4>
                <p className="text-sm text-gray-600">{selectedCO.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Amount</h4>
                  <p className="text-sm">{formatCurrency(selectedCO.amount)}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Pricing Type</h4>
                  <p className="text-sm">{selectedCO.pricing_type || 'N/A'}</p>
                </div>
              </div>

              {selectedCO.impact_schedule_days !== 0 && (
                <div>
                  <h4 className="font-medium mb-1">Schedule Impact</h4>
                  <p className="text-sm">
                    {selectedCO.impact_schedule_days} days
                    {selectedCO.impact_schedule_days > 0 ? ' (delay)' : ' (acceleration)'}
                  </p>
                </div>
              )}

              {(selectedCO.labor_amount || selectedCO.equipment_amount || selectedCO.material_amount) && (
                <div>
                  <h4 className="font-medium mb-1">Cost Breakdown</h4>
                  <div className="text-sm space-y-1">
                    {selectedCO.labor_amount > 0 && (
                      <p>• Labor: {formatCurrency(selectedCO.labor_amount)} 
                        {selectedCO.manhours > 0 && ` (${selectedCO.manhours} hours)`}
                      </p>
                    )}
                    {selectedCO.equipment_amount > 0 && (
                      <p>• Equipment: {formatCurrency(selectedCO.equipment_amount)}</p>
                    )}
                    {selectedCO.material_amount > 0 && (
                      <p>• Material: {formatCurrency(selectedCO.material_amount)}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Submitted</h4>
                  <p className="text-sm">
                    {selectedCO.submitted_date 
                      ? format(new Date(selectedCO.submitted_date), 'MM/dd/yyyy')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Submitted By</h4>
                  <p className="text-sm">
                    {selectedCO.created_by_user 
                      ? `${selectedCO.created_by_user.first_name} ${selectedCO.created_by_user.last_name}`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null)
                setSelectedCO(null)
              }}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleAction(actionDialog!)}
              disabled={processing}
              className={cn(
                actionDialog === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {processing ? 'Processing...' : actionDialog === 'approve' ? 'Approve' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}