'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  AlertCircle, 
  CheckCircle,
  Download,
  ArrowLeft,
  Info,
  FileSpreadsheet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUser } from '@/hooks/use-auth'
import * as XLSX from 'xlsx'

interface ImportResult {
  success: boolean
  project_id: string
  total_budget: number
  breakdown_rows_created: number
  budget_created: boolean
  budget_updated: boolean
  errors: Array<{
    row: number
    message: string
    data?: unknown
  }>
}

interface PreviewData {
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

export default function ProjectBudgetImportPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Check permissions - all authenticated users can import
  const canImport = !!user

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-budget-import'],
    queryFn: async () => {
      const response = await fetch('/api/projects?limit=100&status=active')
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    }
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/project-budgets/import', {
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
        project_id: selectedProject,
        total_budget: 0,
        breakdown_rows_created: 0,
        budget_created: false,
        budget_updated: false,
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
    setPreview(null)
    setImportResult(null)
    setIsProcessing(true)

    try {
      // Read and parse file for preview
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Check if BUDGETS sheet exists
      if (!workbook.SheetNames.includes('BUDGETS')) {
        setPreview({
          disciplines: [],
          totalBudget: 0,
          isValid: false,
          errors: ['No BUDGETS sheet found in Excel file. Please ensure your file contains a sheet named "BUDGETS".']
        })
        setIsProcessing(false)
        return
      }
      
      const worksheet = workbook.Sheets['BUDGETS']
      
      // Get range to handle merged cells
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

      // Process for preview
      const disciplines = new Map<string, Array<{
        cost_type: string
        manhours: number | null
        value: number
      }>>()
      
      let currentDiscipline = ''
      let totalBudget = 0
      
      // Skip header row
      for (let i = 1; i < Math.min(rows.length, 50); i++) { // Preview first 50 rows
        const row = rows[i]
        const disciplineName = row[1]
        const description = row[3]?.toString() || ''
        const manhours = row[4]
        const value = row[5]
        
        if (!description || !value) continue
        
        // Update discipline if found
        if (disciplineName && typeof disciplineName === 'string' && disciplineName.trim()) {
          currentDiscipline = disciplineName.trim().toUpperCase()
        }
        
        if (!currentDiscipline) continue
        
        // Skip totals
        if (description.toUpperCase().includes('TOTAL') || 
            description.toUpperCase() === 'ALL LABOR') continue
        
        const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[$,]/g, '') || '0')
        const numericManhours = manhours ? (typeof manhours === 'number' ? manhours : parseFloat(manhours.toString() || '0')) : null
        
        if (!disciplines.has(currentDiscipline)) {
          disciplines.set(currentDiscipline, [])
        }
        
        disciplines.get(currentDiscipline)!.push({
          cost_type: description.trim(),
          manhours: numericManhours,
          value: numericValue
        })
        
