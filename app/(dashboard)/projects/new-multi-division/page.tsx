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
import { DivisionSelector, type DivisionAssignment } from "@/components/ui/division-selector"
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import type { Division, Client, User } from '@/types/api'
import * as XLSX from 'xlsx'

interface FormData {
  // Project Information
  icsProjectNumber: string
  projectTitle: string
  projectManagerName: string
  projectManagerId: string
  clientName: string
  clientId: string
  clientRepresentative: string

  // Division Assignments (NEW)
  divisionAssignments: DivisionAssignment[]

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
      category: 'labor' | 'materials' | 'equipment' | 'subcontracts' | 'small_tools_consumables' | 'other'
    }>
    total: number
    mappedDivision?: string // NEW: Show which division this will map to
  }>
  totalBudget: number
  isValid: boolean
  errors: string[]
  categoryBreakdown: {
    labor: { items: string[]; total: number }
    materials: { items: string[]; total: number }
    equipment: { items: string[]; total: number }
    subcontracts: { items: string[]; total: number }
    small_tools_consumables: { items: string[]; total: number }
    other: { items: string[]; total: number }
  }
  divisionBreakdown?: { // NEW: Show budget by division
    [divisionId: string]: {
      name: string
      disciplines: string[]
      total: number
    }
  }
}

const STEPS = [
  { id: 1, title: 'Project Info', description: 'Basic details' },
  { id: 2, title: 'Divisions', description: 'Division assignments' }, // NEW STEP
  { id: 3, title: 'Contract', description: 'PO line items' },
  { id: 4, title: 'Budget', description: 'Cost breakdown' },
  { id: 5, title: 'Review', description: 'Confirm & submit' },
]

// Discipline to division mapping
const DISCIPLINE_DIVISION_MAP: Record<string, string> = {
  'ELECTRICAL': 'I&E',
  'INSTRUMENTATION': 'I&E',
  'INSTRUMENTATION DEMO': 'I&E',
  'CIVIL - GROUNDING': 'CIV',
  'GROUTING': 'CIV',
  'FABRICATION': 'MEC',
  'PIPING': 'MEC',
  'PIPING DEMO': 'MEC',
  'EQUIPMENT': 'MEC',
  'EQUIPMENT DEMO': 'MEC',
  'STEEL': 'MEC',
  'STEEL DEMO': 'MEC',
  'SCAFFOLDING': 'MEC',
  'BUILDING-REMODELING': 'MEC',
  'CONSTRUCTABILITY': 'MEC',
  'GENERAL STAFFING': 'MEC'
}

