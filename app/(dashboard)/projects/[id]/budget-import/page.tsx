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
import { BudgetBreakdownImportResult, BudgetBreakdownImportRow } from '@/types/budget-breakdown'

interface PreviewData {
  headers: string[]
  rows: BudgetBreakdownImportRow[]
  isValid: boolean
  errors: string[]
  totalValue: number
  totalManhours: number
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

  // Check permissions
  const canImport = user?.role === 'controller'

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
            row.push(cell ? cell.v : undefined)
          }
          rows.push(row)
        }
        
        // Process ALL budget data using positional format
        const allRows: BudgetBreakdownImportRow[] = []
        let currentDiscipline = ''
        const disciplineCounts: Record<string, number> = {}
        
        // First pass: process ALL rows to capture all disciplines
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
          
          if (numericValue < 0) continue
          
          allRows.push({
            discipline: currentDiscipline,
            costType: description.trim().toUpperCase(),
            manhours: numericManhours ?? undefined,
            value: numericValue,
            description: ''
          })
          
          // Track count per discipline
          disciplineCounts[currentDiscipline] = (disciplineCounts[currentDiscipline] || 0) + 1
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
        
        setPreview({
          headers: ['Row', 'Discipline', 'Blank', 'Cost Type', 'Manhours', 'Value'],
          rows: previewRows,
          isValid: allRows.length > 0,
          errors: allRows.length === 0 ? ['No valid budget data found in BUDGETS sheet'] : [`Found ${allRows.length} total items across disciplines: ${summaryInfo}`],
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
        
        // Process ALL rows to calculate totals
        const allRows: BudgetBreakdownImportRow[] = jsonData.map((row: Record<string, unknown>) => ({
          discipline: String(row.Discipline || row.discipline || ''),
          costType: String(row['Cost Type'] || row.cost_type || row.costType || ''),
          manhours: Number(row.Manhours || row.manhours || row.Hours || 0),
          value: Number(row.Value || row.value || row.Amount || row.amount || 0),
          description: String(row.Description || row.description || '')
        }))

        // Get preview rows (first 10)
        const rows = allRows.slice(0, 10)

        // Calculate totals
        const totalValue = allRows.reduce((sum, row) => {
          const value = typeof row.value === 'number' ? row.value : parseFloat(row.value.toString() || '0')
          return sum + value
        }, 0)
        
        const totalManhours = allRows.reduce((sum, row) => {
          const manhours = typeof row.manhours === 'number' ? row.manhours : parseFloat(row.manhours.toString() || '0')
          return sum + manhours
        }, 0)

        // Validate preview
        const errors: string[] = []
        const requiredHeaders = ['discipline', 'cost_type', 'value']
        const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s_-]+/g, '_'))
        
        for (const required of requiredHeaders) {
          if (!normalizedHeaders.some(h => h.includes(required.replace('_', '')))) {
            errors.push(`Missing required column: ${required}`)
          }
        }

        setPreview({
          headers,
          rows,
          isValid: errors.length === 0,
          errors,
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
            <p>Only controllers can import budget breakdowns</p>
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