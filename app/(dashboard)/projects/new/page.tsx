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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight, CircleAlert, ChevronDown, LoaderCircle } from 'lucide-react'
import type { User } from '@/types/api'
import { cn } from '@/lib/utils'

interface FormData {
  // Project Information
  icsProjectNumber: string
  projectTitle: string
  projectManagerName: string
  projectManagerId: string
  clientName: string
  clientRepresentative: string

  // Contract Information
  clientPONumber: string
  poLineItems: POLineItem[]
  baseMarginPercentage: number

  // Budget Breakdown
  budgetSource: 'manual' | 'import'
  labor: number
  smallToolsConsumables: number
  materials: number
  equipment: number
  subcontracts: number
  otherBudget: number
}

interface BudgetLineItem {
  wbs_code?: string
  description: string
  quantity?: number
  unit_of_measure?: string
  unit_rate?: number
  manhours?: number
  crew_size?: number
  duration_days?: number
  total_cost: number
  contractor_name?: string
  supplier_name?: string
  owned_or_rented?: 'OWNED' | 'RENTED'
}

interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description?: string
  children: WBSNode[]
  budget_total: number
}

interface BudgetImportData {
  summary: Record<string, unknown>
  details: Record<string, BudgetLineItem[]>
  wbsStructure: WBSNode[]
  totals: {
    labor: number
    laborDirect: number
    laborIndirect: number
    laborStaff: number
    material: number
    equipment: number
    subcontract: number
    smallTools: number
    grand_total: number
  }
  validation: {
    warnings: string[]
    errors: string[]
  }
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
  const [budgetPreview, setBudgetPreview] = useState<BudgetImportData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [selectedBudgetTab, setSelectedBudgetTab] = useState<string>('summary')
  const [expandedWBS, setExpandedWBS] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<FormData>({
    icsProjectNumber: "",
    projectTitle: "",
    projectManagerName: "",
    projectManagerId: "",
    clientName: "",
    clientRepresentative: "",
    clientPONumber: "",
    poLineItems: [{ id: `line-${Date.now()}`, description: '', amount: 0 }],
    baseMarginPercentage: 15,
    budgetSource: 'manual',
    labor: 0,
    smallToolsConsumables: 0,
    materials: 0,
    equipment: 0,
    subcontracts: 0,
    otherBudget: 0,
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

  const handleInputChange = (field: keyof FormData, value: string | number | POLineItem[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Auto-create functions removed for MVP

  // Format data for autocomplete
  const projectManagerOptions = projectManagers?.map((user: User) => ({
    id: user.id,
    label: `${user.first_name} ${user.last_name}`,
    value: user.id
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
          formData.clientName
        )
      case 2:
        return (
          formData.poLineItems.length > 0 &&
          formData.poLineItems.every(item => item.description && item.amount > 0)
        )
      case 3:
        // For import mode, just check if a file is selected
        if (formData.budgetSource === 'import') {
          return budgetFile !== null
        }
        // For manual mode, check if any budget values are entered
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

  // Budget file handling - using coversheet import style
  // Toggle WBS node expansion
  const toggleWBS = (code: string) => {
    const newExpanded = new Set(expandedWBS)
    if (newExpanded.has(code)) {
      newExpanded.delete(code)
    } else {
      newExpanded.add(code)
    }
    setExpandedWBS(newExpanded)
  }

  // Render WBS tree node
  const renderWBSNode = (node: WBSNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedWBS.has(node.code)

    return (
      <div key={node.code}>
        <div
          className={cn(
            "flex items-center justify-between py-2 px-4 hover:bg-muted/50 cursor-pointer",
            depth > 0 && "border-l-2 border-muted"
          )}
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
          onClick={() => hasChildren && toggleWBS(node.code)}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
            {!hasChildren && <div className="w-4" />}
            <Badge variant="outline">{node.code}</Badge>
            <span className="text-sm">{node.description}</span>
          </div>
          <div className="text-right font-medium">
            ${node.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderWBSNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const handleBudgetFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    console.log('[DEBUG] Budget file selected:', selectedFile?.name)
    if (!selectedFile) return

    setBudgetFile(selectedFile)
    setBudgetError(null)
    setBudgetPreview(null)
    setLoadingPreview(true)
    console.log('[DEBUG] Starting preview process...')

    try {
      // Create a temporary project ID for preview (will use real ID after creation)
      const tempProjectId = 'preview-only'
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', tempProjectId)
      formData.append('mode', 'preview')

      console.log('[DEBUG] Sending preview request to /api/project-budgets/import-coversheet')
      const response = await fetch('/api/project-budgets/import-coversheet', {
        method: 'POST',
        body: formData
      })

      console.log('[DEBUG] Response status:', response.status)
      const result = await response.json()
      console.log('[DEBUG] Response data:', result)

      if (!response.ok) {
        console.error('[DEBUG] API error:', result.error)
        throw new Error(result.error || 'Failed to preview file')
      }

      // Map the data structure
      const mappedData = {
        ...result.data,
        totals: {
          labor: result.data.totals.totalLabor || 0,
          laborDirect: result.data.totals.laborDirect || 0,
          laborIndirect: result.data.totals.laborIndirect || 0,
          laborStaff: result.data.totals.laborStaff || 0,
          material: result.data.totals.materials || 0,
          equipment: result.data.totals.equipment || 0,
          subcontract: result.data.totals.subcontracts || 0,
          smallTools: result.data.totals.smallTools || 0,
          grand_total: result.data.totals.grandTotal || 0
        }
      }
      
      console.log('[DEBUG] Mapped data:', mappedData)
      setBudgetPreview(mappedData)
      
      // Update form data with imported totals
      if (mappedData.totals.grand_total > 0) {
        console.log('[DEBUG] Updating form data with imported totals')
        setFormData(prev => ({
          ...prev,
          budgetSource: 'import',
          labor: mappedData.totals.labor,
          materials: mappedData.totals.material,
          equipment: mappedData.totals.equipment,
          subcontracts: mappedData.totals.subcontract,
          smallToolsConsumables: mappedData.totals.smallTools,
          otherBudget: 0
        }))
      }
      console.log('[DEBUG] Preview loaded successfully')
    } catch (err) {
      console.error('[DEBUG] Preview error:', err)
      setBudgetError(err instanceof Error ? err.message : 'Failed to preview file')
      setBudgetPreview(null)
    } finally {
      setLoadingPreview(false)
      console.log('[DEBUG] Preview process complete')
    }
  }, [])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    const submissionData = {
      name: formData.projectTitle,
      job_number: formData.icsProjectNumber,
      project_manager_id: formData.projectManagerId,
      superintendent_id: formData.projectManagerId,
      original_contract: totalContractAmount,
      base_margin_percentage: formData.baseMarginPercentage,
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
      client_po_line_items: formData.poLineItems.map((item, index) => ({
        line_number: index + 1,
        description: item.description,
        amount: item.amount
      }))
    }
    
    console.log('Submitting project data:', submissionData)
    
    try {
      // Step 1: Create the project
      const response = await fetch('/api/projects', {
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
      
      // Step 2: If there's a budget file, import it
      if (budgetFile && formData.budgetSource === 'import') {
        try {
          const formData = new FormData()
          formData.append('file', budgetFile)
          formData.append('projectId', project.id)
          formData.append('mode', 'import')

          const budgetResponse = await fetch('/api/project-budgets/import-coversheet', {
            method: 'POST',
            body: formData
          })

          if (!budgetResponse.ok) {
            const budgetError = await budgetResponse.json()
            console.error('Budget import error:', budgetError)
            // Continue even if budget import fails - project is created
            alert(`Project created but budget import failed: ${budgetError.error || 'Unknown error'}`)
          }
        } catch (budgetError) {
          console.error('Budget import error:', budgetError)
          // Continue even if budget import fails
          alert('Project created but budget import failed')
        }
      }
      
      // Step 3: Navigate to the created project
      router.push(`/projects/${project.id}/overview?tab=budget`)
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
            placeholder="Select project manager"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => handleInputChange("clientName", e.target.value)}
              placeholder="Enter client name"
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

        <div className="space-y-2">
          <Label htmlFor="baseMarginPercentage">Target Profit Margin (%)</Label>
          <Input
            id="baseMarginPercentage"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={formData.baseMarginPercentage}
            onChange={(e) => handleInputChange("baseMarginPercentage", parseFloat(e.target.value) || 0)}
            placeholder="15"
          />
          <p className="text-sm text-muted-foreground">
            This margin will be used for early-stage budget projections
          </p>
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
            
            {/* Debug Information Panel */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm mt-4">
              <div className="font-medium text-gray-700 mb-2">Debug Information:</div>
              <div className="flex justify-between">
                <span className="font-medium">File Selected:</span>
                <span className={budgetFile ? 'text-green-600' : 'text-gray-400'}>
                  {budgetFile ? `✓ ${budgetFile.name}` : '✗ No file'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Loading Preview:</span>
                <span className={loadingPreview ? 'text-yellow-600' : 'text-gray-400'}>
                  {loadingPreview ? '⟳ Processing...' : '• Idle'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Preview Data:</span>
                <span className={budgetPreview ? 'text-green-600' : 'text-gray-400'}>
                  {budgetPreview ? '✓ Loaded' : '✗ Not loaded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Next Button Active:</span>
                <span className={budgetFile ? 'text-green-600 font-bold' : 'text-red-600'}>
                  {budgetFile ? 'YES - File selected' : 'NO - Select a file'}
                </span>
              </div>
              {budgetError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                  <strong>Error:</strong> {budgetError}
                </div>
              )}
            </div>
            
            {/* Loading indicator */}
            {loadingPreview && (
              <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg mt-4">
                <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-blue-700">Processing Excel file...</span>
              </div>
            )}
            
            {/* Error display */}
            {budgetError && !loadingPreview && (
              <Alert variant="destructive" className="mt-4">
                <CircleAlert className="h-4 w-4" />
                <AlertDescription>
                  {budgetError}
                  <div className="mt-2 text-sm">
                    You can still proceed with the file or switch to manual entry.
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview - Same structure as working budget-import-coversheet page */}
            {budgetPreview && (
              <div className="space-y-4 mt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800">Import Summary</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    Total Budget: {formatCurrency(budgetPreview.totals?.grand_total || 0)}
                  </p>
                </div>

                <Tabs value={selectedBudgetTab} onValueChange={setSelectedBudgetTab}>
                  <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="wbs">WBS Structure</TabsTrigger>
                    <TabsTrigger value="labor">Labor</TabsTrigger>
                    <TabsTrigger value="materials">Materials</TabsTrigger>
                    <TabsTrigger value="equipment">Equipment</TabsTrigger>
                    <TabsTrigger value="subs">Subcontracts</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Total Budget</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            ${(budgetPreview.totals?.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Line Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {budgetPreview.details ? Object.values(budgetPreview.details).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0) : 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">WBS Codes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {budgetPreview.wbsStructure?.length || 0}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Budget by Category</h3>
                      <div className="space-y-2">
                        {/* Labor breakdown */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center py-2 border-b font-semibold">
                            <span>Labor</span>
                            <span>${(budgetPreview.totals?.labor || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                            <span>Direct Labor</span>
                            <span>${(budgetPreview.totals?.laborDirect || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                            <span>Indirect Labor</span>
                            <span>${(budgetPreview.totals?.laborIndirect || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground border-b">
                            <span>Staff Labor</span>
                            <span>${(budgetPreview.totals?.laborStaff || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        
                        {/* Non-labor categories */}
                        <div className="flex justify-between items-center py-2 border-b">
                          <span>Materials</span>
                          <span className="font-medium">
                            ${(budgetPreview.totals?.material || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                          <span>Equipment</span>
                          <span className="font-medium">
                            ${(budgetPreview.totals?.equipment || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                          <span>Subcontracts</span>
                          <span className="font-medium">
                            ${(budgetPreview.totals?.subcontract || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                          <span>Small Tools & Consumables</span>
                          <span className="font-medium">
                            ${(budgetPreview.totals?.smallTools || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {budgetPreview.details && Object.keys(budgetPreview.details).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Sheets Processed</h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(budgetPreview.details).map(sheetName => (
                            <Badge key={sheetName} variant="secondary">
                              {sheetName} ({budgetPreview.details[sheetName].length} items)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="wbs" className="space-y-4">
                    {budgetPreview.wbsStructure && budgetPreview.wbsStructure.length > 0 ? (
                      <div className="border rounded-lg">
                        {budgetPreview.wbsStructure.map(node => renderWBSNode(node))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No WBS structure found
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="labor">
                    <div className="space-y-4">
                      {['DIRECTS', 'INDIRECTS', 'STAFF'].map(sheet => (
                        budgetPreview.details && budgetPreview.details[sheet] && (
                          <div key={sheet}>
                            <h3 className="font-semibold mb-2">{sheet}</h3>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="text-left p-2">WBS</th>
                                    <th className="text-left p-2">Description</th>
                                    <th className="text-right p-2">Hours</th>
                                    <th className="text-right p-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {budgetPreview.details[sheet].slice(0, 10).map((item, idx) => (
                                    <tr key={idx} className="border-t">
                                      <td className="p-2">{item.wbs_code || '-'}</td>
                                      <td className="p-2">{item.description}</td>
                                      <td className="text-right p-2">{item.manhours?.toLocaleString() || '-'}</td>
                                      <td className="text-right p-2">
                                        ${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {budgetPreview.details[sheet].length > 10 && (
                                <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                                  ... and {budgetPreview.details[sheet].length - 10} more items
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="materials">
                    {budgetPreview.details && budgetPreview.details['MATERIALS'] ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">WBS</th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Quantity</th>
                              <th className="text-right p-2">Unit</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {budgetPreview.details['MATERIALS'].slice(0, 20).map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{item.wbs_code || '-'}</td>
                                <td className="p-2">{item.description}</td>
                                <td className="text-right p-2">{item.quantity?.toLocaleString() || '-'}</td>
                                <td className="text-right p-2">{item.unit_of_measure || '-'}</td>
                                <td className="text-right p-2">
                                  ${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No materials data found
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="equipment">
                    {budgetPreview.details && budgetPreview.details['GENERAL EQUIPMENT'] ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">WBS</th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Quantity</th>
                              <th className="text-right p-2">Duration</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {budgetPreview.details['GENERAL EQUIPMENT'].slice(0, 20).map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{item.wbs_code || '-'}</td>
                                <td className="p-2">{item.description}</td>
                                <td className="text-right p-2">{item.quantity?.toLocaleString() || '-'}</td>
                                <td className="text-right p-2">{item.duration_days || '-'}</td>
                                <td className="text-right p-2">
                                  ${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No equipment data found
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="subs">
                    {budgetPreview.details && budgetPreview.details['SUBS'] ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">WBS</th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-left p-2">Contractor</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {budgetPreview.details['SUBS'].slice(0, 20).map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{item.wbs_code || '-'}</td>
                                <td className="p-2">{item.description}</td>
                                <td className="p-2">{item.contractor_name || '-'}</td>
                                <td className="text-right p-2">
                                  ${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No subcontractor data found
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
              <Label className="text-sm font-medium text-blue-800">Target Margin %</Label>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatPercentage(formData.baseMarginPercentage)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-800">Calculated Margin %</Label>
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