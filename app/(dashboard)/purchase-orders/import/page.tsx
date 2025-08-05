'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Upload, 
 
  AlertCircle, 
  CheckCircle,
  Download,
  ArrowLeft,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUser } from '@/hooks/use-auth'
import * as XLSX from 'xlsx'

interface ImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  lineItemsCreated: number
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: unknown
  }>
}

interface PreviewData {
  headers: string[]
  rows: unknown[]
  isValid: boolean
  errors: string[]
}

export default function PurchaseOrdersImportPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [, setIsProcessing] = useState(false)

  // Check permissions
  const canImport = user && user.role === 'project_manager'

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-import'],
    queryFn: async () => {
      const response = await fetch('/api/projects?limit=100')
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    }
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/purchase-orders/import', {
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
        lineItemsCreated: 0,
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
      const workbook = XLSX.read(arrayBuffer, { type: 'array', dateNF: 'yyyy-mm-dd' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

      if (data.length < 3) {
        setPreview({
          headers: [],
          rows: [],
          isValid: false,
          errors: ['Invalid ICS PO Log format. File must have header metadata and data rows.']
        })
        return
      }

      // Skip first 2 rows (metadata) and use row 3 as headers
      const headers = data[2] as string[]
      const rows = data.slice(3, 13) // Preview first 10 data rows

      // Validate ICS format headers
      const requiredHeaders = ['Job No.', 'PO Number', 'Vendor', 'Est. PO Value']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

      setPreview({
        headers,
        rows: rows.map(row => {
          const obj: Record<string, unknown> = {}
          headers.forEach((header, index) => {
            obj[header] = row[index]
          })
          return obj
        }),
        isValid: missingHeaders.length === 0,
        errors: missingHeaders.length > 0 
          ? [`Missing required columns: ${missingHeaders.join(', ')}`]
          : []
      })
    } catch {
      setPreview({
        headers: [],
        rows: [],
        isValid: false,
        errors: ['Failed to parse file. Please ensure it is a valid CSV or Excel file.']
      })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleImport = async () => {
    if (!file || !preview?.isValid) return

    const formData = new FormData()
    formData.append('file', file)
    if (selectedProject) {
      formData.append('project_id', selectedProject)
    }

    importMutation.mutate(formData)
  }

  const downloadTemplate = () => {
    const template = [
      ['*** TrackerPO PO General Search Export *** REPORT produced on: 2025-07-12 00:00:00 (GMT)'],
      ['*** Search Selection: Sample Data'],
      ['Job No.', 'PO Number', 'Generation Date', 'Requestor', 'Sub Cost Code', 'Def. Contr./Extra', 'Vendor', 'WO/PMO', 'Cost Center', 'Sub CC', 'SubSub CC', 'Est. PO Value', 'PO Status', ' PO Comments', 'Invoice/Ticket', 'Inv. Date', 'Contract/Extra', 'Line Item Value', 'FTO Sent Date', 'FTO Ret. Date', ' BB Date', 'Material Description', 'Comments'],
      ['5640', '5640.1001 (Active)', '2024-12-05', 'Fleming, Katelynn', '0000', 'Contract', 'Brock', '', '4000', '0000', '', '96913.53', 'Active', 'Sample PO Comments', '28044619', '2025-02-21', 'Contract', '96913.54', '0000-00-00', '2025-02-24', '0000-00-00', 'Sample Material', '']
    ]

    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ICS PO Log')
    XLSX.writeFile(wb, 'ics_po_log_template.csv')
  }

  const downloadErrors = () => {
    if (!importResult?.errors || importResult.errors.length === 0) return

    const errorData = importResult.errors.map(error => ({
      Row: error.row,
      Field: error.field || 'General',
      Error: error.message,
      Data: JSON.stringify(error.data || {})
    }))

    const ws = XLSX.utils.json_to_sheet(errorData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Import Errors')
    XLSX.writeFile(wb, 'purchase_orders_import_errors.xlsx')
  }

  if (!canImport) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Permission Denied</h2>
          <p className="text-foreground">You don&apos;t have permission to import purchase orders.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/purchase-orders')}
          >
            Back to Purchase Orders
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
          onClick={() => router.push('/purchase-orders')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import ICS Purchase Orders</h1>
          <p className="text-foreground mt-1">Upload an ICS PO Log CSV export to import purchase orders</p>
        </div>
      </div>

      {/* Instructions */}
      <Card className="p-6 mb-6">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-2">Import Instructions:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>File must be ICS PO Log CSV export format</li>
              <li>System will automatically skip header metadata rows</li>
              <li>Multiple invoice lines per PO will be aggregated appropriately</li>
              <li>Required columns: Job No., PO Number, Vendor, Est. PO Value</li>
              <li>All ICS fields will be imported including cost codes, requestor, and dates</li>
              <li>Existing POs will be updated based on matching PO Number + Job No.</li>
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Download ICS Format Template
            </Button>
          </div>
        </div>
      </Card>

      {/* Project Selection (optional) */}
      <Card className="p-6 mb-6">
        <label className="block text-sm font-medium text-foreground/80 mb-2">
          Project Override (Optional)
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full px-3 py-2 border border-foreground/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Use Job No. from ICS file</option>
          {projectsData?.projects?.map((project: { id: string; job_number: string; name: string }) => (
            <option key={project.id} value={project.id}>
              {project.job_number} - {project.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-foreground/80 mt-1">
          If selected, all POs will be imported to this project regardless of Job No. in the file
        </p>
      </Card>

      {/* File Upload */}
      <Card className="p-6 mb-6">
        <div className="border-2 border-dashed border-foreground/30 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 text-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-foreground/80">ICS PO Log CSV files up to 10MB</p>
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

          {preview.isValid && preview.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-background">
                  <tr>
                    {preview.headers.map((header, i) => (
                      <th key={i} className="px-4 py-2 text-left text-xs font-medium text-foreground/80 uppercase">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((header, j) => (
                        <td key={j} className="px-4 py-2 text-sm text-foreground whitespace-nowrap">
                          {(row as Record<string, any>)[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length < 10 && (
                <p className="text-sm text-foreground/80 mt-2">
                  Showing all {preview.rows.length} rows
                </p>
              )}
              {preview.rows.length === 10 && (
                <p className="text-sm text-foreground/80 mt-2">
                  Showing first 10 rows (file may contain more)
                </p>
              )}
            </div>
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
                Import {importResult.success ? 'Completed' : 'Failed'}
              </h3>
              <div className="space-y-1 text-sm">
                <p>Imported: {importResult.imported} new POs</p>
                <p>Updated: {importResult.updated} existing POs</p>
                <p>Line Items Created: {importResult.lineItemsCreated} invoice records</p>
                <p>Skipped: {importResult.skipped} records</p>
                {importResult.errors.length > 0 && (
                  <p>Errors: {importResult.errors.length} records</p>
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
            </div>
          </div>
        </Card>
      )}


      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/purchase-orders')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!file || !preview?.isValid || importMutation.isPending}
          loading={importMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Import Purchase Orders
        </Button>
      </div>
    </div>
  )
}