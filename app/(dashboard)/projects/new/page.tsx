"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { Separator } from "@/components/ui/separator"
import { StepIndicator } from "@/components/ui/step-indicator"
import { POLineItemInput, type POLineItem } from "@/components/ui/po-line-item-input"
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Division, Client, User } from '@/types/api'
import * as XLSX from 'xlsx'

interface FormData {
  // Project Information
  icsProjectNumber: string
  projectTitle: string
  projectManagerName: string
  projectManagerId: string
  division: string
  divisionId: string
  clientName: string
  clientId: string
  clientRepresentative: string

  // Contract Information
  clientPONumber: string
  poLineItems: POLineItem[]

  // Budget Breakdown
  budgetSource: 'manual' | 'import'
  labor: number
  smallToolsConsumables: number
  materials: number
  equipment: number
  subcontracts: number
  otherBudget: number
  budgetBreakdowns: Array<{
    discipline: string
    cost_type: string
    manhours: number | null
    value: number
  }>
}

interface BudgetPreview {
  disciplines: Array<{
    name: string
    items: Array<{
      cost_type: string
      manhours: number | null
      value: number
    }>
    total: number
  }>
  totalBudget: number
  isValid: boolean
  errors: string[]
}

const STEPS = [
  { id: 1, title: 'Project Info', description: 'Basic details' },
  { id: 2, title: 'Contract', description: 'PO line items' },
  { id: 3, title: 'Budget', description: 'Cost breakdown' },
  { id: 4, title: 'Review', description: 'Confirm & submit' },
]