export default function MultiDivisionProjectSetupForm() {
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
    clientName: "",
    clientId: "",
    clientRepresentative: "",
    divisionAssignments: [], // NEW
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

  const handleInputChange = (field: keyof FormData, value: any) => {
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
        return (
          formData.icsProjectNumber &&
          formData.projectTitle &&
          formData.projectManagerId &&
          formData.clientId
        )
      case 2:
        return (
          formData.divisionAssignments.length > 0 &&
          formData.divisionAssignments.some(d => d.is_lead_division)
        )
      case 3:
        return (
          formData.poLineItems.length > 0 &&
          formData.poLineItems.every(item => item.description && item.amount > 0)
        )
      case 4:
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

  // Budget file handling with division mapping
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
          errors: ['No BUDGETS sheet found in Excel file.'],
          categoryBreakdown: {
            labor: { items: [], total: 0 },
            materials: { items: [], total: 0 },
            equipment: { items: [], total: 0 },
            subcontracts: { items: [], total: 0 },
            small_tools_consumables: { items: [], total: 0 },
            other: { items: [], total: 0 }
          }
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

      // Process budget data with division mapping
      const disciplines = new Map<string, Array<{cost_type: string; manhours: number | null; value: number; category: 'labor' | 'materials' | 'equipment' | 'subcontracts' | 'small_tools_consumables' | 'other'}>>()
      const budgetBreakdowns: Array<{discipline: string; cost_type: string; manhours: number | null; value: number}> = []
      const divisionBreakdown: Record<string, { name: string; disciplines: string[]; total: number }> = {}
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
      const categoryBreakdown: BudgetPreview['categoryBreakdown'] = {
        labor: { items: [], total: 0 },
        materials: { items: [], total: 0 },
        equipment: { items: [], total: 0 },
        subcontracts: { items: [], total: 0 },
        small_tools_consumables: { items: [], total: 0 },
        other: { items: [], total: 0 }
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
            description.toUpperCase() === 'ALL LABOR') {
          continue
        }
        
        const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[$,]/g, '') || '0')
        const numericManhours = manhours ? (typeof manhours === 'number' ? manhours : parseFloat(manhours.toString() || '0')) : null
        
        if (!disciplines.has(currentDiscipline)) {
          disciplines.set(currentDiscipline, [])
        }
        
        // Determine category
        const costType = description.trim().toUpperCase()
        let category: 'labor' | 'materials' | 'equipment' | 'subcontracts' | 'small_tools_consumables' | 'other'
        
        if (costType.includes('LABOR')) {
          category = 'labor'
          categoryTotals.labor += numericValue
          categoryBreakdown.labor.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.labor.total += numericValue
        } else if (costType === 'MATERIALS') {
          category = 'materials'
          categoryTotals.materials += numericValue
          categoryBreakdown.materials.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.materials.total += numericValue
        } else if (costType === 'EQUIPMENT') {
          category = 'equipment'
          categoryTotals.equipment += numericValue
          categoryBreakdown.equipment.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.equipment.total += numericValue
        } else if (costType === 'SUBCONTRACTS') {
          category = 'subcontracts'
          categoryTotals.subcontracts += numericValue
          categoryBreakdown.subcontracts.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.subcontracts.total += numericValue
        } else if (costType === 'SMALL TOOLS & CONSUMABLES') {
          category = 'small_tools_consumables'
          categoryTotals.small_tools_consumables += numericValue
          categoryBreakdown.small_tools_consumables.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.small_tools_consumables.total += numericValue
        } else {
          category = 'other'
          categoryTotals.other += numericValue
          categoryBreakdown.other.items.push(`${currentDiscipline}: ${description.trim()}`)
          categoryBreakdown.other.total += numericValue
        }
        
        const item = {
          cost_type: description.trim(),
          manhours: numericManhours,
          value: numericValue,
          category
        }
        
        disciplines.get(currentDiscipline)!.push(item)
        budgetBreakdowns.push({
          discipline: currentDiscipline,
          cost_type: description.trim(),
          manhours: numericManhours,
          value: numericValue
        })
        
        // Track division breakdown
        const divisionCode = DISCIPLINE_DIVISION_MAP[currentDiscipline] || 'MEC'
        const division = divisions?.find(d => d.code === divisionCode)
        if (division) {
          if (!divisionBreakdown[division.id]) {
            divisionBreakdown[division.id] = {
              name: `${division.name} (${division.code})`,
              disciplines: [],
              total: 0
            }
          }
          if (!divisionBreakdown[division.id].disciplines.includes(currentDiscipline)) {
            divisionBreakdown[division.id].disciplines.push(currentDiscipline)
          }
          divisionBreakdown[division.id].total += numericValue
        }
        
        totalBudget += numericValue
      }

      const disciplineArray = Array.from(disciplines.entries()).map(([name, items]) => {
        const divisionCode = DISCIPLINE_DIVISION_MAP[name] || 'MEC'
        const division = divisions?.find(d => d.code === divisionCode)
        return {
          name,
          items,
          total: items.reduce((sum, item) => sum + item.value, 0),
          mappedDivision: division ? `${division.name} (${division.code})` : 'Unknown'
        }
      })
      
      setBudgetPreview({
        disciplines: disciplineArray,
        totalBudget,
        isValid: disciplineArray.length > 0,
        errors: disciplineArray.length === 0 ? ['No valid budget data found'] : [],
        categoryBreakdown,
        divisionBreakdown
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
        errors: ['Failed to parse Excel file'],
        categoryBreakdown: {
          labor: { items: [], total: 0 },
          materials: { items: [], total: 0 },
          equipment: { items: [], total: 0 },
          subcontracts: { items: [], total: 0 },
          small_tools_consumables: { items: [], total: 0 },
          other: { items: [], total: 0 }
        }
      })
    }
  }, [divisions])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Get lead division for backward compatibility
    const leadDivision = formData.divisionAssignments.find(d => d.is_lead_division)
    
    const submissionData = {
      name: formData.projectTitle,
      job_number: formData.icsProjectNumber,
      client_id: formData.clientId,
      division_id: leadDivision?.division_id || '', // For backward compatibility
      project_manager_id: formData.projectManagerId,
      superintendent_id: formData.projectManagerId,
      original_contract: totalContractAmount,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
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
      budget_source: formData.budgetSource,
      // NEW: Division assignments
      division_assignments: formData.divisionAssignments.map(d => ({
        division_id: d.division_id,
        division_pm_id: d.division_pm_id,
        is_lead_division: d.is_lead_division,
        budget_allocated: d.budget_allocated
      }))
    }
    
    console.log('Submitting project data:', submissionData)
    
    try {
      const response = await fetch('/api/projects/multi-division', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Project creation error:', error)
        
        let errorMessage = error.error || 'Failed to create project'
        
        // Show specific validation errors if available
        if (error.details && Array.isArray(error.details)) {
          const validationErrors = error.details.map((detail: any) => 
            `${detail.path?.join?.('.') || 'Field'}: ${detail.message}`
          ).join('\n')
          errorMessage = `Validation Error:\n${validationErrors}`
        }
        
        alert(errorMessage)
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
            <Label htmlFor="projectManagerName">Lead Project Manager</Label>
            <AutocompleteInput
              value={formData.projectManagerName}
              onChange={(value, option) => {
                setFormData(prev => ({
                  ...prev,
                  projectManagerName: value,
                  projectManagerId: option?.value || ''
                }))
              }}
              options={projectManagerOptions}
              placeholder="Enter or select lead PM"
              onCreateNew={createNewProjectManager}
              required
            />
            <p className="text-sm text-muted-foreground">This is the overall project PM</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <AutocompleteInput
              value={formData.clientName}
              onChange={(value, option) => {
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
      </CardContent>
    </Card>
  )

  const renderDivisionAssignments = () => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Division Assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assign one or more divisions to this project. Each division can have its own project manager and budget allocation.
        </p>
        
        <DivisionSelector
          divisions={divisions || []}
          projectManagers={projectManagers || []}
          selectedDivisions={formData.divisionAssignments}
          onChange={(assignments) => handleInputChange('divisionAssignments', assignments)}
          totalBudget={totalEstimatedJobCost}
          showBudgetAllocation={false} // We'll allocate budgets after import
        />

        {formData.divisionAssignments.length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Budget allocation by division will be available after importing or entering the total budget.
            </p>
          </div>
        )}
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

            {/* Preview with Division Mapping */}
            {budgetPreview && budgetPreview.isValid && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800">Import Summary</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    Total Budget: {formatCurrency(budgetPreview.totalBudget)}
                  </p>
                </div>
                
                {/* Division Breakdown */}
                {budgetPreview.divisionBreakdown && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800 mb-3">Budget by Division</p>
                    <div className="space-y-2">
                      {Object.entries(budgetPreview.divisionBreakdown).map(([divisionId, data]) => (
                        <div key={divisionId} className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{data.name}</span>
                            <p className="text-xs text-blue-600">
                              Disciplines: {data.disciplines.join(', ')}
                            </p>
                          </div>
                          <span className="font-medium">{formatCurrency(data.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Detailed Line Items by Discipline */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/80">Detailed Budget by Discipline:</p>
                  {budgetPreview.disciplines.map((discipline, i) => (
                    <details key={i} className="bg-background rounded border border-foreground/10">
                      <summary className="p-3 cursor-pointer hover:bg-muted/50">
                        <div className="inline-flex justify-between items-center w-full">
                          <span className="font-medium">{discipline.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{discipline.mappedDivision}</Badge>
                            <span className="text-sm text-foreground/60">
                              {formatCurrency(discipline.total)} ({discipline.items.length} items)
                            </span>
                          </div>
                        </div>
                      </summary>
                      <div className="border-t border-foreground/10">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-foreground/5">
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Manhours</th>
                              <th className="text-right p-2">Amount</th>
                              <th className="text-left p-2">Category</th>
                            </tr>
                          </thead>
                          <tbody>
                            {discipline.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-foreground/5">
                                <td className="p-2">{item.cost_type}</td>
                                <td className="text-right p-2">{item.manhours || '-'}</td>
                                <td className="text-right p-2">{formatCurrency(item.value)}</td>
                                <td className="p-2">
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                                    {item.category.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
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
              <p className="text-foreground/60">Lead Project Manager</p>
              <p className="font-medium">{formData.projectManagerName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Division Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Division Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {formData.divisionAssignments.map((assignment) => (
              <div key={assignment.division_id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {assignment.division_name}
                    {assignment.is_lead_division && (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" />
                        Lead
                      </Badge>
                    )}
                  </p>
                  {assignment.division_pm_name && (
                    <p className="text-sm text-muted-foreground">PM: {assignment.division_pm_name}</p>
                  )}
                </div>
                {assignment.budget_allocated > 0 && (
                  <p className="font-medium">{formatCurrency(assignment.budget_allocated)}</p>
                )}
              </div>
            ))}
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
        return renderDivisionAssignments()
      case 3:
        return renderContractInfo()
      case 4:
        return renderBudgetBreakdown()
      case 5:
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
          <p className="text-foreground/70">Multi-Division Project Configuration</p>
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