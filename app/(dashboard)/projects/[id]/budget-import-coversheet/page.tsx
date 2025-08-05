'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, FileSpreadsheet, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description?: string
  children: WBSNode[]
  budget_total: number
}

export default function BudgetImportCoversheetPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<BudgetImportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('summary')
  const [expandedWBS, setExpandedWBS] = useState<Set<string>>(new Set())

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setPreviewData(null)

    // Preview the file
    await handlePreview(selectedFile)
  }

  const handlePreview = async (fileToPreview: File = file!) => {
    if (!fileToPreview) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToPreview)
      formData.append('projectId', projectId)
      formData.append('mode', 'preview')

      const response = await fetch('/api/project-budgets/import-coversheet', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to preview file')
      }

      // Map the new data structure to the expected format
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
      
      setPreviewData(mappedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)
      formData.append('mode', 'import')

      const response = await fetch('/api/project-budgets/import-coversheet', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import budget')
      }

      // Redirect to project overview
      router.push(`/projects/${projectId}/overview?tab=budget`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import budget')
    } finally {
      setLoading(false)
    }
  }

  const toggleWBS = (code: string) => {
    const newExpanded = new Set(expandedWBS)
    if (newExpanded.has(code)) {
      newExpanded.delete(code)
    } else {
      newExpanded.add(code)
    }
    setExpandedWBS(newExpanded)
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Budget from Coversheet</h1>
        <p className="text-muted-foreground">
          Upload an Excel coversheet to import complete budget details with WBS codes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Select your budget coversheet Excel file. The system will automatically extract data from all budget sheets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Choose File
              </label>
              {file && (
                <span className="text-sm text-muted-foreground">{file.name}</span>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {previewData && previewData.validation.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Warnings:</div>
                    {previewData.validation.warnings.map((warning, idx) => (
                      <div key={idx} className="text-sm">• {warning}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
            <CardDescription>
              Review the extracted budget data before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedSheet} onValueChange={setSelectedSheet}>
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
                        ${previewData.totals.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Line Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Object.values(previewData.details).reduce((sum, items) => sum + items.length, 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">WBS Codes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {previewData.wbsStructure.length}
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
                        <span>${previewData.totals.labor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                        <span>Direct Labor</span>
                        <span>${previewData.totals.laborDirect.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                        <span>Indirect Labor</span>
                        <span>${previewData.totals.laborIndirect.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground border-b">
                        <span>Staff Labor</span>
                        <span>${previewData.totals.laborStaff.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    
                    {/* Non-labor categories */}
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Materials</span>
                      <span className="font-medium">
                        ${previewData.totals.material.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Equipment</span>
                      <span className="font-medium">
                        ${previewData.totals.equipment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Subcontracts</span>
                      <span className="font-medium">
                        ${previewData.totals.subcontract.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Small Tools & Consumables</span>
                      <span className="font-medium">
                        ${previewData.totals.smallTools.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Sheets Processed</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(previewData.details).map(sheetName => (
                      <Badge key={sheetName} variant="secondary">
                        {sheetName} ({previewData.details[sheetName].length} items)
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wbs" className="space-y-4">
                <div className="border rounded-lg">
                  {previewData.wbsStructure.map(node => renderWBSNode(node))}
                </div>
              </TabsContent>

              <TabsContent value="labor">
                <div className="space-y-4">
                  {['DIRECTS', 'INDIRECTS', 'STAFF'].map(sheet => (
                    previewData.details[sheet] && (
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
                              {previewData.details[sheet].slice(0, 10).map((item, idx) => (
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
                          {previewData.details[sheet].length > 10 && (
                            <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                              ... and {previewData.details[sheet].length - 10} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="materials">
                {previewData.details['MATERIALS'] ? (
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
                        {previewData.details['MATERIALS'].slice(0, 20).map((item, idx) => (
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
                {previewData.details['GENERAL EQUIPMENT'] ? (
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
                        {previewData.details['GENERAL EQUIPMENT'].slice(0, 20).map((item, idx) => (
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
                {previewData.details['SUBS'] ? (
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
                        {previewData.details['SUBS'].slice(0, 20).map((item, idx) => (
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

            <div className="flex justify-end gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/overview`)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || !previewData}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Budget
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}