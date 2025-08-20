'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { CircleAlert, CircleCheck, Loader2, Save, AlertTriangle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface EmployeeToFix {
  employee_number: string
  first_name: string
  last_name: string
  base_rate?: number
  craft_type_id?: string
  id?: string
  error_message?: string
}

interface BulkEmployeeFixProps {
  employees: EmployeeToFix[]
  onComplete?: (fixedEmployees: EmployeeToFix[]) => void
  onCancel?: () => void
  autoRetry?: boolean
}

interface EmployeeEditState {
  base_rate: string
  craft_type_id: string
  hasChanges: boolean
  isValid: boolean
  isSaving: boolean
  isSaved: boolean
  error?: string
}

export function BulkEmployeeFix({ 
  employees, 
  onComplete,
  onCancel,
  autoRetry = false
}: BulkEmployeeFixProps) {
  // Deduplicate employees to prevent React key errors and state conflicts
  const uniqueEmployees = useMemo(() => {
    const seen = new Set<string>()
    const deduped = employees.filter(emp => {
      if (seen.has(emp.employee_number)) {
        console.warn(`[BulkEmployeeFix] Duplicate employee filtered: ${emp.employee_number}`)
        return false
      }
      seen.add(emp.employee_number)
      return true
    })
    
    if (deduped.length < employees.length) {
      console.log(`[BulkEmployeeFix] Deduplicated ${employees.length} employees to ${deduped.length}`)
    }
    
    return deduped
  }, [employees])

  const [editStates, setEditStates] = useState<Record<string, EmployeeEditState>>({})
  const [saveProgress, setSaveProgress] = useState(0)
  const [isSavingAll, setIsSavingAll] = useState(false)

  // Fetch craft types
  const { data: craftTypesData, isLoading: loadingCraftTypes } = useQuery({
    queryKey: ['craft-types'],
    queryFn: async () => {
      const response = await fetch('/api/craft-types')
      if (!response.ok) throw new Error('Failed to fetch craft types')
      return response.json()
    }
  })

  // Fetch existing employee data
  const { data: existingEmployees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-batch', uniqueEmployees.map(e => e.employee_number)],
    queryFn: async () => {
      const response = await fetch('/api/employees/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: uniqueEmployees.map(e => e.employee_number)
        })
      })
      if (!response.ok) throw new Error('Failed to fetch employees')
      return response.json()
    },
    enabled: uniqueEmployees.length > 0
  })

  // Initialize edit states
  useEffect(() => {
    if (existingEmployees?.employees) {
      const newStates: Record<string, EmployeeEditState> = {}
      
      uniqueEmployees.forEach(emp => {
        const existing = existingEmployees.employees.find(
          (e: { employeeNumber: string; baseRate?: number; craftTypeId?: string }) => e.employeeNumber === emp.employee_number
        )
        
        newStates[emp.employee_number] = {
          base_rate: existing?.baseRate?.toString() || emp.base_rate?.toString() || '0',
          craft_type_id: existing?.craftTypeId || emp.craft_type_id || '',
          hasChanges: false,
          isValid: false,
          isSaving: false,
          isSaved: false
        }
      })
      
      setEditStates(newStates)
    }
  }, [existingEmployees, uniqueEmployees])

  // Update individual employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ 
      employeeNumber, 
      data 
    }: { 
      employeeNumber: string
      data: { base_rate: number; craft_type_id: string; reason: string }
    }) => {
      // Find employee ID
      const existing = existingEmployees?.employees.find(
        (e: { employeeNumber: string; id?: string }) => e.employeeNumber === employeeNumber
      )
      
      if (!existing?.id) {
        // Try to find by searching
        const searchResponse = await fetch('/api/employees?' + new URLSearchParams({
          search: employeeNumber
        }))
        if (!searchResponse.ok) throw new Error('Failed to find employee')
        const searchData = await searchResponse.json()
        const found = searchData.employees?.find((e: { employeeNumber: string; id?: string }) => 
          e.employeeNumber === employeeNumber
        )
        if (!found?.id) throw new Error('Employee not found')
        existing.id = found.id
      }

      const response = await fetch(`/api/employees/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update employee')
      }

      return response.json()
    }
  })

  const handleRateChange = (employeeNumber: string, value: string) => {
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setEditStates(prev => ({
        ...prev,
        [employeeNumber]: {
          ...prev[employeeNumber],
          base_rate: value,
          hasChanges: true,
          isValid: parseFloat(value) > 0 && !!prev[employeeNumber].craft_type_id
        }
      }))
    }
  }

  const handleCraftTypeChange = (employeeNumber: string, value: string) => {
    setEditStates(prev => ({
      ...prev,
      [employeeNumber]: {
        ...prev[employeeNumber],
        craft_type_id: value,
        hasChanges: true,
        isValid: parseFloat(prev[employeeNumber].base_rate) > 0 && !!value
      }
    }))
  }

  const saveEmployee = async (employeeNumber: string) => {
    const state = editStates[employeeNumber]
    if (!state || !state.isValid) return

    setEditStates(prev => ({
      ...prev,
      [employeeNumber]: {
        ...prev[employeeNumber],
        isSaving: true,
        error: undefined
      }
    }))

    try {
      await updateEmployeeMutation.mutateAsync({
        employeeNumber,
        data: {
          base_rate: parseFloat(state.base_rate),
          craft_type_id: state.craft_type_id,
          reason: 'Bulk labor import data fix'
        }
      })

      setEditStates(prev => ({
        ...prev,
        [employeeNumber]: {
          ...prev[employeeNumber],
          isSaving: false,
          isSaved: true,
          hasChanges: false
        }
      }))
    } catch (error) {
      setEditStates(prev => ({
        ...prev,
        [employeeNumber]: {
          ...prev[employeeNumber],
          isSaving: false,
          error: error instanceof Error ? error.message : 'Failed to save'
        }
      }))
    }
  }

  const saveAll = async () => {
    setIsSavingAll(true)
    setSaveProgress(0)
    
    const toSave = uniqueEmployees.filter(emp => {
      const state = editStates[emp.employee_number]
      return state?.isValid && !state.isSaved
    })

    let savedCount = 0
    for (const emp of toSave) {
      await saveEmployee(emp.employee_number)
      savedCount++
      setSaveProgress((savedCount / toSave.length) * 100)
    }

    setIsSavingAll(false)
    
    // Check if all are saved
    const allSaved = uniqueEmployees.every(emp => 
      editStates[emp.employee_number]?.isSaved
    )
    
    if (allSaved && onComplete) {
      setTimeout(() => {
        onComplete(employees)
      }, 1000)
    }
  }

  const validCount = Object.values(editStates).filter(s => s.isValid && !s.isSaved).length
  const savedCount = Object.values(editStates).filter(s => s.isSaved).length
  const totalCount = uniqueEmployees.length

  const isLoading = loadingCraftTypes || loadingEmployees

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Fix Employee Data</h3>
        <p className="text-sm text-muted-foreground">
          Update the missing information for these employees to continue with the labor import.
        </p>
      </div>

      {savedCount === totalCount ? (
        <div className="py-8 text-center">
          <CircleCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">All employees updated successfully!</p>
          <p className="text-sm text-muted-foreground">
            {autoRetry 
              ? 'Retrying import automatically with the updated data...'
              : 'You can now retry the import with the updated data.'}
          </p>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          {isSavingAll && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Saving employees...</span>
                <span className="text-sm font-medium">{Math.round(saveProgress)}%</span>
              </div>
              <Progress value={saveProgress} className="h-2" />
            </div>
          )}

          {/* Status Summary */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Pending: {totalCount - savedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Saved: {savedCount}</span>
            </div>
            {validCount > 0 && (
              <div className="flex items-center gap-2 text-blue-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{validCount} ready to save</span>
              </div>
            )}
          </div>

          {/* Employee Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[150px]">Base Rate ($/hr)</TableHead>
                  <TableHead className="w-[200px]">Craft Type</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueEmployees.map((emp, index) => {
                  const state = editStates[emp.employee_number] || {
                    base_rate: '0',
                    craft_type_id: '',
                    hasChanges: false,
                    isValid: false,
                    isSaving: false,
                    isSaved: false
                  }
                  
                  return (
                    <TableRow key={`${emp.employee_number}-${index}`}>
                      <TableCell className="font-mono text-sm">
                        {emp.employee_number}
                      </TableCell>
                      <TableCell>
                        {emp.last_name}, {emp.first_name}
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            $
                          </span>
                          <Input
                            type="text"
                            value={state.base_rate}
                            onChange={(e) => handleRateChange(emp.employee_number, e.target.value)}
                            className="pl-6 h-8"
                            placeholder="0.00"
                            disabled={state.isSaving || state.isSaved || isLoading}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={state.craft_type_id}
                          onValueChange={(value) => handleCraftTypeChange(emp.employee_number, value)}
                          disabled={state.isSaving || state.isSaved || isLoading}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {craftTypesData
                              ?.filter((craft: { id: string; name: string; code: string; category: string }) => 
                                ['Direct Labor', 'Indirect Labor', 'Staff Labor'].includes(craft.name) ||
                                ['DIRECT', 'INDIRECT', 'STAFF'].includes(craft.code) ||
                                ['Direct', 'Indirect', 'Staff'].includes(craft.name)
                              )
                              ?.map((craft: { id: string; name: string; code: string }) => (
                                <SelectItem key={craft.id} value={craft.id}>
                                  {craft.name} ({craft.code})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {state.isSaved ? (
                          <span className="flex items-center text-green-600 text-sm">
                            <CircleCheck className="h-4 w-4 mr-1" />
                            Saved
                          </span>
                        ) : state.error ? (
                          <span className="flex items-center text-red-600 text-sm" title={state.error}>
                            <CircleAlert className="h-4 w-4 mr-1" />
                            Error
                          </span>
                        ) : state.isSaving ? (
                          <span className="flex items-center text-blue-600 text-sm">
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Saving
                          </span>
                        ) : state.hasChanges ? (
                          <span className="text-yellow-600 text-sm">Modified</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEmployee(emp.employee_number)}
                          disabled={!state.isValid || state.isSaving || state.isSaved}
                        >
                          {state.isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Error Messages */}
          {Object.entries(editStates).some(([, state]) => state.error) && (
            <Alert variant="destructive" className="mt-4">
              <CircleAlert className="h-4 w-4" />
              <AlertDescription>
                Some employees could not be saved. Please check the errors and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={onCancel} disabled={isSavingAll}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                disabled={isSavingAll || savedCount === 0}
              >
                Refresh Data
              </Button>
              <Button
                onClick={saveAll}
                disabled={validCount === 0 || isSavingAll}
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving {validCount} Employees...
                  </>
                ) : (
                  <>Save All Valid ({validCount})</>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}