'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'

const changeOrderSchema = z.object({
  co_number: z.string().min(1, 'CO number is required'),
  description: z.string().min(1, 'Description is required'),
  pricing_type: z.enum(['LS', 'T&M', 'Estimate', 'Credit']),
  impact_schedule_days: z.coerce.number().int().default(0),
  submitted_date: z.string(),
  // Cost breakdown
  labor_amount: z.coerce.number().min(0).nullable().default(null),
  manhours: z.coerce.number().min(0).nullable().default(null),
  equipment_amount: z.coerce.number().min(0).nullable().default(null),
  material_amount: z.coerce.number().min(0).nullable().default(null),
  subcontract_amount: z.coerce.number().min(0).nullable().default(null),
  markup_amount: z.coerce.number().min(0).nullable().default(null),
  tax_amount: z.coerce.number().min(0).nullable().default(null),
})

type ChangeOrderFormData = z.infer<typeof changeOrderSchema>

interface ChangeOrderFormProps {
  projectId: string
  projectName?: string
  jobNumber?: string
  initialData?: Partial<ChangeOrderFormData>
  onSubmit: (data: ChangeOrderFormData & { amount: number }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

export function ChangeOrderForm({
  projectId,
  projectName,
  jobNumber,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create'
}: ChangeOrderFormProps) {
  const [totalAmount, setTotalAmount] = useState(0)
  const [nextCoNumber, setNextCoNumber] = useState('')

  const form = useForm<ChangeOrderFormData>({
    resolver: zodResolver(changeOrderSchema),
    defaultValues: {
      co_number: initialData?.co_number || '',
      description: initialData?.description || '',
      pricing_type: initialData?.pricing_type || 'LS',
      impact_schedule_days: initialData?.impact_schedule_days || 0,
      submitted_date: initialData?.submitted_date || format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
      labor_amount: initialData?.labor_amount ?? null,
      manhours: initialData?.manhours ?? null,
      equipment_amount: initialData?.equipment_amount ?? null,
      material_amount: initialData?.material_amount ?? null,
      subcontract_amount: initialData?.subcontract_amount ?? null,
      markup_amount: initialData?.markup_amount ?? null,
      tax_amount: initialData?.tax_amount ?? null,
    }
  })

  // Fetch next CO number if creating new
  useEffect(() => {
    if (mode === 'create' && projectId) {
      fetch(`/api/change-orders?project_id=${projectId}&limit=1`)
        .then(res => res.json())
        .then(data => {
          const changeOrders = data.change_orders || []
          const lastNumber = changeOrders.length > 0 
            ? parseInt(changeOrders[0].co_number.replace('CO-', '')) || 0
            : 0
          const nextNumber = String(lastNumber + 1).padStart(3, '0')
          setNextCoNumber(`CO-${nextNumber}`)
          form.setValue('co_number', `CO-${nextNumber}`)
        })
        .catch(console.error)
    }
  }, [projectId, mode, form])

  // Calculate total amount when cost breakdown changes
  const watchedFields = form.watch([
    'labor_amount',
    'equipment_amount',
    'material_amount',
    'subcontract_amount',
    'markup_amount',
    'tax_amount'
  ])

  useEffect(() => {
    const [labor, equipment, material, subcontract, markup, tax] = watchedFields
    const total = (labor ?? 0) + (equipment ?? 0) + (material ?? 0) + 
                  (subcontract ?? 0) + (markup ?? 0) + (tax ?? 0)
    setTotalAmount(total)
  }, [watchedFields])

  const handleSubmit = async (data: ChangeOrderFormData) => {
    await onSubmit({
      ...data,
      amount: totalAmount
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Project Info */}
        {(projectName || jobNumber) && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Project</p>
            <p className="font-medium">{projectName} {jobNumber && `(Job #${jobNumber})`}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>
          
          <FormField
            control={form.control}
            name="co_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CO Number *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder={nextCoNumber || "CO-001"}
                    disabled={mode === 'edit'}
                  />
                </FormControl>
                <FormDescription>
                  {mode === 'create' && 'Auto-generated or enter manually'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field}
                    placeholder="Describe the change order..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="pricing_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pricing type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="LS">Lump Sum (LS)</SelectItem>
                      <SelectItem value="T&M">Time & Material (T&M)</SelectItem>
                      <SelectItem value="Estimate">Estimate</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="impact_schedule_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Impact (days)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      type="number"
                      placeholder="0"
                    />
                  </FormControl>
                  <FormDescription>
                    Positive for delays, negative for acceleration
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Cost Breakdown */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Cost Breakdown</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="labor_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Labor Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="$0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="manhours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manhours</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="equipment_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="$0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="material_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="$0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="subcontract_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcontract Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="$0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="markup_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Markup Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="$0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="tax_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Amount</FormLabel>
                <FormControl>
                  <CurrencyInput 
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="$0.00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total Amount Display */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-medium">Total Amount *</Label>
              <p className="text-2xl font-bold">
                ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Additional Fields */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="submitted_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submitted Date</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      {...field}
                      type="date"
                      value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = new Date(e.target.value)
                        field.onChange(format(date, 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''))
                      }}
                    />
                    <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || totalAmount === 0}
          >
            {isLoading ? 'Saving...' : mode === 'create' ? 'Submit Change Order' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}