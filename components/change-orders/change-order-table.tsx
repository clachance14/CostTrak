'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Download,
  Paperclip,
} from 'lucide-react'
import { format } from 'date-fns'
import type { ChangeOrder } from '@/types/api'

interface ChangeOrderTableProps {
  changeOrders: ChangeOrder[]
  projectId: string
  canEdit?: boolean
  onRefresh?: () => void
}

type SortField = 'co_number' | 'submitted_date' | 'amount' | 'status' | 'pricing_type'
type SortDirection = 'asc' | 'desc'

export function ChangeOrderTable({ 
  changeOrders, 
  canEdit = false
}: ChangeOrderTableProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('co_number')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary'
      case 'pending':
        return 'default'
      case 'approved':
        return 'success'
      case 'rejected':
        return 'destructive'
      case 'cancelled':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getPricingTypeLabel = (type: string) => {
    switch (type) {
      case 'LS':
        return 'Lump Sum'
      case 'T&M':
        return 'Time & Materials'
      case 'Estimate':
        return 'Estimate'
      case 'Credit':
        return 'Credit'
      default:
        return type
    }
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedChangeOrders = [...changeOrders].sort((a, b) => {
    let aVal = a[sortField as keyof ChangeOrder]
    let bVal = b[sortField as keyof ChangeOrder]

    if (sortField === 'submitted_date') {
      aVal = new Date(aVal || 0).getTime()
      bVal = new Date(bVal || 0).getTime()
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const handleView = (co: ChangeOrder) => {
    setSelectedCO(co)
    setShowDetail(true)
  }

  const handleEdit = (coId: string) => {
    router.push(`/change-orders/${coId}/edit`)
  }

  const handleExport = async () => {
    // TODO: Implement export functionality
    console.log('Exporting change orders...')
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1 inline" /> : 
      <ChevronDown className="h-4 w-4 ml-1 inline" />
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Change Orders ({changeOrders.length})
          </h3>
          {changeOrders.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('co_number')}
                >
                  CO # <SortIcon field="co_number" />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('pricing_type')}
                >
                  Type <SortIcon field="pricing_type" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 text-center"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 text-right"
                  onClick={() => handleSort('amount')}
                >
                  Amount <SortIcon field="amount" />
                </TableHead>
                <TableHead className="text-center">Schedule Impact</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('submitted_date')}
                >
                  Submitted <SortIcon field="submitted_date" />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedChangeOrders.map((co) => (
                <TableRow key={co.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{co.co_number}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {co.description}
                    {co.attachments && co.attachments.length > 0 && (
                      <Paperclip className="h-3 w-3 inline ml-2 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>{getPricingTypeLabel(co.pricing_type)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getStatusColor(co.status)}>
                      {co.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {co.pricing_type === 'Credit' ? 
                      <span className="text-red-600">({formatCurrency(Math.abs(co.amount))})</span> : 
                      formatCurrency(co.amount)
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    {co.impact_schedule_days ? (
                      <span className={co.impact_schedule_days > 0 ? 'text-red-600' : 'text-green-600'}>
                        {co.impact_schedule_days > 0 ? '+' : ''}{co.impact_schedule_days} days
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {co.submitted_date ? 
                      format(new Date(co.submitted_date), 'MMM d, yyyy') : 
                      <span className="text-gray-400">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleView(co)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {canEdit && co.status === 'draft' && (
                          <DropdownMenuItem onClick={() => handleEdit(co.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {co.attachments && co.attachments.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              View Attachments ({co.attachments.length})
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Order Details</DialogTitle>
            <DialogDescription>
              {selectedCO?.co_number} - {selectedCO?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCO && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status</h4>
                  <Badge variant={getStatusColor(selectedCO.status)} className="mt-1">
                    {selectedCO.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Pricing Type</h4>
                  <p className="mt-1">{getPricingTypeLabel(selectedCO.pricing_type)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Total Amount</h4>
                  <p className="mt-1 text-lg font-semibold">{formatCurrency(selectedCO.amount)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Schedule Impact</h4>
                  <p className="mt-1">
                    {selectedCO.impact_schedule_days ? 
                      `${selectedCO.impact_schedule_days > 0 ? '+' : ''}${selectedCO.impact_schedule_days} days` : 
                      'No impact'
                    }
                  </p>
                </div>
              </div>

              {selectedCO.reason && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Reason/Justification</h4>
                  <p className="mt-1 text-gray-900">{selectedCO.reason}</p>
                </div>
              )}

              {/* Cost Breakdown */}
              {(selectedCO.labor_amount || selectedCO.material_amount || 
                selectedCO.equipment_amount || selectedCO.subcontract_amount) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Cost Breakdown</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      {selectedCO.labor_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Labor</span>
                          <span>{formatCurrency(selectedCO.labor_amount)}</span>
                        </div>
                      )}
                      {selectedCO.material_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Materials</span>
                          <span>{formatCurrency(selectedCO.material_amount)}</span>
                        </div>
                      )}
                      {selectedCO.equipment_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Equipment</span>
                          <span>{formatCurrency(selectedCO.equipment_amount)}</span>
                        </div>
                      )}
                      {selectedCO.subcontract_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Subcontractor</span>
                          <span>{formatCurrency(selectedCO.subcontract_amount)}</span>
                        </div>
                      )}
                      {selectedCO.markup_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Markup/Overhead</span>
                          <span>{formatCurrency(selectedCO.markup_amount)}</span>
                        </div>
                      )}
                      {selectedCO.tax_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span>{formatCurrency(selectedCO.tax_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(selectedCO.amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-500">Submitted</h4>
                  <p className="mt-1">
                    {selectedCO.submitted_date ? 
                      format(new Date(selectedCO.submitted_date), 'MMM d, yyyy') : 
                      'Not submitted'
                    }
                  </p>
                </div>
                {selectedCO.approved_date && (
                  <div>
                    <h4 className="font-medium text-gray-500">Approved</h4>
                    <p className="mt-1">
                      {format(new Date(selectedCO.approved_date), 'MMM d, yyyy')}
                      {selectedCO.approved_by_user && (
                        <span className="text-gray-500">
                          {' '}by {selectedCO.approved_by_user.first_name} {selectedCO.approved_by_user.last_name}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Attachments */}
              {selectedCO.attachments && selectedCO.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Attachments</h4>
                  <div className="space-y-2">
                    {selectedCO.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm">{attachment.file_name}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}