'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSpinner } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as XLSX from 'xlsx'

interface ImportError {
  row: number
  employee_number: string
  error: string
}

interface ImportSummary {
  total: number
  imported: number
  updated?: number
  skipped: number
}

interface CraftTypeSummary {
  created: number
  errors: Array<{ craft: string; error: string }>
}

interface PreviewEmployee {
  employee_number: string
  first_name: string
  last_name: string
  craft_code: string
  base_rate: number
  is_direct: boolean
  category?: string
}

export default function EmployeeImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<PreviewEmployee[]>([])
  const [errors, setErrors] = useState<ImportError[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [craftTypeSummary, setCraftTypeSummary] = useState<CraftTypeSummary | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [importMode] = useState<'create-only' | 'update'>('update') // Always update mode

  const parseStringValue = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  const parseNumericValue = (value: unknown): number => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '')
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }


  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an Excel file (.xlsx or .xls)',
        variant: 'destructive'
      })
      return
    }

    setFile(selectedFile)
    setErrors([])
    setSummary(null)

    // Parse file for preview
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: true,
        defval: ''
      }) as unknown[][]

      const previewData: PreviewEmployee[] = []
      
      // Process first 10 data rows for preview
      for (let i = 1; i < Math.min(11, rawData.length); i++) {
        const row = rawData[i]
        if (!row || row.length === 0 || !row[0]) continue

        // Map columns based on your Excel format:
        // 0: First Name, 1: Last Name, 2: Middle Name, 3: employee_number
        // 4: Location Code, 5: Location Description, 6: Pay Grade Code
        // 7: Job Title Description, 8: Base_Rate, 9: Category
        const firstName = parseStringValue(row[0])
        const lastName = parseStringValue(row[1])
        // const middleName = parseStringValue(row[2]) // Not used in preview
        const employeeNumber = parseStringValue(row[3])
        const payGradeCode = parseStringValue(row[6]) // Pay Grade Code as craft
        const baseRate = parseNumericValue(row[8])
        const category = parseStringValue(row[9])

        // Add 'T' prefix if not present
        const formattedEmployeeNumber = employeeNumber.startsWith('T') 
          ? employeeNumber 
          : `T${employeeNumber}`

        // Map category to is_direct for backward compatibility
        const isDirect = category === 'Direct'

        if (employeeNumber && firstName && lastName) {
          previewData.push({
            employee_number: formattedEmployeeNumber,
            first_name: firstName,
            last_name: lastName,
            craft_code: payGradeCode || 'DIRECT',
            base_rate: baseRate,
            is_direct: isDirect,
            category: category || 'Direct'
          })
        }
      }

      setPreview(previewData)
    } catch (error) {
      console.error('Error parsing file:', error)
      toast({
        title: 'Error parsing file',
        description: 'Failed to read the Excel file. Please check the file format.',
        variant: 'destructive'
      })
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setErrors([])

    const formData = new FormData()
    formData.append('file', file)

    // Build URL with query parameters
    const params = new URLSearchParams()
    params.append('mode', importMode)

    try {
      const response = await fetch(`/api/employees/import?${params.toString()}`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setSummary(data.summary)
      setErrors(data.errors || [])
      setCraftTypeSummary(data.craftTypes || null)

      if (data.success) {
        const actions = []
        if (data.summary.imported > 0) actions.push(`${data.summary.imported} created`)
        if (data.summary.updated > 0) actions.push(`${data.summary.updated} updated`)
        
        toast({
          title: 'Import successful',
          description: `Employees: ${actions.join(', ')}`
        })
      } else {
        toast({
          title: 'Import completed with errors',
          description: `Processed ${data.summary.total} employees. ${data.summary.skipped} skipped due to errors.`,
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'An error occurred during import',
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setPreview([])
    setErrors([])
    setSummary(null)
    setCraftTypeSummary(null)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Employees</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Excel file to import employees into the system
        </p>
      </div>

      {!file && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Select an Excel file containing employee data. The file should have columns for:
              Employee Number, First Name, Last Name, Craft Code, Base Rate, and Direct/Indirect flag.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                dragActive ? 'border-primary bg-primary/10' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop your Excel file here, or click to browse
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload"
                className="inline-flex items-center justify-center rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 cursor-pointer transition-colors"
              >
                <Upload className="mr-2 h-4 w-4" />
                Select File
              </label>
            </div>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Employee numbers will automatically have &apos;T&apos; prefix added if not present.
                This import will update existing employees and create new ones.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {file && !summary && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Employee Data</CardTitle>
            <CardDescription>
              Review the first 10 employees from your file before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm">
                <strong>Selected file:</strong> {file.name}
              </p>
            </div>

            {/* Import Options */}
            <div className="mb-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Import Behavior:</strong> This import will update existing employees (base rates, categories, and blank fields) and create any new employees not in the system. Craft types will be automatically assigned based on employee categories and pay grades.
                </AlertDescription>
              </Alert>
            </div>

            {preview.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Number</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Pay Grade</TableHead>
                      <TableHead>Base Rate</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((emp, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{emp.employee_number}</TableCell>
                        <TableCell>{emp.first_name}</TableCell>
                        <TableCell>{emp.last_name}</TableCell>
                        <TableCell>{emp.craft_code}</TableCell>
                        <TableCell>${emp.base_rate.toFixed(2)}</TableCell>
                        <TableCell>{emp.category || (emp.is_direct ? 'Direct' : 'Indirect')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-6 flex gap-4">
                  <Button onClick={handleImport} disabled={importing}>
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Employees
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={resetImport} disabled={importing}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>

                {importing && (
                  <div className="mt-4 flex items-center justify-center">
                    <LoadingSpinner className="h-6 w-6" />
                  </div>
                )}
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No valid employee data found in the file. Please check the file format.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
            <CardDescription>
              Your employee import has been processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-2xl font-bold text-green-600">{summary.imported}</p>
                </div>
                {summary.updated !== undefined && summary.updated > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Updated</p>
                    <p className="text-2xl font-bold text-blue-600">{summary.updated}</p>
                  </div>
                )}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">Skipped</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.skipped}</p>
                </div>
              </div>

              {craftTypeSummary && craftTypeSummary.created > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">New Craft Types Created</h3>
                  <div className="p-3 bg-green-50 rounded-lg inline-block">
                    <p className="text-sm text-gray-600">Created from pay grades</p>
                    <p className="text-xl font-bold text-green-600">{craftTypeSummary.created}</p>
                  </div>
                  {craftTypeSummary.errors && craftTypeSummary.errors.length > 0 && (
                    <Alert className="mt-4" variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {craftTypeSummary.errors.length} craft type(s) failed to process
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {errors.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Import Errors</h3>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Employee Number</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>{error.row}</TableCell>
                            <TableCell className="font-mono">{error.employee_number}</TableCell>
                            <TableCell className="text-red-600">{error.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button onClick={() => router.push('/employees')}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  View Employees
                </Button>
                <Button variant="outline" onClick={resetImport}>
                  Import More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}