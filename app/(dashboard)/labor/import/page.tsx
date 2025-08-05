'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Upload as UploadIcon, 
  AlertCircle, 
  CheckCircle,
  Download,
  ArrowLeft,
  Info as InfoIcon,
  FileSpreadsheet,
  Users,
  Briefcase
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useUser } from '@/hooks/use-auth'
import * as XLSX from 'xlsx'
import { formatCurrency, cn } from '@/lib/utils'
import { parseExcelDate, EXCEL_HEADERS, EXCEL_COLUMNS } from '@/lib/validations/labor-import'
import type { LaborImportResult } from '@/lib/validations/labor-import'

interface PreviewData {
  contractorNumber: string
  contractorInfo: ContractorInfo | null
  weekEnding: Date
  matchedProject?: {
    id: string
    job_number: string
    name: string
  }
  employees: Array<{
    employeeId: string
    lastName: string
    firstName: string
    craftCode: string
    stHours: number
    otHours: number
    stRate: number
    totalCost: number
    exists?: boolean
    dbRate?: number
  }>
  totals: {
    employees: number
    totalHours: number
    totalCost: number
  }
  isValid: boolean
  errors: string[]
}

interface NewEmployee {
  employee_number: string
  first_name: string
  last_name: string
  craft_code: string
  base_rate: number
  craft_type_id?: string
  is_direct?: boolean
}

interface NewCraft {
  code: string
  suggested_name: string
  default_rate?: number
  name?: string
  labor_category?: 'direct' | 'indirect' | 'staff'
}

interface ContractorInfo {
  jobNumber: string
  contractType: string
  client: string
}

// Helper to parse contractor string like "5772 LS DOW"
function parseContractorString(contractor: string): ContractorInfo | null {
  if (!contractor) return null
  
  const parts = contractor.trim().split(/\s+/)
  if (parts.length < 3) return null
  
  return {
    jobNumber: parts[0],
    contractType: parts[1],
    client: parts.slice(2).join(' ')
  }
}

