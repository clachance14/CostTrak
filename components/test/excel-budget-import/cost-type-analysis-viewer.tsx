'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CircleAlert, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Package, 
  Wrench,
  FileText,
  Building2,
  HardHat,
  Calculator
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface CostTypeAnalysisViewerProps {
  analysisResult: any
}

interface CostTypeData {
  costType: string
  totalValue: number
  totalManhours: number
  disciplineCount: number
  disciplines: {
    name: string
    value: number
    manhours: number
    percentage: number
  }[]
}

const COST_TYPE_ICONS: Record<string, any> = {
  'DIRECT LABOR': Users,
  'INDIRECT LABOR': HardHat,
  'TAXES & INSURANCE': Calculator,
  'PERDIEM': DollarSign,
  'MATERIALS': Package,
  'EQUIPMENT': Wrench,
  'SUBCONTRACTS': FileText,
  'SMALL TOOLS & CONSUMABLES': Wrench,
  'ADD ONS': TrendingUp,
  'RISK': CircleAlert,
  'OTHER': Building2
}

function processCostTypes(disciplines: any[]) {
  const costTypeMap: Record<string, CostTypeData> = {}
  let grandTotal = 0

  for (const disc of disciplines) {
    const categories = disc.categories || {}
    for (const [category, data] of Object.entries(categories) as [string, any][]) {
      if (['ALL LABOR', 'DISCIPLINE TOTALS'].includes(category.toUpperCase())) {
        continue
      }

      if (data.value > 0) {
        grandTotal += data.value

        if (!costTypeMap[category]) {
          costTypeMap[category] = {
            costType: category,
            totalValue: 0,
            totalManhours: 0,
            disciplineCount: 0,
            disciplines: []
          }
        }

        costTypeMap[category].totalValue += data.value
        costTypeMap[category].totalManhours += data.manhours || 0
        costTypeMap[category].disciplineCount += 1
        costTypeMap[category].disciplines.push({
          name: disc.discipline,
          value: data.value,
          manhours: data.manhours || 0,
          percentage: data.percentage || 0
        })
      }
    }
  }

  const costTypes = Object.values(costTypeMap).sort((a, b) => b.totalValue - a.totalValue)
  return { costTypeMap, costTypes, grandTotal }
}

