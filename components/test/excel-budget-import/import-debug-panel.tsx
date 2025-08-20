'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CircleAlert, 
  CircleCheck, 
  XCircle, 
  Info, 
  FileSpreadsheet,
  Database,
  Clock,
  Zap
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ImportDebugPanelProps {
  analysisResult: any
}

interface LogEntry {
  step: string
  description: string
  timestamp: number
  data?: any
}

const LOG_TYPE_ICONS: Record<string, any> = {
  start: FileSpreadsheet,
  budgets_sheet_start: Database,
  budgets_sheet_disciplines: CircleCheck,
  cost_type_found: Zap,
  sheet_start: FileSpreadsheet,
  sheet_complete: CircleCheck,
  skip_sheet: Info,
  complete: CircleCheck,
  error: XCircle,
  warning: CircleAlert,
  custom_mappings: Database,
  apply_custom_mapping: Zap
}

const LOG_TYPE_COLORS: Record<string, string> = {
  start: 'default',
  budgets_sheet_start: 'secondary',
  budgets_sheet_disciplines: 'default',
  cost_type_found: 'outline',
  sheet_complete: 'default',
  error: 'destructive',
  warning: 'destructive',
  complete: 'default',
  skip_sheet: 'secondary'
}

export function ImportDebugPanel({ analysisResult }: ImportDebugPanelProps) {
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

  const transformationLog = analysisResult.transformationLog || []
  const validation = analysisResult.validation || { errors: [], warnings: [], info: [] }
  const budgetData = analysisResult.budgetData || {}
  const disciplines = analysisResult.budgetsSheetDisciplines || []

  // Calculate import statistics
  const stats = {
    totalSheets: analysisResult.sheetNames?.length || 0,
    processedSheets: Object.keys(analysisResult.rawData || {}).length,
    disciplinesFound: disciplines.length,
    costTypesFound: new Set(
      disciplines.flatMap((d: any) => 
        Object.entries(d.categories || {})
          .filter(([_, data]: [string, any]) => data.value > 0)
          .map(([category]) => category)
      )
    ).size,
    totalBudget: budgetData.totals?.grand_total || 0,
    errors: validation.errors.length,
    warnings: validation.warnings.length,
    processingTime: transformationLog.length > 1 
      ? transformationLog[transformationLog.length - 1].timestamp - transformationLog[0].timestamp 
      : 0
  }

  return (
    <div className="space-y-6">
      {/* Import Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sheets Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processedSheets}/{stats.totalSheets}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disciplines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disciplinesFound}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.costTypesFound}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processingTime}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Status */}
      {(stats.errors > 0 || stats.warnings > 0) && (
        <Card className={stats.errors > 0 ? 'border-destructive' : 'border-yellow-500'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {stats.errors > 0 ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CircleAlert className="h-5 w-5 text-yellow-500" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validation.errors.map((error: string, index: number) => (
              <Alert key={`error-${index}`} variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ))}
            {validation.warnings.map((warning: string, index: number) => (
              <Alert key={`warning-${index}`} className="border-yellow-500">
                <CircleAlert className="h-4 w-4 text-yellow-500" />
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}
            {validation.info.map((info: string, index: number) => (
              <Alert key={`info-${index}`} variant="default">
                <Info className="h-4 w-4" />
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Import Process Log */}
      <Card>
        <CardHeader>
          <CardTitle>Import Process Log</CardTitle>
          <CardDescription>
            Detailed log of the import process showing each step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {transformationLog.map((entry: LogEntry, index: number) => {
                const Icon = LOG_TYPE_ICONS[entry.step] || Info
                const color = LOG_TYPE_COLORS[entry.step] || 'default'
                
                return (
                  <Card key={index} className="p-3">
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{entry.description}</p>
                          <Badge variant={color as any} className="text-xs">
                            {entry.step}
                          </Badge>
                        </div>
                        
                        {entry.data && (
                          <div className="text-xs text-muted-foreground">
                            {entry.step === 'budgets_sheet_disciplines' && (
                              <div className="space-y-1">
                                <p>Found {entry.data.count} disciplines:</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {entry.data.disciplines.map((d: any, i: number) => (
                                    <div key={i} className="flex justify-between bg-muted/50 p-1 rounded">
                                      <span>{d.name}</span>
                                      <span>${(d.value / 1000000).toFixed(2)}M</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {entry.step === 'cost_type_found' && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{entry.data.discipline}:</span>
                                <span>{entry.data.costType}</span>
                                <span>→ ${(entry.data.value / 1000).toFixed(0)}k</span>
                                {entry.data.manhours > 0 && (
                                  <span>({entry.data.manhours.toLocaleString()} hrs)</span>
                                )}
                              </div>
                            )}
                            
                            {entry.step === 'sheet_complete' && (
                              <div className="flex items-center gap-2">
                                <span>Header row: {entry.data.headerRow}</span>
                                <span>•</span>
                                <span>Data rows: {entry.data.dataRows}</span>
                                <span>•</span>
                                <span>Mapped columns: {entry.data.mappedColumns}</span>
                              </div>
                            )}
                            
                            {!['budgets_sheet_disciplines', 'cost_type_found', 'sheet_complete'].includes(entry.step) && (
                              <pre className="mt-1 p-2 bg-muted/50 rounded overflow-x-auto">
                                {JSON.stringify(entry.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">BUDGETS Sheet Status:</p>
              <p className="text-muted-foreground">
                {disciplines.length > 0 
                  ? `✓ Found and processed (${disciplines.length} disciplines)`
                  : '✗ Not found or empty'}
              </p>
            </div>
            <div>
              <p className="font-medium">WBS Structure:</p>
              <p className="text-muted-foreground">
                {budgetData.wbsStructure?.length > 0
                  ? `✓ Generated (${budgetData.wbsStructure.length} nodes)`
                  : '✗ Not generated'}
              </p>
            </div>
            <div>
              <p className="font-medium">Line Items:</p>
              <p className="text-muted-foreground">
                {Object.values(budgetData.details || {}).flat().length} total items
              </p>
            </div>
            <div>
              <p className="font-medium">Sheet Mappings:</p>
              <p className="text-muted-foreground">
                {Object.keys(analysisResult.appliedMappings || {}).length} sheets mapped
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}