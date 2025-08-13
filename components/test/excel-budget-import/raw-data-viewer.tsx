'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSpreadsheet, CircleAlert, CircleCheck, XCircle, Users, Package, Wrench, FileText, DollarSign } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'

interface RawDataViewerProps {
  analysisResult: any
}

export function RawDataViewer({ analysisResult }: RawDataViewerProps) {
  if (!analysisResult) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No data to display. Please upload a file first.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { 
    fileName, 
    fileSize, 
    sheetNames, 
    detectedHeaders, 
    rawData, 
    validation,
    budgetData 
  } = analysisResult

  return (
    <div className="space-y-6">
      {/* File Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            File Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">File Name</p>
              <p className="font-medium">{fileName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File Size</p>
              <p className="font-medium">{(fileSize / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sheets</p>
              <p className="font-medium">{sheetNames.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="font-medium">
                {Object.values(budgetData.details).reduce((sum: number, items: any[]) => sum + items.length, 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {(validation.errors.length > 0 || validation.warnings.length > 0 || validation.info?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              Analysis summary and issues found
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Errors ({validation.errors.length})
                </h4>
                <div className="space-y-1">
                  {validation.errors.map((error: string, idx: number) => (
                    <Alert key={idx} variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
            
            {validation.warnings.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 text-amber-600" />
                  Warnings ({validation.warnings.length})
                </h4>
                <div className="space-y-1">
                  {validation.warnings.map((warning: string, idx: number) => (
                    <Alert key={idx}>
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
            
            {validation.info?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-blue-600" />
                  Information ({validation.info.length})
                </h4>
                <div className="space-y-1">
                  {validation.info.map((info: string, idx: number) => (
                    <Alert key={idx} className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                      <AlertDescription>{info}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sheet Data */}
      <Card>
        <CardHeader>
          <CardTitle>Sheet Data</CardTitle>
          <CardDescription>
            Raw data extracted from each sheet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={sheetNames[0]} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              {sheetNames.map((sheetName: string) => (
                <TabsTrigger key={sheetName} value={sheetName} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {sheetName}
                  {sheetName === 'BUDGETS' && analysisResult.budgetsSheetDisciplines?.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {analysisResult.budgetsSheetDisciplines.length} disciplines
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {sheetNames.map((sheetName: string) => {
              const isBudgetsSheet = sheetName === 'BUDGETS'
              const disciplines = analysisResult.budgetsSheetDisciplines || []
              
              return (
                <TabsContent key={sheetName} value={sheetName} className="space-y-4">
                  {/* Sheet Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{sheetName}</h3>
                      {budgetData.details[sheetName] && (
                        <Badge variant="secondary">
                          {budgetData.details[sheetName].length} items
                        </Badge>
                      )}
                      {isBudgetsSheet && disciplines.length > 0 && (
                        <Badge variant="default">
                          12-row block structure
                        </Badge>
                      )}
                    </div>
                    {detectedHeaders[sheetName] && (
                      <div className="text-sm text-muted-foreground">
                        Header row: {detectedHeaders[sheetName].headerRow + 1}
                      </div>
                    )}
                  </div>

                  {/* Special BUDGETS sheet info */}
                  {isBudgetsSheet && (
                    <Alert>
                      <FileSpreadsheet className="h-4 w-4" />
                      <AlertDescription>
                        <strong>BUDGETS Sheet Structure:</strong> Each discipline occupies a 12-row block.
                        <ul className="mt-1 text-sm list-disc list-inside">
                          <li><strong>Column B:</strong> Discipline name (merged cell)</li>
                          <li><strong>Column D:</strong> Cost categories (Direct Labor, Indirect Labor, Perdiem, etc.)</li>
                          <li><strong>Column E:</strong> Manhours</li>
                          <li><strong>Column F:</strong> Dollar values</li>
                          <li><strong>Column G:</strong> Percentage of discipline total</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Detected Columns - skip for BUDGETS sheet */}
                  {detectedHeaders[sheetName] && !isBudgetsSheet && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Detected Columns</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(detectedHeaders[sheetName].columns).map(([field, info]: [string, any]) => (
                          <Badge key={field} variant="outline">
                            {field}: "{info.headerText}" (col {info.index + 1})
                            {info.confidence >= 0.8 && (
                              <CircleCheck className="h-3 w-3 ml-1 text-green-600" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Data Table */}
                  {rawData && rawData[sheetName] && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Data Preview (showing {Math.min(rawData[sheetName].rows.length, isBudgetsSheet ? 36 : 10)} of {rawData[sheetName].totalRows} rows)
                      </h4>
                      <ScrollArea className="h-[400px] w-full border rounded-md">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-background border-b">
                            <tr>
                              <th className="text-left p-2 text-xs font-medium text-muted-foreground">Row</th>
                              {isBudgetsSheet ? (
                                // Custom headers for BUDGETS sheet
                                <>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">A</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground bg-primary/10">B: Discipline</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">C</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground bg-primary/10">D: Category</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground bg-primary/10">E: Manhours</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground bg-primary/10">F: Value</th>
                                  <th className="text-left p-2 text-xs font-medium text-muted-foreground bg-primary/10">G: %</th>
                                  {rawData[sheetName].headers.slice(7).map((header: string, idx: number) => (
                                    <th key={idx + 7} className="text-left p-2 text-xs font-medium text-muted-foreground">
                                      {String.fromCharCode(72 + idx)}
                                    </th>
                                  ))}
                                </>
                              ) : (
                                // Regular headers for other sheets
                                rawData[sheetName].headers.map((header: string, idx: number) => (
                                  <th key={idx} className="text-left p-2 text-xs font-medium text-muted-foreground">
                                    {header || `Col ${idx + 1}`}
                                  </th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {rawData[sheetName].rows.slice(0, isBudgetsSheet ? 36 : 10).map((row: any[], rowIdx: number) => {
                              // For BUDGETS sheet, determine if this is a discipline row
                              const isDisciplineRow = isBudgetsSheet && row[1] && 
                                !['DIRECT LABOR', 'INDIRECT LABOR', 'ALL LABOR', 'TAXES & INSURANCE', 
                                  'PERDIEM', 'ADD ONS', 'SMALL TOOLS & CONSUMABLES', 'MATERIALS', 
                                  'EQUIPMENT', 'SUBCONTRACTS', 'RISK', 'DISCIPLINE TOTALS'].includes(String(row[1]).toUpperCase())
                              const isBlockBoundary = isBudgetsSheet && rowIdx > 0 && rowIdx % 12 === 0
                              
                              return (
                                <tr 
                                  key={rowIdx} 
                                  className={`
                                    border-b
                                    ${isDisciplineRow ? 'bg-primary/5 font-semibold' : ''}
                                    ${isBlockBoundary ? 'border-t-2 border-primary' : ''}
                                  `}
                                >
                                  <td className="p-2 text-xs text-muted-foreground">{rowIdx + 1}</td>
                                  {row.map((cell: any, cellIdx: number) => (
                                    <td 
                                      key={cellIdx} 
                                      className={`
                                        p-2 text-sm
                                        ${isBudgetsSheet && [1, 3, 4, 5, 6].includes(cellIdx) ? 'bg-primary/5' : ''}
                                      `}
                                    >
                                      {cell !== null && cell !== undefined ? String(cell) : '-'}
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Budget Summary with Three Views */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Summary</CardTitle>
          <CardDescription>
            Budget breakdown at different levels of detail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="high-level" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="high-level">High-Level Summary</TabsTrigger>
              <TabsTrigger value="by-discipline">By Discipline</TabsTrigger>
              <TabsTrigger value="by-cost-type">By Cost Type</TabsTrigger>
            </TabsList>
            
            {/* High-Level Summary Tab */}
            <TabsContent value="high-level" className="space-y-4 mt-4">
              {(() => {
                // Get disciplines data if available
                const disciplines = analysisResult?.budgetsSheetDisciplines || []
                let highLevelTotals = {
                  labor: 0,
                  materials: 0,
                  equipment: 0,
                  subcontracts: 0,
                  otherCosts: 0,
                  total: 0
                }
                
                if (disciplines.length > 0) {
                  // Calculate from disciplines data
                  disciplines.forEach((disc: any) => {
                    const categories = disc.categories || {}
                    // Labor includes Direct Labor, Indirect Labor, and Taxes & Insurance
                    highLevelTotals.labor += (categories['DIRECT LABOR']?.value || 0) + 
                                           (categories['INDIRECT LABOR']?.value || 0) + 
                                           (categories['TAXES & INSURANCE']?.value || 0)
                    highLevelTotals.materials += categories['MATERIALS']?.value || 0
                    highLevelTotals.equipment += categories['EQUIPMENT']?.value || 0
                    highLevelTotals.subcontracts += categories['SUBCONTRACTS']?.value || 0
                    // Other Costs includes Perdiem, Add Ons, Small Tools & Consumables, and Risk
                    highLevelTotals.otherCosts += (categories['PERDIEM']?.value || 0) +
                                                 (categories['ADD ONS']?.value || 0) +
                                                 (categories['SMALL TOOLS & CONSUMABLES']?.value || 0) +
                                                 (categories['RISK']?.value || 0)
                  })
                  highLevelTotals.total = highLevelTotals.labor + highLevelTotals.materials + 
                                        highLevelTotals.equipment + highLevelTotals.subcontracts + 
                                        highLevelTotals.otherCosts
                } else {
                  // Fallback to budgetData.totals
                  highLevelTotals = {
                    labor: budgetData.totals.labor || 0,
                    materials: budgetData.totals.material || 0,
                    equipment: budgetData.totals.equipment || 0,
                    subcontracts: budgetData.totals.subcontract || 0,
                    otherCosts: budgetData.totals.other || 0,
                    total: budgetData.totals.grand_total || 0
                  }
                }
                
                const categories = [
                  { name: 'Labor', value: highLevelTotals.labor, icon: Users },
                  { name: 'Materials', value: highLevelTotals.materials, icon: Package },
                  { name: 'Equipment', value: highLevelTotals.equipment, icon: Wrench },
                  { name: 'Subcontracts', value: highLevelTotals.subcontracts, icon: FileText },
                  { name: 'Other Costs', value: highLevelTotals.otherCosts, icon: DollarSign }
                ]
                
                return (
                  <>
                    <div className="space-y-4">
                      {categories.map(cat => {
                        const Icon = cat.icon
                        const percentage = highLevelTotals.total > 0 ? (cat.value / highLevelTotals.total) * 100 : 0
                        
                        return (
                          <div key={cat.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{cat.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">
                                  {formatCurrency(cat.value)}
                                </span>
                                <Badge variant="outline" className="ml-2">
                                  {percentage.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        )
                      })}
                    </div>
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total Budget</span>
                        <span className="text-lg font-semibold">
                          {formatCurrency(highLevelTotals.total)}
                        </span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </TabsContent>
            
            {/* By Discipline Tab */}
            <TabsContent value="by-discipline" className="mt-4">
              {(() => {
                const disciplines = analysisResult?.budgetsSheetDisciplines || []
                
                if (disciplines.length === 0) {
                  return (
                    <Alert>
                      <CircleAlert className="h-4 w-4" />
                      <AlertDescription>
                        No discipline data available. Upload a file with BUDGETS sheet to see discipline breakdown.
                      </AlertDescription>
                    </Alert>
                  )
                }
                
                // Calculate totals for each discipline
                const disciplineBreakdown = disciplines.map((disc: any) => {
                  const categories = disc.categories || {}
                  const labor = (categories['DIRECT LABOR']?.value || 0) + 
                              (categories['INDIRECT LABOR']?.value || 0) + 
                              (categories['TAXES & INSURANCE']?.value || 0)
                  const materials = categories['MATERIALS']?.value || 0
                  const equipment = categories['EQUIPMENT']?.value || 0
                  const subcontracts = categories['SUBCONTRACTS']?.value || 0
                  const otherCosts = (categories['PERDIEM']?.value || 0) +
                                   (categories['ADD ONS']?.value || 0) +
                                   (categories['SMALL TOOLS & CONSUMABLES']?.value || 0) +
                                   (categories['RISK']?.value || 0)
                  const total = labor + materials + equipment + subcontracts + otherCosts
                  
                  return {
                    name: disc.discipline,
                    labor,
                    materials,
                    equipment,
                    subcontracts,
                    otherCosts,
                    total
                  }
                })
                
                // Calculate grand totals
                const grandTotals = disciplineBreakdown.reduce((acc, disc) => ({
                  labor: acc.labor + disc.labor,
                  materials: acc.materials + disc.materials,
                  equipment: acc.equipment + disc.equipment,
                  subcontracts: acc.subcontracts + disc.subcontracts,
                  otherCosts: acc.otherCosts + disc.otherCosts,
                  total: acc.total + disc.total
                }), { labor: 0, materials: 0, equipment: 0, subcontracts: 0, otherCosts: 0, total: 0 })
                
                return (
                  <ScrollArea className="h-[400px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr>
                          <th className="text-left p-2 font-medium">Discipline</th>
                          <th className="text-right p-2 font-medium">Labor</th>
                          <th className="text-right p-2 font-medium">Materials</th>
                          <th className="text-right p-2 font-medium">Equipment</th>
                          <th className="text-right p-2 font-medium">Subcontracts</th>
                          <th className="text-right p-2 font-medium">Other Costs</th>
                          <th className="text-right p-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disciplineBreakdown.map((disc, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2 font-medium">{disc.name}</td>
                            <td className="p-2 text-right">{formatCurrency(disc.labor)}</td>
                            <td className="p-2 text-right">{formatCurrency(disc.materials)}</td>
                            <td className="p-2 text-right">{formatCurrency(disc.equipment)}</td>
                            <td className="p-2 text-right">{formatCurrency(disc.subcontracts)}</td>
                            <td className="p-2 text-right">{formatCurrency(disc.otherCosts)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(disc.total)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold">
                          <td className="p-2">Grand Total</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.labor)}</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.materials)}</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.equipment)}</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.subcontracts)}</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.otherCosts)}</td>
                          <td className="p-2 text-right">{formatCurrency(grandTotals.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </ScrollArea>
                )
              })()}
            </TabsContent>
            
            {/* By Cost Type Tab */}
            <TabsContent value="by-cost-type" className="mt-4">
              {(() => {
                const disciplines = analysisResult?.budgetsSheetDisciplines || []
                
                if (disciplines.length === 0) {
                  return (
                    <Alert>
                      <CircleAlert className="h-4 w-4" />
                      <AlertDescription>
                        No cost type data available. Upload a file with BUDGETS sheet to see cost type breakdown.
                      </AlertDescription>
                    </Alert>
                  )
                }
                
                // Aggregate cost types across all disciplines
                const costTypeMap: Record<string, number> = {}
                let grandTotal = 0
                
                disciplines.forEach((disc: any) => {
                  const categories = disc.categories || {}
                  Object.entries(categories).forEach(([category, data]: [string, any]) => {
                    if (!['ALL LABOR', 'DISCIPLINE TOTALS'].includes(category.toUpperCase()) && data.value > 0) {
                      costTypeMap[category] = (costTypeMap[category] || 0) + data.value
                      grandTotal += data.value
                    }
                  })
                })
                
                // Convert to array and sort by value
                const costTypes = Object.entries(costTypeMap)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value)
                
                return (
                  <div className="space-y-4">
                    {costTypes.map(ct => {
                      const percentage = grandTotal > 0 ? (ct.value / grandTotal) * 100 : 0
                      
                      return (
                        <div key={ct.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ct.name}</span>
                            <div className="text-right">
                              <span className="font-medium">
                                {formatCurrency(ct.value)}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                {percentage.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total</span>
                        <span className="text-lg font-semibold">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}