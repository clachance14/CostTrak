'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, CheckCircle, XCircle, DollarSign, Clock, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { EquipmentDrillDown } from './equipment-drill-down'

interface BudgetSheetDisciplineViewerProps {
  analysisResult: any
}

interface DisciplineData {
  discipline: string
  manhours: number
  value: number
  costPerHour?: number
  categories: Record<string, { manhours: number; value: number; percentage: number }>
}

const COST_TYPE_ORDER = [
  'DIRECT LABOR',
  'INDIRECT LABOR',
  'ALL LABOR',
  'TAXES & INSURANCE',
  'PERDIEM',
  'ADD ONS',
  'SMALL TOOLS & CONSUMABLES',
  'MATERIALS',
  'EQUIPMENT',
  'SUBCONTRACTS',
  'RISK',
  'DISCIPLINE TOTALS'
]

export function BudgetSheetDisciplineViewer({ analysisResult }: BudgetSheetDisciplineViewerProps) {
  if (!analysisResult) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No analysis data available. Please upload a file first.
          </p>
        </CardContent>
      </Card>
    )
  }

  const disciplines = analysisResult.budgetsSheetDisciplines || analysisResult.budgetData?.disciplineBudgets || []
  const rawData = analysisResult.budgetsSheetRawData || []

  if (disciplines.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No disciplines found in BUDGETS sheet. Please check if the BUDGETS sheet exists and follows the expected 12-row block format.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Calculate totals across all disciplines
  const totals = disciplines.reduce((acc: any, disc: DisciplineData) => {
    acc.totalValue += disc.value || 0
    acc.totalManhours += disc.manhours || 0
    
    // Sum by cost type
    Object.entries(disc.categories || {}).forEach(([category, data]) => {
      if (!acc.byCostType[category]) {
        acc.byCostType[category] = { value: 0, manhours: 0, count: 0 }
      }
      acc.byCostType[category].value += data.value || 0
      acc.byCostType[category].manhours += data.manhours || 0
      acc.byCostType[category].count += data.value > 0 ? 1 : 0
    })
    
    return acc
  }, { totalValue: 0, totalManhours: 0, byCostType: {} })

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Disciplines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disciplines.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Manhours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalManhours.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Cost/Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.totalManhours > 0 
                ? formatCurrency(totals.totalValue / totals.totalManhours)
                : '$0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="disciplines">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="disciplines">By Discipline</TabsTrigger>
          <TabsTrigger value="cost-types">By Cost Type</TabsTrigger>
          <TabsTrigger value="raw-blocks">Raw 12-Row Blocks</TabsTrigger>
        </TabsList>

        {/* Disciplines Tab */}
        <TabsContent value="disciplines">
          <Card>
            <CardHeader>
              <CardTitle>Disciplines from BUDGETS Sheet</CardTitle>
              <CardDescription>
                Each discipline is extracted from a 12-row block in the BUDGETS sheet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {disciplines.map((disc: DisciplineData, index: number) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{disc.discipline}</h3>
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{formatCurrency(disc.value)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium" title={`Direct: ${disc.directLaborHours?.toLocaleString() || 0} hrs, Indirect: ${disc.indirectLaborHours?.toLocaleString() || 0} hrs`}>
                                {disc.manhours.toLocaleString()} hrs
                              </span>
                            </div>
                            {disc.costPerHour && (
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{formatCurrency(disc.costPerHour)}/hr</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Cost Categories */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {COST_TYPE_ORDER.map(costType => {
                            const data = disc.categories[costType]
                            if (!data || data.value === 0) return null
                            
                            return (
                              <div key={costType} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{costType}</span>
                                  {costType === 'EQUIPMENT' && disc.equipmentDetails && disc.equipmentDetails.length > 0 && (
                                    <EquipmentDrillDown discipline={disc} />
                                  )}
                                </div>
                                <div className="flex gap-3 text-sm">
                                  <span>{formatCurrency(data.value)}</span>
                                  {data.manhours > 0 && (
                                    <span className="text-muted-foreground">({data.manhours.toLocaleString()} hrs)</span>
                                  )}
                                  {data.percentage > 0 && (
                                    <Badge variant="secondary">{data.percentage.toFixed(1)}%</Badge>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Types Tab */}
        <TabsContent value="cost-types">
          <Card>
            <CardHeader>
              <CardTitle>Cost Type Summary</CardTitle>
              <CardDescription>
                Total costs by type across all disciplines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {COST_TYPE_ORDER.map(costType => {
                    const data = totals.byCostType[costType]
                    if (!data || data.value === 0) return null
                    
                    const percentage = (data.value / totals.totalValue) * 100
                    
                    return (
                      <Card key={costType} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{costType}</h4>
                            <p className="text-sm text-muted-foreground">
                              Found in {data.count} discipline{data.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(data.value)}</div>
                            {data.manhours > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {data.manhours.toLocaleString()} hrs
                              </div>
                            )}
                            <Badge variant="outline" className="mt-1">
                              {percentage.toFixed(1)}% of total
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Blocks Tab */}
        <TabsContent value="raw-blocks">
          <Card>
            <CardHeader>
              <CardTitle>Raw BUDGETS Sheet Data</CardTitle>
              <CardDescription>
                Showing the raw 12-row blocks as they appear in the Excel file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {rawData.length > 0 ? (
                  <div className="space-y-4">
                    {disciplines.map((disc: DisciplineData, index: number) => {
                      // Find the rows for this discipline in raw data
                      const startRow = index * 12 + 5 // Assuming some header rows
                      const endRow = startRow + 12
                      
                      return (
                        <Card key={index} className="p-4">
                          <h4 className="font-semibold mb-2">{disc.discipline} (Rows {startRow + 1}-{endRow})</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2">Row</th>
                                  <th className="text-left p-2">Col B</th>
                                  <th className="text-left p-2">Col D (Description)</th>
                                  <th className="text-right p-2">Col E (Manhours)</th>
                                  <th className="text-right p-2">Col F (Value)</th>
                                  <th className="text-right p-2">Col G (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rawData.slice(startRow, endRow).map((row: any[], rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b">
                                    <td className="p-2">{startRow + rowIndex + 1}</td>
                                    <td className="p-2">{row[1] || ''}</td>
                                    <td className="p-2">{row[3] || ''}</td>
                                    <td className="p-2 text-right">{row[4] || ''}</td>
                                    <td className="p-2 text-right">{row[5] || ''}</td>
                                    <td className="p-2 text-right">{row[6] || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Raw data not available. Make sure includeRawData is enabled in the analysis options.
                    </AlertDescription>
                  </Alert>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}