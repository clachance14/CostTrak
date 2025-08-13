'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, CircleAlert, Download, LoaderCircle } from 'lucide-react'
import { FileDropZone } from '@/components/test/excel-budget-import-v2/file-drop-zone'
import { WBS5LevelViewer } from '@/components/test/excel-budget-import-v2/wbs-5level-viewer'
import { BudgetSummaryCards } from '@/components/test/excel-budget-import-v2/budget-summary-cards'
import { PhaseAllocationsTable } from '@/components/test/excel-budget-import-v2/phase-allocations-table'
import { DirectLaborTable } from '@/components/test/excel-budget-import-v2/direct-labor-table'
import { ValidationReport } from '@/components/test/excel-budget-import-v2/validation-report'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalysisResult {
  fileName: string
  fileSize: number
  data: {
    totals: {
      labor: number
      material: number
      equipment: number
      subcontract: number
      other: number
      grand_total: number
    }
    disciplineBudgets?: Array<{
      discipline: string
      disciplineNumber: number
      value: number
      categories: Record<string, any>
    }>
    wbsStructure5Level?: Array<any>
    phaseAllocations?: Array<any>
    directLaborAllocations?: Array<any>
    validationResult?: any
    details: Record<string, Array<any>>
  }
  stats: {
    sheetsProcessed: number
    totalItems: number
    wbsCodesFound: number
    totalBudget: number
    disciplinesIncluded: string[]
    phaseAllocations: number
    directLaborAllocations: number
    validationStatus: string
  }
}

export default function ExcelBudgetImportV2TestPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    setError(null)
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', 'preview')
      
      const response = await fetch('/api/test/excel-budget-analysis-v2', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze file')
      }
      
      if (result.success) {
        setAnalysisResult(result)
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }

  const handleExportJSON = () => {
    if (!analysisResult) return
    
    const dataStr = JSON.stringify(analysisResult.data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `budget-analysis-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setUploadedFile(null)
    setAnalysisResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              <h1 className="text-2xl font-bold">5-Level WBS Excel Import Test</h1>
            </div>
            {analysisResult && (
              <Button onClick={handleExportJSON} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Test the new 5-level WBS parser with your Excel coversheet files
          </p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border-b border-yellow-200 dark:border-yellow-900">
        <div className="container mx-auto px-4 py-3">
          <Alert className="border-0 bg-transparent p-0">
            <CircleAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-400">Test Environment</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-500">
              This tool uses the new 5-level WBS parser. No data will be saved to the database.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {!analysisResult ? (
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel Coversheet</CardTitle>
                <CardDescription>
                  Drag and drop your Excel file to see the 5-level WBS structure and budget breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileDropZone onFileUpload={handleFileUpload} loading={loading} />
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <CircleAlert className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* File Info Bar */}
              <div className="mb-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{analysisResult.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {(analysisResult.fileSize / 1024 / 1024).toFixed(2)} MB • 
                      {analysisResult.stats.sheetsProcessed} sheets processed
                    </p>
                  </div>
                </div>
                <Button onClick={handleReset} variant="outline" size="sm">
                  Upload New File
                </Button>
              </div>

              {/* Summary Cards */}
              <BudgetSummaryCards 
                totals={analysisResult.data.totals}
                stats={analysisResult.stats}
                validationResult={analysisResult.data.validationResult}
              />

              {/* Detailed Views */}
              <Card className="mt-6">
                <CardContent className="p-0">
                  <Tabs defaultValue="wbs" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
                      <TabsTrigger value="wbs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        5-Level WBS
                      </TabsTrigger>
                      <TabsTrigger value="disciplines" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Disciplines
                      </TabsTrigger>
                      <TabsTrigger value="phases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Phase Allocations
                      </TabsTrigger>
                      <TabsTrigger value="direct-labor" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Direct Labor
                      </TabsTrigger>
                      <TabsTrigger value="validation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Validation
                      </TabsTrigger>
                    </TabsList>

                    <div className="p-6">
                      <TabsContent value="wbs" className="mt-0">
                        <WBS5LevelViewer 
                          wbsStructure={analysisResult.data.wbsStructure5Level || []}
                        />
                      </TabsContent>

                      <TabsContent value="disciplines" className="mt-0">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">BUDGETS Sheet Disciplines</h3>
                          {analysisResult.data.disciplineBudgets?.map((disc, idx) => (
                            <Card key={idx}>
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-center">
                                  <CardTitle className="text-base">
                                    {disc.disciplineNumber}. {disc.discipline}
                                  </CardTitle>
                                  <span className="text-lg font-semibold">
                                    ${disc.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  {Object.entries(disc.categories).map(([cat, data]: [string, any]) => (
                                    <div key={cat} className="text-sm">
                                      <p className="text-muted-foreground">{cat}</p>
                                      <p className="font-medium">
                                        ${data.value?.toLocaleString('en-US') || '0'}
                                      </p>
                                      {data.percentage > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          {data.percentage.toFixed(1)}%
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="phases" className="mt-0">
                        <PhaseAllocationsTable 
                          allocations={analysisResult.data.phaseAllocations || []}
                        />
                      </TabsContent>

                      <TabsContent value="direct-labor" className="mt-0">
                        <DirectLaborTable 
                          allocations={analysisResult.data.directLaborAllocations || []}
                        />
                      </TabsContent>

                      <TabsContent value="validation" className="mt-0">
                        <ValidationReport 
                          validationResult={analysisResult.data.validationResult}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}