'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Upload as UploadIcon, 
  CircleAlert, 
  CircleCheck,
  Download,
  ArrowLeft,
  Info as InfoIcon,
  FileSpreadsheet,
  Users,
  Briefcase,
  Wrench,
  ChevronDown,
  ChevronUp,
  AlertCircle
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
import { toast } from 'sonner'
import { parseExcelDate, EXCEL_HEADERS, EXCEL_COLUMNS } from '@/lib/validations/labor-import'
import type { LaborImportResult } from '@/lib/validations/labor-import'
import { EmployeeDataFixModal } from '@/components/labor/employee-data-fix-modal'
import { BulkEmployeeFix } from '@/components/labor/bulk-employee-fix'
import { ImportProgressIndicator } from '@/components/labor/import-progress-indicator'
import { ErrorDetailsPanel } from '@/components/labor/error-details-panel'

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
  const [files, setFiles] = useState<File[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>(preselectedProjectId || '')
  const [importResults, setImportResults] = useState<Map<string, LaborImportResult>>(new Map())
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const [showRateFixModal, setShowRateFixModal] = useState(false)
  const [employeesToFixRates, setEmployeesToFixRates] = useState<Array<{
    employee_number: string
    name: string
    current_rate: number
    new_rate: number
  }>>([])
  
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
  
  // State for employee data fix
  const [employeesToFix, setEmployeesToFix] = useState<any[]>([])
  const [showBulkFix, setShowBulkFix] = useState(false)
  const [showSingleFix, setShowSingleFix] = useState(false)
  const [selectedEmployeeToFix, setSelectedEmployeeToFix] = useState<any>(null)
  const [hasFixedEmployees, setHasFixedEmployees] = useState(false)
  const [isAutoRetrying, setIsAutoRetrying] = useState(false)

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

  // Function to parse errors and extract employees with missing data
  const parseEmployeeErrors = (errors: any[]) => {
    const employeeMap = new Map<string, any>()
    
    errors.forEach(error => {
      // Check for base_rate=0 errors
      if (error.message?.includes('base_rate=0') || error.message?.includes('skipping wage calculations')) {
        const data = error.data || {}
        if (data.employee_number) {
          // Only add if not already in the map (deduplication)
          if (!employeeMap.has(data.employee_number)) {
            // Try to find employee info from preview
            const previewEmp = preview?.employees.find(e => e.employeeId === data.employee_number)
            employeeMap.set(data.employee_number, {
              employee_number: data.employee_number,
              first_name: previewEmp?.firstName || data.name?.split(',')[1]?.trim() || '',
              last_name: previewEmp?.lastName || data.name?.split(',')[0]?.trim() || '',
              base_rate: 0,
              error_message: error.message,
              row: error.row
            })
          }
        }
      }
    })
    
    // Convert map values to array (deduplicated list)
    return Array.from(employeeMap.values())
  }

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
      // Clear auto-retry flag when import completes
      setIsAutoRetrying(false)
      
      // Check for employees with missing data
      if (data.errors && data.errors.length > 0) {
        const employeesNeedingFix = parseEmployeeErrors(data.errors)
        if (employeesNeedingFix.length > 0) {
          setEmployeesToFix(employeesNeedingFix)
        }
      }
      // Store result for current file
      if (files[currentFileIndex]) {
        const newResults = new Map(importResults)
        newResults.set(files[currentFileIndex].name, data)
        setImportResults(newResults)
      }
      
      // If import was fully successful (no employees to fix), refresh the page after a short delay
      if (data.success && (!data.errors || data.errors.length === 0)) {
        setTimeout(() => {
          window.location.reload()
        }, 2000) // 2 second delay to show success message
      }
    },
    onError: (error) => {
      // Clear auto-retry flag on error
      setIsAutoRetrying(false)
      
      // Store error result for current file
      if (files[currentFileIndex]) {
        const newResults = new Map(importResults)
        newResults.set(files[currentFileIndex].name, {
          success: false,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [{
            row: 0,
            message: error.message
          }]
        })
        setImportResults(newResults)
      }
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
    setPreview(null)

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
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    
    // Convert FileList to Array and filter for Excel files
    const excelFiles = Array.from(selectedFiles).filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    )
    
    if (excelFiles.length === 0) {
      toast.error('Please select Excel files (.xlsx or .xls)')
      return
    }
    
    // Set files and process the first one for preview
    setFiles(excelFiles)
    setCurrentFileIndex(0)
    setImportResults(new Map())
    
    if (excelFiles.length > 0) {
      await processFile(excelFiles[0])
    }
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

    const droppedFiles = Array.from(e.dataTransfer.files)
    const excelFiles = droppedFiles.filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    )

    if (excelFiles.length > 0) {
      // Set files and process the first one for preview
      setFiles(excelFiles)
      setCurrentFileIndex(0)
      setImportResults(new Map())
      await processFile(excelFiles[0])
    } else {
      // Show error for invalid file type
      setPreview({
        contractorNumber: '',
        contractorInfo: null,
        weekEnding: new Date(),
        employees: [],
        totals: { employees: 0, totalHours: 0, totalCost: 0 },
        isValid: false,
        errors: ['Please drop Excel files (.xlsx or .xls)']
      })
    }
  }, [processFile])

  const extractEmployeesNeedingRates = () => {
    const employeeMap = new Map<string, { name: string, current_rate: number }>()
    
    // Extract from all error messages across all results
    Array.from(importResults.values()).forEach(result => {
      if (result.errors) {
        result.errors.forEach(error => {
          if (error.message?.includes('base_rate=0') || 
              error.message?.includes('Employee has base_rate=0') ||
              error.message?.includes('New employee created with base_rate=0')) {
            
            // Try to extract employee info from error data if available
            let employeeNumber = null
            let name = 'Unknown'
            
            // First check if employee data is in the error object
            if (error.data && typeof error.data === 'object') {
              const errorData = error.data as any
              if (errorData.employee_number) {
                employeeNumber = errorData.employee_number
              }
              if (errorData.name) {
                name = errorData.name
              }
            }
            
            // If not found in data, try to extract from message (format: T####)
            if (!employeeNumber) {
              const employeeMatch = error.message.match(/T\d+/)
              if (employeeMatch) {
                employeeNumber = employeeMatch[0]
                
                // Extract name if available
                const nameMatch = error.message.match(/T\d+\s*-?\s*([^,]+)/) || 
                                  error.message.match(/employee:\s*([^,]+)/)
                if (nameMatch && nameMatch[1]) {
                  name = nameMatch[1].trim()
                }
              }
            }
            
            // If still no employee number, check for generic error at specific row
            if (!employeeNumber && error.row) {
              // This might be a generic error without employee ID
              // We'll need to look at the preview data or make a note
              employeeNumber = `Row_${error.row}`
              name = `Employee at row ${error.row}`
            }
            
            // Store unique employees
            if (employeeNumber && !employeeMap.has(employeeNumber)) {
              employeeMap.set(employeeNumber, { name, current_rate: 0 })
            }
          }
        })
      }
    })
    
    // Convert to array for the modal
    return Array.from(employeeMap.entries()).map(([employee_number, data]) => ({
      employee_number,
      name: data.name,
      current_rate: data.current_rate,
      new_rate: 0
    }))
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    
    // Clear results for removed file
    const removedFileName = files[index].name
    const newResults = new Map(importResults)
    newResults.delete(removedFileName)
    setImportResults(newResults)
    
    // If removing current file, show next or clear preview
    if (index === currentFileIndex) {
      if (newFiles.length > 0) {
        const newIndex = Math.min(index, newFiles.length - 1)
        setCurrentFileIndex(newIndex)
        processFile(newFiles[newIndex])
      } else {
        setPreview(null)
        setCurrentFileIndex(0)
      }
    } else if (index < currentFileIndex) {
      setCurrentFileIndex(currentFileIndex - 1)
    }
  }

  const handleImport = async () => {
    if (files.length === 0 || !selectedProject) {
      toast.error('Please select files and a project')
      return
    }

    setIsProcessingBatch(true)
    const results = new Map<string, LaborImportResult>()

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentFileIndex(i)
      
      // Process file to get preview
      await processFile(file)
      
      // Wait a moment for preview to be set
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_id', selectedProject)
      
      // If we just completed setup, add timestamp to force fresh queries
      if (justCompletedSetup) {
        formData.append('force_refresh', Date.now().toString())
      }

      try {
        const response = await fetch('/api/labor-import', {
          method: 'POST',
          body: formData
        })
        
        const data = await response.json()
        results.set(file.name, data)
        setImportResults(new Map(results))
        
        if (!response.ok) {
          console.error(`Failed to import ${file.name}:`, data.error)
        }
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error)
        results.set(file.name, {
          success: false,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [{
            row: 0,
            message: error instanceof Error ? error.message : 'Import failed'
          }]
        })
        setImportResults(new Map(results))
      }
    }

    setIsProcessingBatch(false)
    setJustCompletedSetup(false)
    
    // Show summary
    const totalImported = Array.from(results.values()).reduce((sum, r) => sum + r.imported, 0)
    const totalUpdated = Array.from(results.values()).reduce((sum, r) => sum + r.updated, 0)
    const totalErrors = Array.from(results.values()).reduce((sum, r) => sum + r.errors.length, 0)
    
    if (totalErrors === 0) {
      toast.success(`Successfully processed ${files.length} file(s): ${totalImported} imported, ${totalUpdated} updated`)
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } else {
      toast.warning(`Processed ${files.length} file(s) with ${totalErrors} total errors`)
    }
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
      
      // Show success message
      toast.success('Setup completed successfully! Crafts and employees have been created. Please click "Import Labor Data" again to import the files.')
      
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
          <CircleAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
            multiple
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
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-foreground/80">
                  Excel files (.xlsx, .xls) - Multiple files supported
                </p>
              </>
            )}
          </label>
        </div>
      </Card>

      {/* Selected Files List */}
      {files.length > 0 && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Selected Files ({files.length})</h3>
          <div className="space-y-2">
            {files.map((file, index) => {
              const result = importResults.get(file.name)
              const isExpanded = expandedErrors.has(file.name)
              const hasErrors = result && result.errors && result.errors.length > 0
              
              // Parse errors to find employee issues
              const employeeErrors = result?.errors?.filter(e => 
                e.message?.includes('base_rate=0') || 
                e.message?.includes('Employee has base_rate=0') ||
                e.message?.includes('New employee created with base_rate=0')
              ) || []
              
              const otherErrors = result?.errors?.filter(e => 
                !e.message?.includes('base_rate=0') && 
                !e.message?.includes('Employee has base_rate=0') &&
                !e.message?.includes('New employee created with base_rate=0')
              ) || []
              
              return (
                <div key={`${file.name}-${index}`}>
                  <div 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      currentFileIndex === index && "bg-blue-50 border-blue-300",
                      result?.success === true && "bg-green-50 border-green-300",
                      result?.success === false && "bg-red-50 border-red-300"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileSpreadsheet className="h-5 w-5 text-foreground/60" />
                      <div className="flex-1">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-foreground/60">
                          {(file.size / 1024).toFixed(1)} KB
                          {result && (
                            <span className="ml-2">
                              {result.success ? (
                                <span className="text-green-600">
                                  ✓ Processed ({result.imported + result.updated} records)
                                </span>
                              ) : (
                                <span className="text-red-600">
                                  ✗ Failed {hasErrors && `(${result.errors.length} errors)`}
                                </span>
                              )}
                            </span>
                          )}
                          {isProcessingBatch && currentFileIndex === index && (
                            <span className="ml-2 text-blue-600">Processing...</span>
                          )}
                        </p>
                        {hasErrors && employeeErrors.length > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            <AlertCircle className="inline h-3 w-3 mr-1" />
                            {employeeErrors.length} employee(s) missing pay rates
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasErrors && !isProcessingBatch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newExpanded = new Set(expandedErrors)
                            if (isExpanded) {
                              newExpanded.delete(file.name)
                            } else {
                              newExpanded.add(file.name)
                            }
                            setExpandedErrors(newExpanded)
                          }}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                      {currentFileIndex !== index && !isProcessingBatch && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentFileIndex(index)
                            processFile(files[index])
                          }}
                        >
                          Preview
                        </Button>
                      )}
                      {!isProcessingBatch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Error Details */}
                  {isExpanded && hasErrors && (
                    <div className="mt-2 ml-8 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {employeeErrors.length > 0 && (
                        <div className="mb-3">
                          <h5 className="font-medium text-sm text-amber-800 mb-2">
                            Employees Missing Pay Rates:
                          </h5>
                          <div className="space-y-1">
                            {employeeErrors.slice(0, 5).map((error, i) => (
                              <div key={i} className="text-xs text-gray-700">
                                • Row {error.row}: {error.message}
                              </div>
                            ))}
                            {employeeErrors.length > 5 && (
                              <p className="text-xs text-gray-500 italic">
                                ... and {employeeErrors.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {otherErrors.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm text-red-800 mb-2">
                            Other Errors:
                          </h5>
                          <div className="space-y-1">
                            {otherErrors.slice(0, 3).map((error, i) => (
                              <div key={i} className="text-xs text-gray-700">
                                • {error.row > 0 ? `Row ${error.row}: ` : ''}{error.message}
                              </div>
                            ))}
                            {otherErrors.length > 3 && (
                              <p className="text-xs text-gray-500 italic">
                                ... and {otherErrors.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Batch Processing Status */}
          {isProcessingBatch && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-sm text-blue-700">
                  Processing file {currentFileIndex + 1} of {files.length}...
                </p>
              </div>
            </div>
          )}
          
          {/* Batch Results Summary */}
          {importResults.size > 0 && !isProcessingBatch && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Import Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-foreground/60">Successful</p>
                  <p className="font-semibold text-green-600">
                    {Array.from(importResults.values()).filter(r => r.success).length}
                  </p>
                </div>
                <div>
                  <p className="text-foreground/60">Failed</p>
                  <p className="font-semibold text-red-600">
                    {Array.from(importResults.values()).filter(r => !r.success).length}
                  </p>
                </div>
                <div>
                  <p className="text-foreground/60">Total Records</p>
                  <p className="font-semibold">
                    {Array.from(importResults.values()).reduce((sum, r) => sum + r.imported + r.updated, 0)}
                  </p>
                </div>
              </div>
              
              {/* Check for employee errors across all files */}
              {(() => {
                const allEmployeeErrors = Array.from(importResults.values())
                  .flatMap(r => r.errors || [])
                  .filter(e => 
                    e.message?.includes('base_rate=0') || 
                    e.message?.includes('Employee has base_rate=0') ||
                    e.message?.includes('New employee created with base_rate=0')
                  )
                
                if (allEmployeeErrors.length > 0) {
                  // Extract unique employee numbers - same logic as extractEmployeesNeedingRates
                  const uniqueEmployees = new Set<string>()
                  allEmployeeErrors.forEach(error => {
                    // Check data field first
                    if (error.data && typeof error.data === 'object') {
                      const errorData = error.data as any
                      if (errorData.employee_number) {
                        uniqueEmployees.add(errorData.employee_number)
                        return
                      }
                    }
                    
                    // Fall back to regex extraction
                    const match = error.message?.match(/T\d+/)
                    if (match) {
                      uniqueEmployees.add(match[0])
                    } else if (error.row) {
                      // Use row as fallback
                      uniqueEmployees.add(`Row_${error.row}`)
                    }
                  })
                  
                  return (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">
                            Employee Pay Rate Issues Detected
                          </p>
                          <p className="text-xs text-amber-800 mt-1">
                            {uniqueEmployees.size} employee(s) are missing pay rates across {
                              Array.from(importResults.entries())
                                .filter(([_, r]) => r.errors?.some(e => e.message?.includes('base_rate=0')))
                                .length
                            } file(s)
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 bg-amber-100 hover:bg-amber-200 border-amber-300"
                            onClick={() => {
                              // Debug: log all errors to see their structure
                              Array.from(importResults.values()).forEach(result => {
                                if (result.errors) {
                                  console.log('Import errors:', result.errors)
                                }
                              })
                              
                              const employeesToFix = extractEmployeesNeedingRates()
                              console.log('Extracted employees to fix:', employeesToFix)
                              setEmployeesToFixRates(employeesToFix)
                              setShowRateFixModal(true)
                            }}
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            Fix Employee Rates
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )}
        </Card>
      )}

      {/* Preview */}
      {preview && currentFileIndex < files.length && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            Preview: {files[currentFileIndex]?.name}
          </h3>
          
          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-start">
                <CircleAlert className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
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
                    <CircleAlert className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
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

      {/* Auto-Retry Progress */}
      {isAutoRetrying && (
        <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div>
              <h3 className="font-semibold text-blue-900">Retrying Import</h3>
              <p className="text-sm text-blue-700">Importing labor data with updated employee information...</p>
            </div>
          </div>
        </Card>
      )}

      {/* Import Result - Now shown in file list above */}
      {false && (
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            {/* Status Header */}{/* 
            <div className="flex items-start gap-3">
              {employeesToFix.length > 0 ? (
                <InfoIcon className="h-6 w-6 text-amber-600 mt-0.5" />
              ) : importResult.success ? (
                <CircleCheck className="h-6 w-6 text-green-600 mt-0.5" />
              ) : (
                <CircleAlert className="h-6 w-6 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  {(importResult as any).message ? 'Setup Completed' : 
                   employeesToFix.length > 0 ? 'Import Partially Complete' : 
                   `Import ${importResult.success ? 'Completed' : 'Failed'}`}
                </h3>
                {(importResult as any).message ? (
                  <p className="text-sm text-foreground">{(importResult as any).message}</p>
                ) : null}
              </div>
            </div>
            
            {/* Progress Indicator */}
            {(importResult as any).employeeCount && employeesToFix.length > 0 && (
              <ImportProgressIndicator
                totalEmployees={(importResult as any).employeeCount}
                processedEmployees={(importResult as any).employeeCount}
                errors={employeesToFix.length}
              />
            )}
            
            {/* Action Section for Fixing Employees */}
            {employeesToFix.length > 0 && (
              <Card className="p-6 bg-blue-50 border-blue-200">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Next Step: Update Employee Wages</h4>
                  </div>
                  <p className="text-sm text-blue-800">
                    We need hourly wage rates for {employeesToFix.length} employee{employeesToFix.length > 1 ? 's' : ''} to complete
                    your import. This usually takes 2-3 minutes.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setShowBulkFix(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Update Employee Info ({employeesToFix.length})
                    </Button>
                    {hasFixedEmployees && (
                      <Button
                        variant="outline"
                        onClick={handleImport}
                        disabled={importMutation.isPending}
                      >
                        Retry Import
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEmployeesToFix([])
                        // Clear current file results
                        const newResults = new Map(importResults)
                        if (files[currentFileIndex]) {
                          newResults.delete(files[currentFileIndex].name)
                        }
                        setImportResults(newResults)
                      }}
                      className="text-gray-600"
                    >
                      Skip for Now
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            
            {/* Error Details Panel */}
            {employeesToFix.length > 0 && (
              <ErrorDetailsPanel
                errors={employeesToFix.map(emp => ({
                  ...emp,
                  error_message: emp.error_message || 'Missing hourly wage rate'
                }))}
                onFixIndividual={(emp) => {
                  setSelectedEmployeeToFix(emp)
                  setShowSingleFix(true)
                }}
              />
            )}
            
            {/* Success Message */}
            {importResult.success && employeesToFix.length === 0 && !((importResult as any).message) && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CircleCheck className="h-5 w-5 text-green-600" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Import completed successfully!</p>
                  {importResult.imported > 0 && (
                    <p className="text-green-800">Created new weekly labor total</p>
                  )}
                  {importResult.updated > 0 && (
                    <p className="text-green-800">Updated existing weekly labor total</p>
                  )}
                  {(importResult as any).employeeCount && (
                    <p className="text-green-800">Processed {(importResult as any).employeeCount} employees with hours</p>
                  )}
                  <p className="text-green-700 mt-1">Page will refresh automatically...</p>
                </div>
              </div>
            )}
            
            {/* True Error State (non-employee errors) */}
            {importResult.errors.length > 0 && employeesToFix.length === 0 && !importResult.success && !((importResult as any).message) && (
              <div className="mt-4">
                <p className="font-medium mb-2 text-red-800">Error Details:</p>
                <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, i) => (
                    <div key={i} className="text-xs mb-1 text-red-700">
                      {error.row > 0 ? `Row ${error.row}: ` : ''}{error.message}
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p className="text-xs mt-2 font-medium text-red-700">
                      ... and {importResult.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}
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
        
        {/* Retry Failed Button */}
        {importResults.size > 0 && Array.from(importResults.values()).some(r => !r.success) && (
          <Button
            variant="outline"
            onClick={async () => {
              // Get list of failed files
              const failedFiles = files.filter(f => {
                const result = importResults.get(f.name)
                return result && !result.success
              })
              
              if (failedFiles.length === 0) {
                toast.info('No failed files to retry')
                return
              }
              
              toast.info(`Retrying ${failedFiles.length} failed file(s)...`)
              
              // Clear previous results for failed files
              const newResults = new Map(importResults)
              failedFiles.forEach(f => newResults.delete(f.name))
              setImportResults(newResults)
              
              // Retry processing
              setIsProcessingBatch(true)
              
              for (let i = 0; i < failedFiles.length; i++) {
                const file = failedFiles[i]
                const fileIndex = files.indexOf(file)
                setCurrentFileIndex(fileIndex)
                
                await processFile(file)
                await new Promise(resolve => setTimeout(resolve, 100))
                
                const formData = new FormData()
                formData.append('file', file)
                formData.append('project_id', selectedProject)
                formData.append('force_refresh', Date.now().toString())
                
                try {
                  const response = await fetch('/api/labor-import', {
                    method: 'POST',
                    body: formData
                  })
                  
                  const data = await response.json()
                  const updatedResults = new Map(importResults)
                  updatedResults.set(file.name, data)
                  setImportResults(updatedResults)
                } catch (error) {
                  console.error(`Error retrying ${file.name}:`, error)
                }
              }
              
              setIsProcessingBatch(false)
            }}
            disabled={isProcessingBatch}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Retry Failed Files
          </Button>
        )}
        
        <Button
          onClick={handleImport}
          disabled={files.length === 0 || !selectedProject || isProcessingBatch}
          loading={isProcessingBatch}
        >
          <UploadIcon className="h-4 w-4 mr-2" />
          {files.length > 1 ? `Import ${files.length} Files` : 'Import Labor Data'}
        </Button>
      </div>

      {/* Employee Data Fix Modal */}
      {showSingleFix && selectedEmployeeToFix && (
        <EmployeeDataFixModal
          open={showSingleFix}
          onOpenChange={setShowSingleFix}
          employee={selectedEmployeeToFix}
          onSuccess={() => {
            // Mark as fixed
            setHasFixedEmployees(true)
            // Remove from fix list
            setEmployeesToFix(prev => 
              prev.filter(e => e.employee_number !== selectedEmployeeToFix.employee_number)
            )
            // Clear selection
            setSelectedEmployeeToFix(null)
          }}
        />
      )}

      {/* Bulk Employee Fix Dialog */}
      <Dialog open={showBulkFix} onOpenChange={setShowBulkFix}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fix Employee Data</DialogTitle>
            <DialogDescription>
              Update missing information for multiple employees at once.
            </DialogDescription>
          </DialogHeader>
          <BulkEmployeeFix
            employees={employeesToFix}
            autoRetry={true}
            onComplete={() => {
              setHasFixedEmployees(true)
              setShowBulkFix(false)
              
              // Auto-retry the import after a brief delay to show success
              setTimeout(() => {
                console.log('Starting auto-retry import...')
                console.log('Current state:', {
                  file: !!file,
                  preview: !!preview,
                  previewIsValid: preview?.isValid,
                  selectedProject,
                  isPending: importMutation.isPending
                })
                
                setIsAutoRetrying(true)
                setEmployeesToFix([]) // Clear the fix list
                
                // Set flag to indicate we just fixed employees (like justCompletedSetup)
                setJustCompletedSetup(true)
                
                // Call handleImport to retry with updated data
                if (file && preview?.isValid && selectedProject && !importMutation.isPending) {
                  console.log('Calling handleImport...')
                  handleImport()
                } else {
                  console.error('Cannot auto-retry: validation failed', {
                    hasFile: !!file,
                    isValid: preview?.isValid,
                    hasProject: !!selectedProject,
                    isPending: importMutation.isPending
                  })
                  setIsAutoRetrying(false)
                  
                  // Show an error message to the user
                  toast.error('Unable to auto-retry import. Please click "Retry Import" manually.')
                }
              }, 1500) // Show success message for 1.5 seconds before retrying
            }}
            onCancel={() => setShowBulkFix(false)}
          />
        </DialogContent>
      </Dialog>

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
                <Card key={`${employee.employee_number}-${index}`} className="p-4">
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

      {/* Employee Rate Fix Modal */}
      <Dialog open={showRateFixModal} onOpenChange={setShowRateFixModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Fix Employee Pay Rates
            </DialogTitle>
            <DialogDescription>
              Set hourly rates for employees to complete the import. These rates will be saved to the employee records.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {employeesToFixRates.length === 0 ? (
              <p className="text-sm text-gray-500">No employees need rate updates.</p>
            ) : (
              <>
                <div className="text-sm text-gray-600 mb-2">
                  {employeesToFixRates.length} employee(s) need pay rates:
                </div>
                {employeesToFixRates.map((employee, index) => (
                  <div key={employee.employee_number} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{employee.employee_number}</p>
                      <p className="text-sm text-gray-600">{employee.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`rate-${index}`} className="text-sm whitespace-nowrap">
                        Hourly Rate:
                      </Label>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          id={`rate-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="w-24 px-2 py-1 border rounded-md"
                          value={employee.new_rate || ''}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value) || 0
                            setEmployeesToFixRates(prev => 
                              prev.map((emp, i) => 
                                i === index ? { ...emp, new_rate: newRate } : emp
                              )
                            )
                          }}
                        />
                        <span className="text-sm text-gray-500">/hr</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Quick fill options */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Quick Fill:</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmployeesToFixRates(prev =>
                          prev.map(emp => ({ ...emp, new_rate: 25 }))
                        )
                      }}
                    >
                      $25/hr All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmployeesToFixRates(prev =>
                          prev.map(emp => ({ ...emp, new_rate: 35 }))
                        )
                      }}
                    >
                      $35/hr All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmployeesToFixRates(prev =>
                          prev.map(emp => ({ ...emp, new_rate: 50 }))
                        )
                      }}
                    >
                      $50/hr All
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRateFixModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Filter out employees with no rate set
                const employeesToUpdate = employeesToFixRates.filter(e => e.new_rate > 0)
                
                if (employeesToUpdate.length === 0) {
                  toast.error('Please set rates for at least one employee')
                  return
                }
                
                try {
                  // Filter out row-based placeholders - we can't update those directly
                  const actualEmployees = employeesToUpdate.filter(e => !e.employee_number.startsWith('Row_'))
                  const rowBasedEmployees = employeesToUpdate.filter(e => e.employee_number.startsWith('Row_'))
                  
                  if (rowBasedEmployees.length > 0 && actualEmployees.length === 0) {
                    toast.error('Unable to identify employee IDs from the file. Please check the Excel file format.')
                    return
                  }
                  
                  if (actualEmployees.length === 0) {
                    toast.error('No valid employee IDs found to update')
                    return
                  }
                  
                  // Update employee rates
                  const response = await fetch('/api/employees/batch-update-rates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      employees: actualEmployees.map(e => ({
                        employee_number: e.employee_number,
                        base_rate: e.new_rate
                      }))
                    })
                  })
                  
                  if (!response.ok) {
                    throw new Error('Failed to update employee rates')
                  }
                  
                  const result = await response.json()
                  toast.success(`Updated ${result.updated} employee rate(s)`)
                  
                  // Close modal
                  setShowRateFixModal(false)
                  setEmployeesToFixRates([])
                  
                  // Automatically retry failed files
                  const failedFiles = files.filter(f => {
                    const result = importResults.get(f.name)
                    return result && !result.success
                  })
                  
                  if (failedFiles.length > 0) {
                    toast.info(`Retrying ${failedFiles.length} file(s) with updated rates...`)
                    
                    // Clear previous results for failed files
                    const newResults = new Map(importResults)
                    failedFiles.forEach(f => newResults.delete(f.name))
                    setImportResults(newResults)
                    
                    // Retry processing
                    setIsProcessingBatch(true)
                    
                    for (let i = 0; i < failedFiles.length; i++) {
                      const file = failedFiles[i]
                      const fileIndex = files.indexOf(file)
                      setCurrentFileIndex(fileIndex)
                      
                      await processFile(file)
                      await new Promise(resolve => setTimeout(resolve, 100))
                      
                      const formData = new FormData()
                      formData.append('file', file)
                      formData.append('project_id', selectedProject)
                      formData.append('force_refresh', Date.now().toString())
                      
                      try {
                        const retryResponse = await fetch('/api/labor-import', {
                          method: 'POST',
                          body: formData
                        })
                        
                        const data = await retryResponse.json()
                        const updatedResults = new Map(importResults)
                        updatedResults.set(file.name, data)
                        setImportResults(updatedResults)
                      } catch (error) {
                        console.error(`Error retrying ${file.name}:`, error)
                      }
                    }
                    
                    setIsProcessingBatch(false)
                  }
                  
                } catch (error) {
                  console.error('Error updating rates:', error)
                  toast.error('Failed to update employee rates')
                }
              }}
              disabled={employeesToFixRates.every(e => e.new_rate === 0)}
            >
              Update Rates & Retry Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}