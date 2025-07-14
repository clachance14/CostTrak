import React from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface POLineItem {
  id: string
  description: string
  amount: number
}

interface POLineItemInputProps {
  items: POLineItem[]
  onChange: (items: POLineItem[]) => void
  className?: string
}

export function POLineItemInput({ items, onChange, className }: POLineItemInputProps) {
  const generateId = () => `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const addItem = () => {
    onChange([...items, { id: generateId(), description: '', amount: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      onChange(items.filter(item => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof POLineItem, value: string | number) => {
    onChange(
      items.map(item =>
        item.id === id
          ? { ...item, [field]: field === 'amount' ? Number(value) || 0 : value }
          : item
      )
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 mb-2">
        <div className="col-span-7">
          <Label className="text-sm font-medium text-foreground/80">Description</Label>
        </div>
        <div className="col-span-4">
          <Label className="text-sm font-medium text-foreground/80">Amount</Label>
        </div>
        <div className="col-span-1"></div>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-7">
              <Input
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                placeholder="Enter line item description (e.g., Labor, Materials, Engineering)"
                required
              />
            </div>
            <div className="col-span-4">
              <Input
                type="text"
                value={item.amount > 0 ? item.amount.toString() : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.-]/g, '')
                  updateItem(item.id, 'amount', value)
                }}
                placeholder="$0"
                required
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className={cn(
                  "p-1 h-8 w-8",
                  items.length === 1 && "opacity-50 cursor-not-allowed"
                )}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Line Item
      </Button>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-foreground/10">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">Total Contract Amount</Label>
          <span className="text-lg font-bold text-green-600">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  )
}