export default function LaborImportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProjectId = searchParams.get('project_id')
  
  const { data: user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>(preselectedProjectId || '')
  const [importResult, setImportResult] = useState<LaborImportResult | null>(null)
  
  // Setup dialog state
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [newEmployees, setNewEmployees] = useState<NewEmployee[]>([])
  const [newCrafts, setNewCrafts] = useState<NewCraft[]>([])
  const [setupStep, setSetupStep] = useState<'crafts' | 'employees'>('crafts')
  const [isProcessingSetup, setIsProcessingSetup] = useState(false)
  const [justCompletedSetup, setJustCompletedSetup] = useState(false)
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  
  // State for tracking rate fetching
  const [isFetchingRates, setIsFetchingRates] = useState(false)

  // Check permissions
  const canImport = user && user.role === 'project_manager'
  
  // Debug logging
  console.log('User data:', user)
  console.log('Can import:', canImport)

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['projects-for-import'],
    queryFn: async () => {
      const response = await fetch('/api/projects?limit=100')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      console.log('Projects API response:', data)
      return data
    },
    enabled: true // Always fetch projects, we'll handle permissions separately
  })

  // Fetch craft types
  const { data: craftTypesData, refetch: refetchCraftTypes } = useQuery({
    queryKey: ['craft-types'],
    queryFn: async () => {
      const response = await fetch('/api/craft-types')
      if (!response.ok) throw new Error('Failed to fetch craft types')
      return response.json()
    }
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/labor-import', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }
      
      return data
    },
    onSuccess: (data) => {
      // Simplified import - no setup required
      setImportResult(data)
    },
    onError: (error) => {
      setImportResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{
          row: 0,
          message: error.message
        }]
      })
    }
  })

  // Fetch employee rates after preview is set
  useEffect(() => {
    const fetchEmployeeRates = async () => {
      if (!preview?.employees || preview.employees.length === 0) return
      
      // Check if we already have rates (already fetched)
      const hasRates = preview.employees.some(emp => emp.dbRate !== undefined)
      if (hasRates) return
      
      setIsFetchingRates(true)
      
      try {
        const employeeIds = preview.employees.map(emp => emp.employeeId)
        const response = await fetch('/api/employees/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeIds })
        })

        if (response.ok) {
          const { employees: dbEmployees } = await response.json()
          
          // Update preview with actual rates from database
          let recalculatedTotalCost = 0
          const updatedEmployees = preview.employees.map(emp => {
            const dbEmp = dbEmployees.find((e: { employeeNumber: string; baseRate: number }) => e.employeeNumber === emp.employeeId)
            const actualRate = dbEmp?.baseRate || emp.stRate || 0
            
            // Recalculate costs with actual rate
            const stWages = emp.stHours * actualRate
            const otWages = emp.otHours * actualRate * 1.5
            // Apply 28% burden to straight-time wages only (matching backend logic)
            const burdenAmount = stWages * 0.28
            const totalCost = stWages + otWages + burdenAmount
            recalculatedTotalCost += totalCost

            return {
              ...emp,
              stRate: actualRate,
              totalCost,
              exists: dbEmp && dbEmp.employeeNumber !== undefined,
              dbRate: dbEmp?.baseRate
            }
          })

          setPreview({
            ...preview,
            employees: updatedEmployees,
            totals: {
              ...preview.totals,
              totalCost: recalculatedTotalCost
            }
          })
        }
      } catch (error) {
        console.error('Failed to fetch employee rates:', error)
      } finally {
        setIsFetchingRates(false)
      }
    }

    fetchEmployeeRates()
  }, [preview?.employees])

  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPreview(null)
    setImportResult(null)

    try {
      // Read and parse file for preview
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
      
      if (!workbook.SheetNames.includes('DOW')) {
        setPreview({
          contractorNumber: '',
          contractorInfo: null,
          weekEnding: new Date(),
          employees: [],
          totals: { employees: 0, totalHours: 0, totalCost: 0 },
          isValid: false,
          errors: ['Sheet "DOW" not found in Excel file']
        })
        return
      }

      const worksheet = workbook.Sheets['DOW']
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as unknown[][]

      if (data.length < EXCEL_HEADERS.DATA_START_ROW) {
        setPreview({
          contractorNumber: '',
          contractorInfo: null,
          weekEnding: new Date(),
          employees: [],
          totals: { employees: 0, totalHours: 0, totalCost: 0 },
          isValid: false,
          errors: ['Invalid Excel format. File does not have enough rows.']
        })
        return
      }

      // Extract contractor number and week ending
      // Fixed: Contractor at index 4 in row 4, week ending at index 4 in row 5
      const contractorNumber = String(data[EXCEL_HEADERS.CONTRACTOR_ROW - 1][4] || '')
      const weekEndingSerial = Number(data[EXCEL_HEADERS.WEEK_ENDING_ROW - 1][4])
      const weekEnding = parseExcelDate(weekEndingSerial)
      
      // Parse contractor info
      const contractorInfo = parseContractorString(contractorNumber)
      
      // Try to auto-match project
      let matchedProject = undefined
      if (contractorInfo && projectsData?.projects) {
        const matched = projectsData.projects.find((p: any) => p.job_number === contractorInfo.jobNumber)
        if (matched) {
          matchedProject = {
            id: matched.id,
            job_number: matched.job_number,
            name: matched.name
          }
          // Auto-select the matched project
          setSelectedProject(matched.id)
        }
      }

      // Parse employee data
      const employees: Array<{
        employeeId: string
        lastName: string
        firstName: string
        craftCode: string
        stHours: number
        otHours: number
        stRate: number
        totalCost: number
        exists?: boolean
        dbRate?: number
      }> = []
      let totalHours = 0
      let totalCost = 0

      // Start from actual data row (index 9, row 10)
      for (let i = 9; i < data.length; i++) {
        const row = data[i]
        
        const employeeId = String(row[EXCEL_COLUMNS.EMPLOYEE_ID] || '').trim()
        
        // Stop if we hit the Grand Totals row
        if (employeeId === 'Grand Totals' || employeeId.toLowerCase().includes('total')) {
          break
        }
        
        // Skip if not a valid employee ID (must match T#### pattern)
        if (!employeeId || !/^T\d+$/.test(employeeId)) continue

        const stHours = Number(row[EXCEL_COLUMNS.ST_HOURS]) || 0
        const otHours = Number(row[EXCEL_COLUMNS.OT_HOURS]) || 0
        
        if (stHours === 0 && otHours === 0) continue

        const stRate = Number(row[EXCEL_COLUMNS.ST_RATE]) || 0
        const stWages = stHours * stRate
        const otWages = otHours * stRate * 1.5
        // Apply 28% burden to straight-time wages only (matching backend logic)
        const burdenAmount = stWages * 0.28
        const employeeTotalCost = stWages + otWages + burdenAmount

        // Parse name from combined field (format: "Last, First")
        const nameField = String(row[EXCEL_COLUMNS.NAME] || '').trim()
        let lastName = ''
        let firstName = ''
        
        if (nameField.includes(',')) {
          const nameParts = nameField.split(',')
          lastName = nameParts[0].trim()
          firstName = nameParts[1] ? nameParts[1].trim() : ''
        } else {
          lastName = nameField
        }

        employees.push({
          employeeId,
          lastName,
          firstName,
          craftCode: String(row[EXCEL_COLUMNS.CRAFT_CODE] || '').trim(),
          stHours,
          otHours,
          stRate,
          totalCost: employeeTotalCost
        })

        totalHours += stHours + otHours
        totalCost += employeeTotalCost
      }

      setPreview({
        contractorNumber,
        contractorInfo,
        weekEnding,
        matchedProject,
        employees,
        totals: {
          employees: employees.length,
          totalHours,
          totalCost
        },
        isValid: employees.length > 0,
        errors: employees.length === 0 ? ['No employee data found in file'] : []
      })

    } catch {
      setPreview({
        contractorNumber: '',
        contractorInfo: null,
        weekEnding: new Date(),
        employees: [],
        totals: { employees: 0, totalHours: 0, totalCost: 0 },
        isValid: false,
        errors: ['Failed to parse file. Please ensure it is a valid Excel file.']
      })
    }
  }, [projectsData?.projects])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await processFile(selectedFile)
  }, [processFile])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    const excelFile = files.find(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    )

    if (excelFile) {
      await processFile(excelFile)
    } else {
      // Show error for invalid file type
      setPreview({
        contractorNumber: '',
        contractorInfo: null,
        weekEnding: new Date(),
        employees: [],
        totals: { employees: 0, totalHours: 0, totalCost: 0 },
        isValid: false,
        errors: ['Please drop an Excel file (.xlsx or .xls)']
      })
    }
  }, [processFile])

  const handleImport = async () => {
    if (!file || !preview?.isValid || !selectedProject) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', selectedProject)
    
    // If we just completed setup, add timestamp to force fresh queries
    if (justCompletedSetup) {
      formData.append('force_refresh', Date.now().toString())
      setJustCompletedSetup(false) // Reset the flag
    }

    importMutation.mutate(formData)
  }

  const handleSetupComplete = async () => {
    setIsProcessingSetup(true)

    try {
      // Create crafts first if needed
      if (setupStep === 'crafts' && newCrafts.length > 0) {
        const craftsToCreate = newCrafts.filter(c => c.name && c.labor_category)
        
        if (craftsToCreate.length > 0) {
          const response = await fetch('/api/craft-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              crafts: craftsToCreate.map(c => ({
                name: c.name,
                code: c.code,
                labor_category: c.labor_category,
                default_rate: c.default_rate
              }))
            })
          })

          if (!response.ok) {
            throw new Error('Failed to create craft types')
          }

          // Refresh craft types to include newly created ones
          await refetchCraftTypes()
        }

        // Move to employees step if needed
        if (newEmployees.length > 0) {
          // Wait a moment for the refetch to complete
          await new Promise(resolve => setTimeout(resolve, 500))
          setSetupStep('employees')
          setIsProcessingSetup(false)
          return
        }
      }

      // Create employees if needed
      if (newEmployees.length > 0) {
        const employeesToCreate = newEmployees.filter(e => e.craft_type_id)
        
        if (employeesToCreate.length > 0) {
          const response = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employees: employeesToCreate.map(e => ({
                employee_number: e.employee_number,
                first_name: e.first_name,
                last_name: e.last_name,
                craft_type_id: e.craft_type_id,
                base_rate: e.base_rate,
                is_direct: e.is_direct ?? true
              }))
            })
          })

          if (!response.ok) {
            throw new Error('Failed to create employees')
          }
        }
      }

      // Close dialog and show success
      setShowSetupDialog(false)
      setIsProcessingSetup(false)
      
      // Refresh craft types to ensure UI shows updated data
      await refetchCraftTypes()
      
      // Show success message instead of auto-retry
      setImportResult({
        success: true,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        message: 'Setup completed successfully! Crafts and employees have been created. Please click "Import Labor Data" again to import the file.'
      } as LaborImportResult & { message?: string })
      
      // Set flag to indicate setup just completed
      setJustCompletedSetup(true)

    } catch (error) {
      console.error('Setup error:', error)
      setIsProcessingSetup(false)
    }
  }

  const downloadTemplate = () => {
    const template = [
      ['5772 LS DOW'],
      [''],
      [''],
      ['Contractor Number'],
      ['45844'], // Example week ending date
      [''],
      ['Name', '', '', '', '', '', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'StHours', 'OtHours', 'Class', 'StRate', 'StWages', 'OtWages'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['C5', 'T', 'T2005', '.', 'Lachance', 'Cory', '10', '5', '5', '10', '', '', '', '30', '0', 'CPM', '92.91', '2787.3', '0']
    ]

    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DOW')
    XLSX.writeFile(wb, 'labor_cost_template.xlsx')
  }

  if (!canImport) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Permission Denied</h2>
          <p className="text-foreground">You don&apos;t have permission to import labor data.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/labor')}
          >
            Back to Labor
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(preselectedProjectId ? `/labor?project_id=${preselectedProjectId}` : '/labor')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import Labor Costs</h1>
          <p className="text-foreground mt-1">Upload Excel timesheet to import weekly labor data</p>
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-6 mb-6">
        <div className="flex items-start">
          <InfoIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-2">Import Instructions:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>File must be in ICS Labor Cost Excel format with &quot;DOW&quot; sheet</li>
              <li>Contractor number in row 4, week ending date in row 5</li>
              <li>Employee data starts from row 10 with hours and rates</li>
              <li>All labor will be imported as aggregated &quot;Direct Labor&quot; totals</li>
              <li>Total hours and costs will be summed from all employees</li>
              <li>Rows with 0 hours are automatically skipped</li>
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>
      </Card>

      {/* Project Selection */}
      <Card className="p-6 mb-6">
        <Label htmlFor="project" className="block text-sm font-medium text-foreground/80 mb-2">
          Select Project *
        </Label>
        {projectsError && (
          <div className="text-red-500 text-sm mb-2">Error loading projects: {(projectsError as Error).message}</div>
        )}
        {projectsLoading && (
          <div className="text-foreground/60 text-sm mb-2">Loading projects...</div>
        )}
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger id="project">
            <SelectValue placeholder="Choose a project" />
          </SelectTrigger>
          <SelectContent>
            {!projectsLoading && !projectsError && projectsData?.projects?.length === 0 && (
              <div className="px-2 py-1 text-sm text-foreground/60">No projects found</div>
            )}
            {(projectsData as any)?.projects?.map((project: { id: string; job_number: string; name: string }) => (
              <SelectItem key={project.id} value={project.id}>
                {project.job_number} - {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* File Upload */}
      <Card className="p-6 mb-6">
        <div 
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
            isDragging 
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]" 
              : "border-foreground/30 hover:border-foreground/50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            {isDragging ? (
              <>
                <UploadIcon className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-bounce" />
                <p className="text-lg font-medium text-blue-600 dark:text-blue-400 mb-2">
                  Drop your Excel file here
                </p>
                <p className="text-sm text-blue-500 dark:text-blue-400">
                  Release to upload
                </p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-foreground/60 mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-foreground/80">Excel files (.xlsx, .xls) up to 10MB</p>
              </>
            )}
          </label>
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Preview</h3>
          
          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Validation Errors:</p>
                  <ul className="list-disc ml-5 mt-1">
                    {preview.errors.map((error, i) => (
                      <li key={i} className="text-sm text-red-700">{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {preview.isValid && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-foreground/80">File Information:</p>
                  <p className="font-medium">{preview.contractorNumber}</p>
                  {preview.contractorInfo && (
                    <div className="mt-1 text-sm space-y-1">
                      <p><span className="text-foreground/60">Job Number:</span> <span className="font-semibold">{preview.contractorInfo.jobNumber}</span></p>
                      <p><span className="text-foreground/60">Contract Type:</span> {preview.contractorInfo.contractType}</p>
                      <p><span className="text-foreground/60">Client:</span> {preview.contractorInfo.client}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-foreground/80">Week Ending:</p>
                  <p className="font-medium">{preview.weekEnding.toLocaleDateString()}</p>
                </div>
              </div>
              
              {preview.matchedProject && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">Project Auto-Matched:</span> {preview.matchedProject.job_number} - {preview.matchedProject.name}
                  </p>
                </div>
              )}
              
              {preview.contractorInfo && !preview.matchedProject && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Warning:</span> No project found matching job number {preview.contractorInfo.jobNumber}. Please select a project manually.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-blue-700">Employees</p>
                    <p className="text-xl font-bold text-blue-900">{preview.totals.employees}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Total Hours</p>
                    <p className="text-xl font-bold text-blue-900">{preview.totals.totalHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Total Cost</p>
                    <p className="text-xl font-bold text-blue-900">
                      {isFetchingRates ? (
                        <span className="text-sm">Calculating...</span>
                      ) : (
                        formatCurrency(preview.totals.totalCost)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {preview.employees.some(emp => emp.exists === false) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">New employees will be created during import:</p>
                      <p>Employees highlighted in yellow don't exist in the system yet. Their wage rates will be set from the Excel file or default to $0 if not specified.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">Employee</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">Craft</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">ST Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">OT Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">Rate (w/Burden)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-foreground/80 uppercase">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.employees.map((emp, i) => (
                      <tr key={i} className={emp.exists === false ? 'bg-yellow-50' : ''}>
                        <td className="px-4 py-2 text-sm text-foreground">
                          <div>
                            {emp.lastName}, {emp.firstName} ({emp.employeeId})
                            {emp.exists === false && (
                              <span className="ml-2 text-xs text-yellow-600 font-medium">(New)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-foreground">{emp.craftCode}</td>
                        <td className="px-4 py-2 text-sm text-foreground text-right">{emp.stHours}</td>
                        <td className="px-4 py-2 text-sm text-foreground text-right">{emp.otHours}</td>
                        <td className="px-4 py-2 text-sm text-foreground text-right">
                          <div>
                            {isFetchingRates ? (
                              <span className="text-xs text-foreground/60">Loading...</span>
                            ) : (
                              <>
                                {formatCurrency(emp.stRate * 1.28)}
                                {emp.dbRate !== undefined && emp.dbRate !== emp.stRate && (
                                  <div className="text-xs text-green-600">From DB (w/28% burden)</div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-foreground text-right font-medium">{formatCurrency(emp.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className="p-6 mb-6">
          <div className={`flex items-start ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {importResult.success ? (
              <CheckCircle className="h-5 w-5 mt-0.5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mt-0.5 mr-2" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">
                {(importResult as any).message ? 'Setup Completed' : `Import ${importResult.success ? 'Completed' : 'Failed'}`}
              </h3>
              {(importResult as any).message ? (
                <p className="text-sm">{(importResult as any).message}</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {importResult.imported > 0 && (
                    <p>✓ Created new weekly labor total</p>
                  )}
                  {importResult.updated > 0 && (
                    <p>✓ Updated existing weekly labor total</p>
                  )}
                  {(importResult as any).employeeCount && (
                    <p>Employees processed: {(importResult as any).employeeCount} with hours</p>
                  )}
                  {importResult.errors.length > 0 && (
                    <p className="text-red-600">Errors: {importResult.errors.length}</p>
                  )}
                </div>
              )}
              
              {importResult.errors.length > 0 && !((importResult as any).message) && (
                <div className="mt-4">
                  <p className="font-medium mb-2">Error Details:</p>
                  <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <div key={i} className="text-xs mb-1 text-red-700">
                        {error.row > 0 ? `Row ${error.row}: ` : ''}{error.message}
                      </div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-xs mt-2 font-medium">
                        ... and {importResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/labor')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!file || !preview?.isValid || !selectedProject || importMutation.isPending}
          loading={importMutation.isPending}
        >
          <UploadIcon className="h-4 w-4 mr-2" />
          Import Labor Data
        </Button>
      </div>

      {/* Setup Dialog for New Employees/Crafts */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'crafts' ? (
                <span className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  New Craft Types Found
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  New Employees Found
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'crafts' 
                ? 'The following craft codes need to be created before importing:'
                : 'The following employees need to be created before importing:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {setupStep === 'crafts' ? (
              // Craft setup
              newCrafts.map((craft, index) => (
                <Card key={craft.code} className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Craft Code</Label>
                      <p className="font-medium">{craft.code}</p>
                    </div>
                    <div>
                      <Label htmlFor={`craft-name-${index}`} className="text-sm">Craft Name</Label>
                      <input
                        id={`craft-name-${index}`}
                        type="text"
                        value={craft.name || craft.suggested_name}
                        onChange={(e) => {
                          const updated = [...newCrafts]
                          updated[index].name = e.target.value
                          setNewCrafts(updated)
                        }}
                        className="w-full px-3 py-1 border border-foreground/30 rounded-md"
                        placeholder="Enter craft name"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm mb-2 block">Labor Category</Label>
                      <RadioGroup
                        value={craft.labor_category || ''}
                        onValueChange={(value: string) => {
                          const updated = [...newCrafts]
                          updated[index].labor_category = value as 'direct' | 'indirect' | 'staff'
                          setNewCrafts(updated)
                        }}
                      >
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="direct" id={`direct-${index}`} />
                            <Label htmlFor={`direct-${index}`}>Direct</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="indirect" id={`indirect-${index}`} />
                            <Label htmlFor={`indirect-${index}`}>Indirect</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="staff" id={`staff-${index}`} />
                            <Label htmlFor={`staff-${index}`}>Staff</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Employee setup
              newEmployees.map((employee, index) => (
                <Card key={employee.employee_number} className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Employee ID</Label>
                      <p className="font-medium">{employee.employee_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm">Name</Label>
                      <p className="font-medium">{employee.last_name}, {employee.first_name}</p>
                    </div>
                    <div>
                      <Label className="text-sm">Rate (w/28% Burden)</Label>
                      <p className="font-medium">{formatCurrency(employee.base_rate * 1.28)}/hr</p>
                    </div>
                    <div>
                      <Label htmlFor={`craft-${index}`} className="text-sm">Craft Type</Label>
                      <Select
                        value={employee.craft_type_id || ''}
                        onValueChange={(value) => {
                          const updated = [...newEmployees]
                          updated[index].craft_type_id = value
                          
                          // Set is_direct based on craft category
                          const craft = craftTypesData?.craftTypes?.find((c: { id: string; category: string }) => c.id === value)
                          if (craft) {
                            updated[index].is_direct = craft.category === 'direct'
                          }
                          
                          setNewEmployees(updated)
                        }}
                      >
                        <SelectTrigger id={`craft-${index}`}>
                          <SelectValue placeholder="Select craft type" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Show matching craft code first */}
                          {craftTypesData?.craftTypes
                            ?.filter((craft: { code: string }) => craft.code === employee.craft_code)
                            .map((craft: { id: string; name: string; code: string }) => (
                              <SelectItem key={craft.id} value={craft.id}>
                                {craft.name} ({craft.code}) ✓
                              </SelectItem>
                            ))}
                          {/* Then show all other crafts */}
                          {craftTypesData?.craftTypes
                            ?.filter((craft: { code: string }) => craft.code !== employee.craft_code)
                            .map((craft: { id: string; name: string; code: string }) => (
                              <SelectItem key={craft.id} value={craft.id}>
                                {craft.name} ({craft.code})
                              </SelectItem>
                            ))}
                          {/* Show message if no crafts available */}
                          {(!craftTypesData?.craftTypes || craftTypesData.craftTypes.length === 0) && (
                            <div className="px-2 py-1 text-sm text-foreground/60">No craft types available</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetupComplete}
              disabled={isProcessingSetup || (
                setupStep === 'crafts' 
                  ? !newCrafts.every(c => c.name && c.labor_category)
                  : !newEmployees.every(e => e.craft_type_id)
              )}
              loading={isProcessingSetup}
            >
              {setupStep === 'crafts' && newEmployees.length > 0
                ? 'Next: Employees'
                : 'Complete Setup & Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}