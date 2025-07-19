'use client'

import { use, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { 
  AlertCircle, 
  CheckCircle,
  Download,
  ArrowLeft,
  Info,
  Upload as UploadIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUser } from '@/hooks/use-auth'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { BudgetBreakdownImportResult, BudgetBreakdownImportRow } from '@/types/budget-breakdown'

interface PreviewData {
  headers: string[]
  rows: BudgetBreakdownImportRow[]
  isValid: boolean
  errors: string[]
  totalValue: number
  totalManhours: number
}

// Zod schema for validating Excel/CSV row data
const budgetImportRowSchema = z.object({
  // Handle various field name variations from Excel
  Discipline: z.string().optional(),
  discipline: z.string().optional(),
  'Cost Type': z.string().optional(),
  cost_type: z.string().optional(),
  costType: z.string().optional(),
  Manhours: z.union([z.string(), z.number()]).optional(),
  manhours: z.union([z.string(), z.number()]).optional(),
  Hours: z.union([z.string(), z.number()]).optional(),
  Value: z.union([z.string(), z.number()]).optional(),
  value: z.union([z.string(), z.number()]).optional(),
  Amount: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  Description: z.string().optional(),
  description: z.string().optional(),
}).transform((val) => {
  // Transform to match database schema (cost_type, not costType)
  const discipline = val.Discipline || val.discipline || ''
  const cost_type = val['Cost Type'] || val.cost_type || val.costType || ''
  const manhours = Number(val.Manhours || val.manhours || val.Hours || 0) || 0
  const value = Number(val.Value || val.value || val.Amount || val.amount || 0) || 0
  const description = val.Description || val.description || ''
  
  return {
    discipline,
    cost_type,
    manhours,
    value,
    description
  }
})

// Type for validated row data matching DB schema
type ValidatedBudgetRow = z.infer<typeof budgetImportRowSchema>

// Keep the UI type for display purposes
interface BudgetBreakdownImportRowUI {
  discipline: string
  costType: string  // UI uses costType
  manhours?: number | string
  value: number | string
  description?: string
}

interface BudgetImportPageProps {
  params: Promise<{ id: string }>
}

export default function BudgetImportPage({ params }: BudgetImportPageProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const { id: projectId } = use(params)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<BudgetBreakdownImportResult | null>(null)
  const [clearExisting, setClearExisting] = useState(false)

  // Check permissions - controller or delegated user with import_budget permission
  const [canImport, setCanImport] = useState(false)
  
  // Check if user has permission to import budget
  useQuery({
    queryKey: ['project-permission', projectId, 'import_budget'],
    queryFn: async () => {
      // Controllers always have permission
      if (user?.role === 'controller') {
        setCanImport(true)
        return true
      }
      
      // Check delegation permissions
      const response = await fetch(`/api/projects/${projectId}/check-permission?permission=import_budget`)
      if (response.ok) {
        const { hasPermission } = await response.json()
        setCanImport(hasPermission)
        return hasPermission
      }
      
      setCanImport(false)
      return false
    },
    enabled: !!user && !!projectId
  })

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      return data.project
    }
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/project-budget-breakdowns/import', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      setImportResult(data.data)
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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportResult(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Look for BUDGETS sheet first, fallback to first sheet
      let worksheetName = workbook.SheetNames[0]
      if (workbook.SheetNames.includes('BUDGETS')) {
        worksheetName = 'BUDGETS'
      }
      const worksheet = workbook.Sheets[worksheetName]
      
      // Check if we should use positional parsing (for BUDGETS sheet format)
      const usePositionalParsing = worksheetName === 'BUDGETS'
      
      if (usePositionalParsing) {
        // Use same parsing logic as new project creation
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
        const rows: unknown[][] = []
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const row: unknown[] = []
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
            const cell = worksheet[cellAddress]
            // Use formatted value (w) if available, otherwise raw value (v)
            row.push(cell ? (cell.w || cell.v) : undefined)
          }
          rows.push(row)
        }
        
        // Process ALL budget data using positional format (same as project creation)
        const allRows: BudgetBreakdownImportRow[] = []
        let currentDiscipline = ''
        const disciplineCounts: Record<string, number> = {}
        
        // Debug: Track parsing progress
        const debugInfo: string[] = []
        const disciplinesFound = new Set<string>()
        let skippedRows = 0
        let rowsWithData = 0
        
        // Process ALL rows without deduplication
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          // Clean and extract cell values
          const disciplineName = row[1] ? String(row[1]).trim() : ''
          const description = row[3] ? String(row[3]).trim() : ''
          const manhours = row[4]
          const value = row[5]
          
          // Debug: Log discipline detection
          if (disciplineName) {
            const newDiscipline = disciplineName.toUpperCase()
            // Update current discipline immediately when found
            currentDiscipline = newDiscipline
            console.log(`Row ${i + 1}: Found discipline: "${newDiscipline}" (raw: "${disciplineName}")`)
            debugInfo.push(`Row ${i + 1}: New discipline detected: ${newDiscipline}`)
            disciplinesFound.add(newDiscipline)
          }
          
          // Check if row has any data
          if (row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
            rowsWithData++
          }
          
          // Skip rows without both description and value, but be more lenient
          if (!description && !value) {
            skippedRows++
            continue
          }
          
          // Skip if we still don't have a discipline set
          if (!currentDiscipline) {
            debugInfo.push(`Row ${i + 1}: Skipped - no discipline set yet`)
            skippedRows++
            continue
          }
          
          // Skip if missing critical data
          if (!description || value === undefined || value === null || value === '') {
            debugInfo.push(`Row ${i + 1}: Skipped - missing ${!description ? 'description' : 'value'} (discipline: ${currentDiscipline})`)
            skippedRows++
            continue
          }
          
          
          if (description.toUpperCase().includes('TOTAL') || 
              description.toUpperCase() === 'ALL LABOR') {
            debugInfo.push(`Row ${i + 1}: Skipped - total row (${description})`)
            skippedRows++
            continue
          }
          
          // Parse numeric values more robustly
          let numericValue = 0
          if (typeof value === 'number') {
            numericValue = value
          } else if (value) {
            // Handle formats like " $-   " or "$0.00"
            const cleaned = String(value).replace(/[$,\s]/g, '').replace(/-+$/, '0')
            numericValue = parseFloat(cleaned) || 0
          }
          
          const numericManhours = manhours ? (typeof manhours === 'number' ? manhours : parseFloat(String(manhours).replace(/[$,]/g, '') || '0')) : null
          
          if (numericValue < 0) {
            debugInfo.push(`Row ${i + 1}: Skipped - negative value`)
            skippedRows++
            continue
          }
          
          // Add all rows without deduplication
          allRows.push({
            discipline: currentDiscipline,
            costType: description.trim().toUpperCase(),
            manhours: numericManhours ?? undefined,
            value: numericValue,
            description: ''
          })
          
          // Track count per discipline
          disciplineCounts[currentDiscipline] = (disciplineCounts[currentDiscipline] || 0) + 1
          
          // Debug successful addition
          if (numericValue === 0) {
            debugInfo.push(`Row ${i + 1}: Added zero-value item: ${description} for ${currentDiscipline}`)
          }
        }
        
        // Show all items in preview
        const previewRows = allRows
        
        // Calculate totals from all rows
        const totalValue = allRows.reduce((sum, row) => {
          const value = typeof row.value === 'number' ? row.value : parseFloat(row.value.toString() || '0')
          return sum + value
        }, 0)
        
        const totalManhours = allRows.reduce((sum, row) => {
          const manhours = typeof row.manhours === 'number' ? row.manhours : (row.manhours ? parseFloat(row.manhours.toString() || '0') : 0)
          return sum + manhours
        }, 0)
        
        // Add summary info to errors array (using it for info messages)
        const summaryInfo = Object.entries(disciplineCounts)
          .map(([discipline, count]) => `${discipline}: ${count} items`)
          .join(', ')
        
        // Create detailed debug summary
        const debugSummary = [
          `Found ${allRows.length} total items across disciplines: ${summaryInfo}`,
          `Total rows in sheet: ${rows.length - 1}`,
          `Rows with data: ${rowsWithData}`,
          `Disciplines detected: ${Array.from(disciplinesFound).join(', ')}`,
          `Skipped rows: ${skippedRows}`,
          ...debugInfo.slice(0, 5) // Show first 5 debug messages
        ]
        
        if (debugInfo.length > 5) {
          debugSummary.push(`... and ${debugInfo.length - 5} more debug messages`)
        }
        
        console.log('Budget Import Debug:', {
          totalRows: rows.length - 1,
          rowsWithData,
          disciplinesFound: Array.from(disciplinesFound),
          validItems: allRows.length,
          skippedRows,
          disciplineBreakdown: disciplineCounts,
          range: worksheet['!ref']
        })
        
        setPreview({
          headers: ['Row', 'Discipline', 'Blank', 'Cost Type', 'Manhours', 'Value'],
          rows: previewRows,
          isValid: allRows.length > 0,
          errors: allRows.length === 0 ? ['No valid budget data found in BUDGETS sheet'] : debugSummary,
          totalValue,
          totalManhours
        })
      } else {
        // Use standard JSON parsing for other formats
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null })
        
        if (!jsonData || jsonData.length === 0) {
          setPreview({
            headers: [],
            rows: [],
            isValid: false,
            errors: ['No data found in file'],
            totalValue: 0,
            totalManhours: 0
          })
          return
        }

        // Get headers from first row
        const headers = Object.keys(jsonData[0] as Record<string, unknown>)
        
        // Process ALL rows with validation
        const validationResults = jsonData.map((row, index) => {
          const result = budgetImportRowSchema.safeParse(row)
          return { result, index }
        })
        
        // Separate valid and invalid rows
        const validRows = validationResults
          .filter(({ result }) => result.success)
          .map(({ result }) => result.data as ValidatedBudgetRow)
        
        const errors = validationResults
          .filter(({ result }) => !result.success)
          .map(({ result, index }) => `Row ${index + 1}: ${result.error?.message || 'Invalid data'}`)
        
        // Transform validated rows to UI format (cost_type -> costType)
        const allRows: BudgetBreakdownImportRowUI[] = validRows.map(row => ({
          discipline: row.discipline,
          costType: row.cost_type,  // Transform back to UI field name
          manhours: row.manhours,
          value: row.value,
          description: row.description
        }))

        // Show all rows in preview
        const rows = allRows

        // Calculate totals
        const totalValue = allRows.reduce((sum, row) => {
          const value = typeof row.value === 'number' ? row.value : parseFloat(row.value.toString() || '0')
          return sum + value
        }, 0)
        
        const totalManhours = allRows.reduce((sum, row) => {
          const manhours = typeof row.manhours === 'number' ? row.manhours : (row.manhours ? parseFloat(row.manhours.toString() || '0') : 0)
          return sum + manhours
        }, 0)

        // Combine validation errors with header errors
        const allErrors: string[] = [...errors]
        const requiredHeaders = ['discipline', 'cost_type', 'value']
        const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s_-]+/g, '_'))
        
        for (const required of requiredHeaders) {
          if (!normalizedHeaders.some(h => h.includes(required.replace('_', '')))) {
            allErrors.push(`Missing required column: ${required}`)
          }
        }

        setPreview({
          headers,
          rows,
          isValid: allErrors.length === 0 && allRows.length > 0,
          errors: allErrors.length > 0 ? allErrors : allRows.length === 0 ? ['No valid data found in file'] : [],
          totalValue,
          totalManhours
        })
      }
    } catch {
      setPreview({
        headers: [],
        rows: [],
        isValid: false,
        errors: ['Failed to read Excel file'],
        totalValue: 0,
        totalManhours: 0
      })
    }
  }, [])

  const handleImport = async () => {
    if (!file || !preview?.isValid) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)
    formData.append('clearExisting', clearExisting.toString())

    await importMutation.mutateAsync(formData)
  }

  const downloadTemplate = () => {
    // Create sample data
    const templateData = [
      { Discipline: 'PIPING', 'Cost Type': 'DIRECT LABOR', Manhours: 1000, Value: 50000, Description: 'Piping installation labor' },
      { Discipline: 'PIPING', 'Cost Type': 'MATERIALS', Manhours: 0, Value: 25000, Description: 'Piping materials' },
      { Discipline: 'STEEL', 'Cost Type': 'DIRECT LABOR', Manhours: 500, Value: 25000, Description: 'Steel erection labor' },
      { Discipline: 'STEEL', 'Cost Type': 'MATERIALS', Manhours: 0, Value: 15000, Description: 'Steel materials' },
      { Discipline: 'ELECTRICAL', 'Cost Type': 'DIRECT LABOR', Manhours: 800, Value: 40000, Description: 'Electrical installation' },
      { Discipline: 'ELECTRICAL', 'Cost Type': 'MATERIALS', Manhours: 0, Value: 20000, Description: 'Electrical materials' },
    ]

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Budget Breakdown')

    // Save file
    XLSX.writeFile(wb, 'budget_breakdown_template.xlsx')
  }

  if (!canImport) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>You don&apos;t have permission to import budget breakdowns for this project</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Import Budget Breakdown</h1>
            <p className="text-foreground/80">
              Project: {project?.job_number} - {project?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <Card className="mb-6 p-6">
        <div className="flex gap-4">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-semibold">Import Instructions</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground/80">
              <li>Upload an Excel file (.xlsx) containing budget breakdown data</li>
              <li>Supported formats:</li>
              <li className="ml-4">• BUDGETS sheet: Uses positional format (same as new project creation)</li>
              <li className="ml-4">• Standard format: Requires columns - Discipline, Cost Type, Value</li>
              <li>Optional columns: Manhours, Description</li>
              <li>Discipline examples: PIPING, STEEL, ELECTRICAL, INSTRUMENTATION</li>
              <li>Cost Type examples: DIRECT LABOR, MATERIALS, EQUIPMENT, SUBCONTRACT</li>
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="mt-2"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>
        </div>
      </Card>

      {/* File Upload */}
      <Card className="mb-6 p-6">
        <h3 className="font-semibold mb-4">Select File</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && (
              <span className="text-sm text-foreground/80">
                {file.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="clearExisting"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="clearExisting" className="text-sm">
              Clear existing budget breakdowns before importing
            </label>
          </div>
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6 p-6">
          <h3 className="font-semibold mb-4">Preview</h3>
          {preview.errors.length > 0 && !preview.isValid ? (
            <div className="space-y-2">
              {preview.errors.map((error, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {preview.isValid && preview.errors.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">{preview.errors[0]}</span>
                  </div>
                </div>
              )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">Discipline</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Cost Type</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Manhours</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Value</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm">{row.discipline}</td>
                      <td className="px-4 py-2 text-sm">{row.costType}</td>
                      <td className="px-4 py-2 text-sm text-right">{row.manhours || '-'}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        ${typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                      </td>
                      <td className="px-4 py-2 text-sm">{row.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="bg-gray-50">
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                      Total (All {preview.totalValue !== undefined ? 'Items' : 'Rows'})
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      {preview.totalManhours?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      ${preview.totalValue?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-sm text-foreground/60 mt-2">
                Showing all {preview.rows.length} items
              </p>
            </div>
            </>
          )}
        </Card>
      )}

      {/* Import Button */}
      {preview?.isValid && !importResult && (
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending}
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Importing...' : 'Import Budget Breakdown'}
          </Button>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-600">Import Successful</h3>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-600">Import Completed with Errors</h3>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-foreground/60">Imported</p>
                <p className="text-2xl font-semibold">{importResult.imported}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60">Updated</p>
                <p className="text-2xl font-semibold">{importResult.updated}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60">Skipped</p>
                <p className="text-2xl font-semibold">{importResult.skipped}</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Errors:</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {importResult.errors.map((error, i) => (
                    <div key={i} className="text-sm text-red-600">
                      Row {error.row}: {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  setImportResult(null)
                }}
              >
                Import Another File
              </Button>
              <Button
                onClick={() => router.push(`/projects/${projectId}`)}
              >
                Back to Project
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}