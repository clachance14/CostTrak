'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface UpdatedEmployee {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  baseRate: number
  craftType: {
    id: string
    name: string
    code: string
    category: string
  }
}

interface EmployeeDataFixModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: {
    id?: string
    employee_number: string
    first_name: string
    last_name: string
    base_rate?: number
    craft_type_id?: string
    category?: string
  }
  onSuccess?: (updatedEmployee: UpdatedEmployee) => void
  reason?: string
}

export function EmployeeDataFixModal({
  open,
  onOpenChange,
  employee,
  onSuccess,
  reason = 'Labor import data fix'
}: EmployeeDataFixModalProps) {
  const [baseRate, setBaseRate] = useState<string>(employee.base_rate?.toString() || '0')
  const [craftTypeId, setCraftTypeId] = useState<string>(employee.craft_type_id || '')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string>('')

  // Fetch employee data if we have an ID
  const { data: employeeData, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employee.id],
    queryFn: async () => {
      if (!employee.id) {
        // Try to find employee by employee_number
        const response = await fetch('/api/employees?' + new URLSearchParams({
          search: employee.employee_number
        }))
        if (!response.ok) throw new Error('Failed to fetch employee')
        const data = await response.json()
        const found = data.employees?.find((e: UpdatedEmployee) => 
          e.employeeNumber === employee.employee_number
        )
        return found ? { employee: found } : null
      }
      
      const response = await fetch(`/api/employees/${employee.id}`)
      if (!response.ok) throw new Error('Failed to fetch employee')
      return response.json()
    },
    enabled: open && (!!employee.id || !!employee.employee_number)
  })

  // Fetch craft types
  const { data: craftTypesData } = useQuery({
    queryKey: ['craft-types'],
    queryFn: async () => {
      const response = await fetch('/api/craft-types')
      if (!response.ok) throw new Error('Failed to fetch craft types')
      return response.json()
    },
    enabled: open
  })

  // Update form when employee data loads
  useEffect(() => {
    if (employeeData?.employee) {
      setBaseRate(employeeData.employee.baseRate?.toString() || '0')
      setCraftTypeId(employeeData.employee.craftType?.id || '')
      setSelectedCategory(employeeData.employee.craftType?.category || '')
    }
  }, [employeeData])

  // Update category when craft type changes
  useEffect(() => {
    if (craftTypeId && craftTypesData?.craftTypes) {
      const craft = craftTypesData.craftTypes.find((c: { id: string; category: string }) => c.id === craftTypeId)
      if (craft) {
        setSelectedCategory(craft.category)
      }
    }
  }, [craftTypeId, craftTypesData])

  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      base_rate: number
      craft_type_id: string
      reason: string
    }) => {
      const employeeId = employeeData?.employee?.id || employee.id
      if (!employeeId) {
        throw new Error('Employee ID not found')
      }

      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update employee')
      }

      return response.json()
    },
    onSuccess: (data) => {
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onOpenChange(false)
        if (onSuccess) {
          onSuccess(data.employee)
        }
      }, 1500)
    },
    onError: (error) => {
      setValidationError(error.message)
    }
  })

  const handleSubmit = () => {
    // Validate inputs
    const rate = parseFloat(baseRate)
    if (isNaN(rate) || rate < 0) {
      setValidationError('Please enter a valid base rate')
      return
    }

    if (!craftTypeId) {
      setValidationError('Please select a craft type')
      return
    }

    setValidationError('')
    updateMutation.mutate({
      base_rate: rate,
      craft_type_id: craftTypeId,
      reason
    })
  }

  const handleRateChange = (value: string) => {
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setBaseRate(value)
      setValidationError('')
    }
  }

  const calculatedBurdenRate = parseFloat(baseRate || '0') * 1.28

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Fix Missing Employee Data</DialogTitle>
          <DialogDescription>
            Update the missing information for this employee to continue with the labor import.
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="py-8 text-center">
            <CircleCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Employee data updated successfully!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Employee Info (Read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Employee Number</Label>
                  <p className="font-medium">{employee.employee_number}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="font-medium">
                    {employee.last_name}, {employee.first_name}
                  </p>
                </div>
              </div>

              {/* Base Rate Input */}
              <div className="space-y-2">
                <Label htmlFor="base-rate">
                  Base Rate ($/hour) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="base-rate"
                    type="text"
                    value={baseRate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="pl-8"
                    placeholder="0.00"
                    disabled={updateMutation.isPending || loadingEmployee}
                  />
                </div>
                {baseRate && parseFloat(baseRate) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    With 28% burden: {formatCurrency(calculatedBurdenRate)}/hour
                  </p>
                )}
              </div>

              {/* Craft Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="craft-type">
                  Craft Type <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={craftTypeId} 
                  onValueChange={setCraftTypeId}
                  disabled={updateMutation.isPending || loadingEmployee}
                >
                  <SelectTrigger id="craft-type">
                    <SelectValue placeholder="Select craft type" />
                  </SelectTrigger>
                  <SelectContent>
                    {craftTypesData?.craftTypes?.map((craft: { id: string; name: string; code: string; category: string }) => (
                      <SelectItem key={craft.id} value={craft.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{craft.name} ({craft.code})</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {craft.category}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategory && (
                  <p className="text-sm text-muted-foreground">
                    Category: <span className="font-medium capitalize">{selectedCategory}</span>
                  </p>
                )}
              </div>

              {/* Error Alert */}
              {validationError && (
                <Alert variant="destructive">
                  <CircleAlert className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {/* Info Alert */}
              <Alert>
                <CircleAlert className="h-4 w-4" />
                <AlertDescription>
                  This information will be saved to the employee record and used for all future 
                  labor imports. The change will be logged in the audit trail.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  updateMutation.isPending || 
                  loadingEmployee ||
                  !baseRate || 
                  parseFloat(baseRate) <= 0 || 
                  !craftTypeId
                }
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Employee'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}