export function CostTypeAnalysisViewer({ analysisResult }: CostTypeAnalysisViewerProps) {
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
  
  if (disciplines.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>
              No cost type data found. Please ensure the BUDGETS sheet is properly formatted.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const { costTypeMap, costTypes, grandTotal } = processCostTypes(disciplines)

  const laborTotal = (costTypeMap['DIRECT LABOR']?.totalValue || 0) + (costTypeMap['INDIRECT LABOR']?.totalValue || 0)
  const laborPercentage = ((laborTotal / grandTotal) * 100).toFixed(0)

  // Summary section
  const summaryCards = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cost Types Found</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{costTypes.length}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Labor vs Non-Labor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{laborPercentage}%</div>
          <p className="text-xs text-muted-foreground">Labor portion</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Highest Cost Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">{costTypes[0]?.costType || 'N/A'}</div>
          <p className="text-xs text-muted-foreground">
            {costTypes[0] ? formatCurrency(costTypes[0].totalValue) : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )

  // Overview content
  const overviewContent = (
    <Card>
      <CardHeader>
        <CardTitle>Cost Type Summary</CardTitle>
        <CardDescription>
          All cost types found across disciplines, sorted by total value
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {costTypes.map((ct) => {
            const Icon = COST_TYPE_ICONS[ct.costType] || Building2
            const percentage = (ct.totalValue / grandTotal) * 100
            
            return (
              <div key={ct.costType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{ct.costType}</p>
                      <p className="text-sm text-muted-foreground">
                        {ct.disciplineCount} discipline{ct.disciplineCount !== 1 ? 's' : ''}
                        {ct.totalManhours > 0 && ` • ${ct.totalManhours.toLocaleString()} hours`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(ct.totalValue)}</p>
                    <Badge variant="outline">{percentage.toFixed(1)}%</Badge>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  // Create breakdown items separately to avoid complex nested JSX
  const breakdownItems = costTypes.map(ct => {
    const Icon = COST_TYPE_ICONS[ct.costType]
    const disciplineItems = ct.disciplines
      .sort((a, b) => b.value - a.value)
      .map((disc, index) => (
        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="text-sm font-medium">{disc.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm">{formatCurrency(disc.value)}</span>
            {disc.manhours > 0 && (
              <span className="text-sm text-muted-foreground">
                ({disc.manhours.toLocaleString()} hrs)
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {((disc.value / ct.totalValue) * 100).toFixed(1)}%
            </Badge>
          </div>
        </div>
      ))

    return (
      <Card key={ct.costType} className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5" />}
              {ct.costType}
            </h3>
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(ct.totalValue)}</p>
              {ct.totalManhours > 0 && (
                <p className="text-sm text-muted-foreground">
                  {ct.totalManhours.toLocaleString()} total hours
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {disciplineItems}
          </div>
        </div>
      </Card>
    )
  })

  // Breakdown content
  const breakdownContent = (
    <Card>
      <CardHeader>
        <CardTitle>Cost Type by Discipline</CardTitle>
        <CardDescription>
          Detailed breakdown showing which disciplines contribute to each cost type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-6">
            {breakdownItems}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  // Charts content - simplified without recharts
  const chartsContent = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cost Distribution</CardTitle>
          <CardDescription>Percentage breakdown by cost type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {costTypes.map((ct) => {
              const percentage = (ct.totalValue / grandTotal) * 100
              return (
                <div key={ct.costType} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ct.costType}</span>
                    <span className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(ct.totalValue)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Type Values</CardTitle>
          <CardDescription>Sorted by total value</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {costTypes.map((ct) => {
                const percentage = (ct.totalValue / grandTotal) * 100
                const Icon = COST_TYPE_ICONS[ct.costType] || Building2
                
                return (
                  <Card key={ct.costType} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{ct.costType}</p>
                          <p className="text-xs text-muted-foreground">
                            {ct.disciplineCount} disciplines
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(ct.totalValue)}</p>
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )

  // Query examples content
  const queriesContent = (
    <Card>
      <CardHeader>
        <CardTitle>Query Examples</CardTitle>
        <CardDescription>
          Examples of how to query this data once imported to the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>
              These queries will work after importing the data to the production database
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">Total Perdiem Across All Disciplines</h4>
              <code className="text-sm bg-background p-2 rounded block mb-2">
                SELECT total_cost FROM project_cost_type_summary WHERE cost_type = 'PERDIEM'
              </code>
              <p className="text-sm">
                <strong>Result from this file:</strong> {formatCurrency(costTypeMap['PERDIEM']?.totalValue || 0)}
              </p>
            </Card>

            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">Total Materials Cost</h4>
              <code className="text-sm bg-background p-2 rounded block mb-2">
                SELECT total_cost FROM project_cost_type_summary WHERE cost_type = 'MATERIALS'
              </code>
              <p className="text-sm">
                <strong>Result from this file:</strong> {formatCurrency(costTypeMap['MATERIALS']?.totalValue || 0)}
              </p>
            </Card>

            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">Labor Breakdown</h4>
              <code className="text-sm bg-background p-2 rounded block mb-2">
                SELECT cost_type, total_cost FROM project_cost_type_summary 
                WHERE cost_type IN ('DIRECT LABOR', 'INDIRECT LABOR')
              </code>
              <div className="text-sm space-y-1">
                <p><strong>Direct Labor:</strong> {formatCurrency(costTypeMap['DIRECT LABOR']?.totalValue || 0)}</p>
                <p><strong>Indirect Labor:</strong> {formatCurrency(costTypeMap['INDIRECT LABOR']?.totalValue || 0)}</p>
              </div>
            </Card>

            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">All Cost Types Summary</h4>
              <code className="text-sm bg-background p-2 rounded block mb-2">
                GET /api/projects/[id]/budget-by-cost-type
              </code>
              <div className="text-sm space-y-1 mt-2">
                {costTypes.slice(0, 5).map(ct => (
                  <p key={ct.costType}>
                    <strong>{ct.costType}:</strong> {formatCurrency(ct.totalValue)} ({ct.disciplineCount} disciplines)
                  </p>
                ))}
                {costTypes.length > 5 && (
                  <p className="text-muted-foreground">... and {costTypes.length - 5} more cost types</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {summaryCards}
      
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Detailed Breakdown</TabsTrigger>
          <TabsTrigger value="charts">Visual Analysis</TabsTrigger>
          <TabsTrigger value="queries">Query Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {overviewContent}
        </TabsContent>

        <TabsContent value="breakdown">
          {breakdownContent}
        </TabsContent>

        <TabsContent value="charts">
          {chartsContent}
        </TabsContent>

        <TabsContent value="queries">
          {queriesContent}
        </TabsContent>
      </Tabs>
    </div>
  )
}