        totalBudget += numericValue
      }

      const disciplineArray = Array.from(disciplines.entries()).map(([name, items]) => ({
        name,
        items,
        total: items.reduce((sum, item) => sum + item.value, 0)
      }))

      setPreview({
        disciplines: disciplineArray,
        totalBudget,
        isValid: disciplineArray.length > 0,
        errors: disciplineArray.length === 0 ? ['No valid budget data found in file'] : []
      })
    } catch {
      setPreview({
        disciplines: [],
        totalBudget: 0,
        isValid: false,
        errors: ['Failed to parse file. Please ensure it is a valid Excel file with the expected format.']
      })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleImport = async () => {
    if (!file || !preview?.isValid || !selectedProject) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', selectedProject)

    importMutation.mutate(formData)
  }

  const downloadTemplate = () => {
    // Create a sample template that matches the expected format
    const template = [
      ['DISCIPLINE NUMBER', 'DISCIPLINE', 'COST CODE', 'DESCRIPTION', 'MANHOURS', 'VALUE', '% OF DISCIPLINE', 'COST PER DIRECT MANHOUR', 'COST PER INDIRECT MANHOUR', 'COST PER TOTAL MANHOUR'],
      ['1', 'FABRICATION', '', 'DIRECT LABOR', 1440, 60234.50, '26.79%', 41.83, 836.59, 39.84],
      ['', '', '', 'INDIRECT LABOR', 72, 3710.00, '1.65%', 2.58, 51.53, 2.45],
      ['', '', '', 'MATERIALS', '', 83727.90, '0.00%', 58.14, 1162.89, 55.38],
      ['', '', '', 'EQUIPMENT', '', 32435.17, '14.42%', 22.52, 450.49, 21.45],
      ['', '', '', 'SUBCONTRACTS', '', 25834.00, '11.49%', 17.94, 358.81, 17.09],
      ['', '', '', 'DISCIPLINE TOTALS', 1512, 224874.20, '62.77%', '156.16', '3123.25', '148.73'],
      ['2', 'PIPING', '', 'DIRECT LABOR', 3400, 128692.50, '30.91%', 37.85, 189.25, 31.54],
      ['', '', '', 'INDIRECT LABOR', 680, 35625.00, '8.56%', 10.48, 52.39, 8.73],
      ['', '', '', 'MATERIALS', '', 44195.48, '10.61%', 13.00, 64.99, 10.83],
      ['', '', '', 'EQUIPMENT', '', 56975.43, '13.68%', 16.76, 83.79, 13.96],
      ['', '', '', 'SUBCONTRACTS', '', 49960.00, '12.00%', 14.69, 73.47, 12.25],
      ['', '', '', 'DISCIPLINE TOTALS', 4080, 416386.89, '100.00%', '122.47', '612.35', '102.06']
    ]

    const ws = XLSX.utils.aoa_to_sheet(template)
    
    // Set column widths
    ws['!cols'] = [
      { wch: 18 }, // DISCIPLINE NUMBER
      { wch: 15 }, // DISCIPLINE
      { wch: 10 }, // COST CODE
      { wch: 25 }, // DESCRIPTION
      { wch: 12 }, // MANHOURS
      { wch: 15 }, // VALUE
      { wch: 15 }, // % OF DISCIPLINE
      { wch: 25 }, // COST PER DIRECT MANHOUR
      { wch: 25 }, // COST PER INDIRECT MANHOUR
      { wch: 25 }  // COST PER TOTAL MANHOUR
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Budget Template')
    XLSX.writeFile(wb, 'project_budget_template.xlsx')
  }

  const downloadErrors = () => {
    if (!importResult?.errors || importResult.errors.length === 0) return

    const errorData = importResult.errors.map(error => ({
      Row: error.row,
      Error: error.message,
      Data: JSON.stringify(error.data || {})
    }))

    const ws = XLSX.utils.json_to_sheet(errorData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors')
    XLSX.writeFile(wb, 'budget_import_errors.xlsx')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  if (!canImport) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Permission Denied</h2>
          <p className="text-foreground">You must be logged in to import project budgets.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/projects')}
          >
            Back to Projects
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/projects')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import Project Budget</h1>
          <p className="text-foreground mt-1">Upload an Excel file with budget breakdown by discipline</p>
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-6 mb-6">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-2">Import Instructions:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>File must be in the ICS budget Excel format with disciplines and cost types</li>
              <li>Disciplines should be in merged cells (e.g., FABRICATION, PIPING, STEEL)</li>
              <li>Cost types include: DIRECT LABOR, INDIRECT LABOR, MATERIALS, EQUIPMENT, SUBCONTRACTS, etc.</li>
              <li>Rows with &quot;TOTAL&quot; in the description will be automatically skipped</li>
              <li>Values will be aggregated into the appropriate budget categories</li>
              <li>Existing budgets will be replaced with the imported data</li>
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
        <label className="block text-sm font-medium text-foreground/80 mb-2">
          Select Project <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full px-3 py-2 border border-foreground/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="">Choose a project...</option>
          {projectsData?.projects?.map((project: { id: string; job_number: string; name: string }) => (
            <option key={project.id} value={project.id}>
              {project.job_number} - {project.name}
            </option>
          ))}
        </select>
        {!selectedProject && preview?.isValid && (
          <p className="text-sm text-red-500 mt-1">Please select a project before importing</p>
        )}
      </Card>

      {/* File Upload */}
      <Card className="p-6 mb-6">
        <div className="border-2 border-dashed border-foreground/30 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={isProcessing}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <FileSpreadsheet className="h-12 w-12 text-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-foreground/80">Excel files (.xlsx, .xls) up to 10MB</p>
          </label>
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Budget Preview</h3>
          
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

          {preview.isValid && preview.disciplines.length > 0 && (
            <>
              <div className="mb-4">
                <p className="text-sm font-medium text-foreground/80">Total Budget:</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(preview.totalBudget)}</p>
              </div>
              
              <div className="space-y-4">
                {preview.disciplines.map((discipline, i) => (
                  <div key={i} className="border border-foreground/20 rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-2">{discipline.name}</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {discipline.items.slice(0, 5).map((item, j) => (
                        <div key={j} className="flex justify-between">
                          <span className="text-foreground/80">{item.cost_type}:</span>
                          <span className="font-medium">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                      {discipline.items.length > 5 && (
                        <div className="col-span-3 text-foreground/60 text-xs">
                          ... and {discipline.items.length - 5} more items
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-foreground/10">
                      <div className="flex justify-between font-semibold">
                        <span>Discipline Total:</span>
                        <span>{formatCurrency(discipline.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                Import {importResult.success ? 'Successful' : 'Failed'}
              </h3>
              <div className="space-y-1 text-sm">
                <p>Total Budget: {formatCurrency(importResult.total_budget)}</p>
                <p>Breakdown Rows Created: {importResult.breakdown_rows_created}</p>
                {importResult.budget_created && <p>✓ New budget created</p>}
                {importResult.budget_updated && <p>✓ Existing budget updated</p>}
                {importResult.errors.length > 0 && (
                  <p>Errors: {importResult.errors.length}</p>
                )}
              </div>
              
              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Error Details:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadErrors}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Errors
                    </Button>
                  </div>
                  <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, i) => (
                      <div key={i} className="text-xs mb-1">
                        Row {error.row}: {error.message}
                      </div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p className="text-xs mt-2 font-medium">
                        ... and {importResult.errors.length - 5} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {importResult.success && (
                <Button
                  className="mt-4"
                  onClick={() => router.push(`/projects/${importResult.project_id}`)}
                >
                  View Project
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/projects')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!file || !preview?.isValid || !selectedProject || importMutation.isPending}
          loading={importMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Import Budget
        </Button>
      </div>
    </div>
  )
}