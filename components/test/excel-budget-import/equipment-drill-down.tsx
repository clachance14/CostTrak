'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronRight, Wrench, Fuel, Settings, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface EquipmentDetail {
  description: string
  quantity: number
  duration: number
  durationType: string
  fueled: string
  rateUsed: number
  equipmentCost: number
  fogCost: number
  maintenanceCost: number
  totalCost: number
  sourceDiscipline?: string
  sourceRow: number
}

interface EquipmentDrillDownProps {
  discipline: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EquipmentDrillDown({ discipline, isOpen = false, onOpenChange }: EquipmentDrillDownProps) {
  const [dialogOpen, setDialogOpen] = useState(isOpen)
  
  const equipmentCategory = discipline?.categories?.['EQUIPMENT']
  const equipmentDetails = discipline?.equipmentDetails || []
  const breakdown = discipline?.equipmentCostBreakdown
  
  if (!equipmentCategory || equipmentCategory.value === 0) {
    return null
  }
  
  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    onOpenChange?.(open)
  }
  
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1"
        onClick={() => handleOpenChange(true)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Equipment Details - {discipline.discipline}</DialogTitle>
            <DialogDescription>
              Detailed breakdown of equipment costs from GENERAL EQUIPMENT sheet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Rental Cost
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(breakdown?.rentalCost || 0)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4" />
                      F.O.G. Cost
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(breakdown?.fogCost || 0)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Maintenance
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(breakdown?.maintenanceCost || 0)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Cost
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(breakdown?.total || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Budget vs Actual */}
            {Math.abs((breakdown?.total || 0) - equipmentCategory.value) > 0.01 && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cost Reconciliation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Budget (from BUDGETS sheet):</span>
                      <span className="font-medium">{formatCurrency(equipmentCategory.value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Actual (from GENERAL EQUIPMENT):</span>
                      <span className="font-medium">{formatCurrency(breakdown?.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Difference:</span>
                      <span className="font-medium">
                        {formatCurrency(Math.abs((breakdown?.total || 0) - equipmentCategory.value))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Equipment Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Equipment Items</CardTitle>
                <CardDescription>
                  {equipmentDetails.length} items contributing to this discipline's equipment cost
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Fueled</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Equipment</TableHead>
                        <TableHead className="text-right">F.O.G.</TableHead>
                        <TableHead className="text-right">Maint.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipmentDetails.map((item: EquipmentDetail, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.duration}</TableCell>
                          <TableCell>{item.durationType}</TableCell>
                          <TableCell className="text-center">
                            {item.fueled === 'YES' && (
                              <Badge variant="secondary" className="text-xs">
                                <Fuel className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.rateUsed)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.equipmentCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.fogCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.maintenanceCost)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {equipmentDetails.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            No equipment details found for this discipline
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}