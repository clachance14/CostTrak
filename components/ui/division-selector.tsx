"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Star, X, Plus, AlertCircle } from 'lucide-react'
import type { Division, User } from '@/types/api'

export interface DivisionAssignment {
  division_id: string
  division_name: string
  division_pm_id?: string
  division_pm_name?: string
  is_lead_division: boolean
  budget_allocated: number
}

interface DivisionSelectorProps {
  divisions: Division[]
  projectManagers: User[]
  selectedDivisions: DivisionAssignment[]
  onChange: (divisions: DivisionAssignment[]) => void
  totalBudget?: number
  showBudgetAllocation?: boolean
}

export function DivisionSelector({
  divisions,
  projectManagers,
  selectedDivisions,
  onChange,
  totalBudget = 0,
  showBudgetAllocation = true
}: DivisionSelectorProps) {
  const [availableDivisions, setAvailableDivisions] = useState<Division[]>([])
  
  useEffect(() => {
    // Filter out already selected divisions
    const selectedIds = selectedDivisions.map(d => d.division_id)
    setAvailableDivisions(divisions.filter(d => !selectedIds.includes(d.id)))
  }, [divisions, selectedDivisions])

  // Ensure at least one lead division
  useEffect(() => {
    if (selectedDivisions.length > 0 && !selectedDivisions.some(d => d.is_lead_division)) {
      const updated = [...selectedDivisions]
      updated[0].is_lead_division = true
      onChange(updated)
    }
  }, [selectedDivisions, onChange])

  const addDivision = (divisionId: string) => {
    const division = divisions.find(d => d.id === divisionId)
    if (!division) return

    const newAssignment: DivisionAssignment = {
      division_id: division.id,
      division_name: `${division.name} (${division.code})`,
      is_lead_division: selectedDivisions.length === 0, // First division is lead by default
      budget_allocated: 0
    }

    onChange([...selectedDivisions, newAssignment])
  }

  const removeDivision = (divisionId: string) => {
    const wasLead = selectedDivisions.find(d => d.division_id === divisionId)?.is_lead_division
    const updated = selectedDivisions.filter(d => d.division_id !== divisionId)
    
    // If we removed the lead division, make the first one lead
    if (wasLead && updated.length > 0) {
      updated[0].is_lead_division = true
    }
    
    onChange(updated)
  }

  const updateDivision = (divisionId: string, updates: Partial<DivisionAssignment>) => {
    const updated = selectedDivisions.map(d => {
      if (d.division_id === divisionId) {
        return { ...d, ...updates }
      }
      // If setting a new lead, unset others
      if (updates.is_lead_division && d.is_lead_division) {
        return { ...d, is_lead_division: false }
      }
      return d
    })
    onChange(updated)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const totalAllocated = selectedDivisions.reduce((sum, d) => sum + d.budget_allocated, 0)
  const unallocated = totalBudget - totalAllocated

  // Format PM options for autocomplete
  const pmOptions = projectManagers.map(pm => ({
    id: pm.id,
    label: `${pm.first_name} ${pm.last_name}`,
    value: pm.id
  }))

  return (
    <div className="space-y-4">
      {/* Add Division Button */}
      <div className="flex items-center gap-4">
        <Select value="" onValueChange={addDivision}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Add division..." />
          </SelectTrigger>
          <SelectContent>
            {availableDivisions.map(division => (
              <SelectItem key={division.id} value={division.id}>
                {division.name} ({division.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedDivisions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Select at least one division for this project
          </p>
        )}
      </div>

      {/* Selected Divisions */}
      {selectedDivisions.length > 0 && (
        <div className="space-y-3">
          {selectedDivisions.map((assignment) => (
            <Card key={assignment.division_id} className="p-4">
              <div className="space-y-3">
                {/* Division Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{assignment.division_name}</h4>
                    {assignment.is_lead_division && (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" />
                        Lead
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!assignment.is_lead_division && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateDivision(assignment.division_id, { is_lead_division: true })}
                      >
                        Set as Lead
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDivision(assignment.division_id)}
                      disabled={selectedDivisions.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Division PM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Division Project Manager</Label>
                    <AutocompleteInput
                      value={assignment.division_pm_name || ''}
                      onChange={(value, option) => {
                        updateDivision(assignment.division_id, {
                          division_pm_name: value,
                          division_pm_id: option?.value || undefined
                        })
                      }}
                      options={pmOptions}
                      placeholder="Select PM for this division"
                    />
                  </div>

                  {/* Budget Allocation */}
                  {showBudgetAllocation && (
                    <div className="space-y-2">
                      <Label className="text-sm">Budget Allocation</Label>
                      <Input
                        type="number"
                        value={assignment.budget_allocated || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          updateDivision(assignment.division_id, { budget_allocated: value })
                        }}
                        placeholder="$0"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Budget Summary */}
          {showBudgetAllocation && totalBudget > 0 && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Budget:</span>
                  <span className="font-medium">{formatCurrency(totalBudget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Allocated:</span>
                  <span className="font-medium">{formatCurrency(totalAllocated)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between">
                  <span className="font-medium">Unallocated:</span>
                  <span className={`font-bold ${unallocated < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(unallocated)}
                  </span>
                </div>
                {unallocated < 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Over-allocated by {formatCurrency(Math.abs(unallocated))}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}