export default function ProjectSetupForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [budgetFile, setBudgetFile] = useState<File | null>(null)
  const [budgetPreview, setBudgetPreview] = useState<BudgetPreview | null>(null)
  const [formData, setFormData] = useState<FormData>({
    icsProjectNumber: "",
    projectTitle: "",
    projectManagerName: "",
    projectManagerId: "",
    division: "",
    divisionId: "",
    clientName: "",
    clientId: "",
    clientRepresentative: "",
    clientPONumber: "",
    poLineItems: [{ id: `line-${Date.now()}`, description: '', amount: 0 }],
    budgetSource: 'manual',
    labor: 0,
    smallToolsConsumables: 0,
    materials: 0,
    equipment: 0,
    subcontracts: 0,
    otherBudget: 0,
    budgetBreakdowns: [],
  })

  // Fetch divisions
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const response = await fetch('/api/divisions')
      if (!response.ok) return []
      const data = await response.json()
      return data.divisions || []
    }
  })

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients')
      if (!response.ok) return []
      const data = await response.json()
      return data.clients || []
    }
  })

  // Fetch project managers
  const { data: projectManagers } = useQuery({
    queryKey: ['project-managers'],
    queryFn: async () => {
      const response = await fetch('/api/users?role=project_manager')
      if (!response.ok) return []
      const data = await response.json()
      return data.users || []
    }
  })

  // Auto-calculated values
  const totalContractAmount = formData.poLineItems.reduce((sum, item) => sum + item.amount, 0)
  const totalEstimatedJobCost =
    formData.labor +
    formData.smallToolsConsumables +
    formData.materials +
    formData.equipment +
    formData.subcontracts +
    formData.otherBudget
  const estimatedGrossProfit = totalContractAmount - totalEstimatedJobCost
  const estimatedProfitMargin = totalContractAmount > 0 ? (estimatedGrossProfit / totalContractAmount) * 100 : 0

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Auto-create functions
  const createNewProjectManager = async (name: string) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        role: 'project_manager',
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@temp.ics.ac`
      })
    })
    if (!response.ok) throw new Error('Failed to create project manager')
    const data = await response.json()
    return { id: data.user.id, label: name, value: data.user.id }
  }

  const createNewDivision = async (name: string) => {
    const code = name.slice(0, 3).toUpperCase()
    const response = await fetch('/api/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code })
    })
    if (!response.ok) throw new Error('Failed to create division')
    const data = await response.json()
    return { id: data.division.id, label: `${name} (${code})`, value: data.division.id }
  }

  const createNewClient = async (name: string) => {
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!response.ok) throw new Error('Failed to create client')
    const data = await response.json()
    return { id: data.client.id, label: name, value: data.client.id }
  }

  // Format data for autocomplete
  const projectManagerOptions = projectManagers?.map((user: User) => ({
    id: user.id,
    label: `${user.first_name} ${user.last_name}`,
    value: user.id
  })) || []

  const divisionOptions = divisions?.map((division: Division) => ({
    id: division.id,
    label: `${division.name} (${division.code})`,
    value: division.id
  })) || []

  const clientOptions = clients?.map((client: Client) => ({
    id: client.id,
    label: client.name,
    value: client.id
  })) || []

  const handleCurrencyChange = (field: keyof FormData, value: string) => {
    const numericValue = Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
    handleInputChange(field, numericValue)
  }

  // Step navigation
  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        const step1Valid = (
          formData.icsProjectNumber &&
          formData.projectTitle &&
          formData.projectManagerId &&
          formData.divisionId &&
          formData.clientId
        )
        
        // Debug logging
        console.log('Step 1 validation:', {
          icsProjectNumber: formData.icsProjectNumber,
          projectTitle: formData.projectTitle,
          projectManagerId: formData.projectManagerId,
          divisionId: formData.divisionId,
          clientId: formData.clientId,
          valid: step1Valid
        })
        
        return step1Valid
      case 2:
        return (
          formData.poLineItems.length > 0 &&
          formData.poLineItems.every(item => item.description && item.amount > 0)
        )
      case 3:
        return totalEstimatedJobCost > 0
      default:
        return true
    }
  }

  const goToNextStep = () => {
    if (canProceedToNext() && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Budget file handling
  const handleBudgetFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setBudgetFile(selectedFile)
    setBudgetPreview(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      if (!workbook.SheetNames.includes('BUDGETS')) {
        setBudgetPreview({
          disciplines: [],
          totalBudget: 0,
          isValid: false,
          errors: ['No BUDGETS sheet found in Excel file.']
        })
        return
      }
      
      const worksheet = workbook.Sheets['BUDGETS']
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      const rows: unknown[][] = []
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row: unknown[] = []
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = worksheet[cellAddress]
          row.push(cell ? cell.v : undefined)
        }
        rows.push(row)
      }

      // Process budget data
      const disciplines = new Map<string, Array<{cost_type: string; manhours: number | null; value: number}>>()
      const budgetBreakdowns: Array<{discipline: string; cost_type: string; manhours: number | null; value: number}> = []
      let currentDiscipline = ''
      let totalBudget = 0
      const categoryTotals = {
        labor: 0,
        materials: 0,
        equipment: 0,
        subcontracts: 0,
        small_tools_consumables: 0,
        other: 0
      }
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const disciplineName = row[1]
        const description = row[3]?.toString() || ''
        const manhours = row[4]
        const value = row[5]
        
        if (!description || !value) continue
        
        if (disciplineName && typeof disciplineName === 'string' && disciplineName.trim()) {
          currentDiscipline = disciplineName.trim().toUpperCase()
        }
        
        if (!currentDiscipline) continue
        
        if (description.toUpperCase().includes('TOTAL') || 
            description.toUpperCase() === 'ALL LABOR') continue
        
        const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[$,]/g, '') || '0')
        const numericManhours = manhours ? (typeof manhours === 'number' ? manhours : parseFloat(manhours.toString() || '0')) : null
        
        if (!disciplines.has(currentDiscipline)) {
          disciplines.set(currentDiscipline, [])
        }
        
        const item = {
          cost_type: description.trim(),
          manhours: numericManhours,
          value: numericValue
        }
        
        disciplines.get(currentDiscipline)!.push(item)
        budgetBreakdowns.push({
          discipline: currentDiscipline,
          ...item
        })
        
        totalBudget += numericValue
        
        // Map to categories
        const costType = description.trim().toUpperCase()
        if (costType.includes('LABOR')) {
          categoryTotals.labor += numericValue
        } else if (costType === 'MATERIALS') {
          categoryTotals.materials += numericValue
        } else if (costType === 'EQUIPMENT') {
          categoryTotals.equipment += numericValue
        } else if (costType === 'SUBCONTRACTS') {
          categoryTotals.subcontracts += numericValue
        } else if (costType === 'SMALL TOOLS & CONSUMABLES') {
          categoryTotals.small_tools_consumables += numericValue
        } else {
          categoryTotals.other += numericValue
        }
      }

      const disciplineArray = Array.from(disciplines.entries()).map(([name, items]) => ({
        name,
        items,
        total: items.reduce((sum, item) => sum + item.value, 0)
      }))

      setBudgetPreview({
        disciplines: disciplineArray,
        totalBudget,
        isValid: disciplineArray.length > 0,
        errors: disciplineArray.length === 0 ? ['No valid budget data found'] : []
      })
      
      // Update form data with imported values
      if (disciplineArray.length > 0) {
        setFormData(prev => ({
          ...prev,
          budgetSource: 'import',
          labor: categoryTotals.labor,
          materials: categoryTotals.materials,
          equipment: categoryTotals.equipment,
          subcontracts: categoryTotals.subcontracts,
          smallToolsConsumables: categoryTotals.small_tools_consumables,
          otherBudget: categoryTotals.other,
          budgetBreakdowns
        }))
      }
    } catch {
      setBudgetPreview({
        disciplines: [],
        totalBudget: 0,
        isValid: false,
        errors: ['Failed to parse Excel file']
      })
    }
  }, [])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.projectTitle,
          job_number: formData.icsProjectNumber,
          client_id: formData.clientId,
          division_id: formData.divisionId,
          project_manager_id: formData.projectManagerId,
          superintendent_id: formData.projectManagerId,
          original_contract: totalContractAmount,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'planning',
          budget: {
            labor_budget: formData.labor,
            small_tools_consumables_budget: formData.smallToolsConsumables,
            materials_budget: formData.materials,
            equipment_budget: formData.equipment,
            subcontracts_budget: formData.subcontracts,
            other_budget: formData.otherBudget,
          },
          contract_breakdown: {
            client_po_number: formData.clientPONumber,
            client_representative: formData.clientRepresentative,
            uses_line_items: true,
          },
          po_line_items: formData.poLineItems.map((item, index) => ({
            line_number: index + 1,
            description: item.description,
            amount: item.amount
          })),
          budget_breakdowns: formData.budgetSource === 'import' ? formData.budgetBreakdowns : [],
          budget_source: formData.budgetSource
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to create project')
        return
      }

      const { project } = await response.json()
      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      alert('An error occurred while creating the project')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render functions for each step
  const renderProjectInfo = () => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Project Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="icsProjectNumber">ICS Project Number</Label>
            <Input
              id="icsProjectNumber"
              value={formData.icsProjectNumber}
              onChange={(e) => handleInputChange("icsProjectNumber", e.target.value)}
              placeholder="Enter project number"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input
              id="projectTitle"
              value={formData.projectTitle}
              onChange={(e) => handleInputChange("projectTitle", e.target.value)}
              placeholder="Enter project title"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="projectManagerName">Project Manager</Label>
            <AutocompleteInput
              value={formData.projectManagerName}
              onChange={(value, option) => {
                console.log('Project Manager onChange:', { value, option })
                setFormData(prev => ({
                  ...prev,
                  projectManagerName: value,
                  projectManagerId: option?.value || ''
                }))
              }}
              options={projectManagerOptions}
              placeholder="Enter or select project manager"
              onCreateNew={createNewProjectManager}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="division">Division</Label>
            <AutocompleteInput
              value={formData.division}
              onChange={(value, option) => {
                console.log('Division onChange:', { value, option })
                setFormData(prev => ({
                  ...prev,
                  division: value,
                  divisionId: option?.value || ''
                }))
              }}
              options={divisionOptions}
              placeholder="Enter or select division"
              onCreateNew={createNewDivision}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <AutocompleteInput
              value={formData.clientName}
              onChange={(value, option) => {
                console.log('Client onChange:', { value, option })
                setFormData(prev => ({
                  ...prev,
                  clientName: value,
                  clientId: option?.value || ''
                }))
              }}
              options={clientOptions}
              placeholder="Enter or select client"
              onCreateNew={createNewClient}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientRepresentative">Client Representative</Label>
            <Input
              id="clientRepresentative"
              value={formData.clientRepresentative}
              onChange={(e) => handleInputChange("clientRepresentative", e.target.value)}
              placeholder="Enter client representative"
            />
          </div>
        </div>
        
        {/* Debug Display - Remove after fixing */}
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold mb-2">Debug Info:</h4>
          <div className="text-sm space-y-1">
            <div>ICS Project Number: &quot;{formData.icsProjectNumber}&quot;</div>
            <div>Project Title: &quot;{formData.projectTitle}&quot;</div>
            <div>Project Manager Name: &quot;{formData.projectManagerName}&quot;</div>
            <div>Project Manager ID: &quot;{formData.projectManagerId}&quot;</div>
            <div>Division: &quot;{formData.division}&quot;</div>
            <div>Division ID: &quot;{formData.divisionId}&quot;</div>
            <div>Client Name: &quot;{formData.clientName}&quot;</div>
            <div>Client ID: &quot;{formData.clientId}&quot;</div>
            <div>Can Proceed: {canProceedToNext() ? 'YES' : 'NO'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderContractInfo = () => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Contract Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientPONumber">Client PO Number</Label>
          <Input
            id="clientPONumber"
            value={formData.clientPONumber}
            onChange={(e) => handleInputChange("clientPONumber", e.target.value)}
            placeholder="Enter PO number"
          />
        </div>

        <Separator />

        <div>
          <Label className="text-base font-semibold mb-4 block">PO Line Items</Label>
          <POLineItemInput
            items={formData.poLineItems}
            onChange={(items) => handleInputChange("poLineItems", items)}
          />
        </div>
      </CardContent>
    </Card>
  )

  const renderBudgetBreakdown = () => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Budget Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Source Toggle */}
        <div className="flex gap-4 mb-6">
          <Button
            type="button"
            variant={formData.budgetSource === 'manual' ? 'default' : 'outline'}
            onClick={() => setFormData(prev => ({ ...prev, budgetSource: 'manual' }))}
          >
            Manual Entry
          </Button>
          <Button
            type="button"
            variant={formData.budgetSource === 'import' ? 'default' : 'outline'}
            onClick={() => setFormData(prev => ({ ...prev, budgetSource: 'import' }))}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import from Excel
          </Button>
        </div>

        {formData.budgetSource === 'import' ? (
          <div className="space-y-4">
            {/* File Upload */}
            <div className="border-2 border-dashed border-foreground/30 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBudgetFileSelect}
                className="hidden"
                id="budget-file-upload"
              />
              <label htmlFor="budget-file-upload" className="cursor-pointer">
                <FileSpreadsheet className="h-12 w-12 text-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  {budgetFile ? budgetFile.name : 'Click to upload budget Excel file'}
                </p>
                <p className="text-sm text-foreground/80">File must contain a BUDGETS sheet</p>
              </label>
            </div>

            {/* Preview */}
            {budgetPreview && budgetPreview.isValid && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800">Import Summary</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    Total Budget: {formatCurrency(budgetPreview.totalBudget)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/80">Disciplines:</p>
                  {budgetPreview.disciplines.map((discipline, i) => (
                    <div key={i} className="bg-background p-3 rounded border border-foreground/10">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{discipline.name}</span>
                        <span className="text-sm text-foreground/60">
                          {formatCurrency(discipline.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {budgetPreview && !budgetPreview.isValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Import Error</p>
                {budgetPreview.errors.map((error, i) => (
                  <p key={i} className="text-sm text-red-600 mt-1">{error}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <h4 className="font-medium text-foreground/80 border-b pb-2">Description</h4>
              <h4 className="font-medium text-foreground/80 border-b pb-2">Original Estimate</h4>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Labor</Label>
                <Input
                  type="text"
                  value={formData.labor > 0 ? formData.labor.toString() : ""}
                  onChange={(e) => handleCurrencyChange("labor", e.target.value)}
                  placeholder="$0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Small Tools & Consumables</Label>
                <Input
                  type="text"
                  value={formData.smallToolsConsumables > 0 ? formData.smallToolsConsumables.toString() : ""}
                  onChange={(e) => handleCurrencyChange("smallToolsConsumables", e.target.value)}
                  placeholder="$0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Materials</Label>
                <Input
                  type="text"
                  value={formData.materials > 0 ? formData.materials.toString() : ""}
                  onChange={(e) => handleCurrencyChange("materials", e.target.value)}
                  placeholder="$0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Equipment</Label>
                <Input
                  type="text"
                  value={formData.equipment > 0 ? formData.equipment.toString() : ""}
                  onChange={(e) => handleCurrencyChange("equipment", e.target.value)}
                  placeholder="$0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Subcontracts</Label>
                <Input
                  type="text"
                  value={formData.subcontracts > 0 ? formData.subcontracts.toString() : ""}
                  onChange={(e) => handleCurrencyChange("subcontracts", e.target.value)}
                  placeholder="$0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Label>Other Budget</Label>
                <Input
                  type="text"
                  value={formData.otherBudget > 0 ? formData.otherBudget.toString() : ""}
                  onChange={(e) => handleCurrencyChange("otherBudget", e.target.value)}
                  placeholder="$0 (optional)"
                />
              </div>
            </div>

            <Separator />

            <div className="bg-background p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Total Estimated Job Cost</Label>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(totalEstimatedJobCost)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderReviewSubmit = () => (
    <div className="space-y-6">
      {/* Project Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Review Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-foreground/60">Project Number</p>
              <p className="font-medium">{formData.icsProjectNumber}</p>
            </div>
            <div>
              <p className="text-foreground/60">Project Title</p>
              <p className="font-medium">{formData.projectTitle}</p>
            </div>
            <div>
              <p className="text-foreground/60">Client</p>
              <p className="font-medium">{formData.clientName}</p>
            </div>
            <div>
              <p className="text-foreground/60">Division</p>
              <p className="font-medium">{formData.division}</p>
            </div>
            <div>
              <p className="text-foreground/60">Project Manager</p>
              <p className="font-medium">{formData.projectManagerName}</p>
            </div>
            <div>
              <p className="text-foreground/60">Client Representative</p>
              <p className="font-medium">{formData.clientRepresentative || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-foreground/60">PO Number: {formData.clientPONumber || 'N/A'}</p>
            <div className="space-y-1">
              {formData.poLineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.description}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Contract</span>
              <span className="text-green-600">{formatCurrency(totalContractAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-foreground/60">
              Source: {formData.budgetSource === 'import' ? 'Imported from Excel' : 'Manual Entry'}
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Labor</span>
                <span>{formatCurrency(formData.labor)}</span>
              </div>
              <div className="flex justify-between">
                <span>Small Tools & Consumables</span>
                <span>{formatCurrency(formData.smallToolsConsumables)}</span>
              </div>
              <div className="flex justify-between">
                <span>Materials</span>
                <span>{formatCurrency(formData.materials)}</span>
              </div>
              <div className="flex justify-between">
                <span>Equipment</span>
                <span>{formatCurrency(formData.equipment)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subcontracts</span>
                <span>{formatCurrency(formData.subcontracts)}</span>
              </div>
              <div className="flex justify-between">
                <span>Other</span>
                <span>{formatCurrency(formData.otherBudget)}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Budget</span>
              <span className="text-blue-600">{formatCurrency(totalEstimatedJobCost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit Planning */}
      <Card>
        <CardHeader>
          <CardTitle>Profit Planning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <Label className="text-sm font-medium text-green-800">Estimated Gross Profit</Label>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(estimatedGrossProfit)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-800">Estimated Profit Margin %</Label>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatPercentage(estimatedProfitMargin)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderProjectInfo()
      case 2:
        return renderContractInfo()
      case 3:
        return renderBudgetBreakdown()
      case 4:
        return renderReviewSubmit()
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">New Project Setup</h1>
          <p className="text-foreground/70">Industrial Construction Company</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {renderStepContent()}

          {/* Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToPreviousStep}
                      disabled={isSubmitting}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/projects')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  {currentStep < STEPS.length ? (
                    <Button
                      type="button"
                      onClick={goToNextStep}
                      disabled={!canProceedToNext() || isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Project'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}