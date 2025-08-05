'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  XCircle,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationResultsProps {
  budgetData: any
  analysisResult: any
  onNext?: () => void
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  category: string
  message: string
  details?: string
  sheet?: string
  row?: number
}

function ValidationItem({ issue }: { issue: ValidationIssue }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const getIcon = () => {
    switch (issue.type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }
  
  const getBadgeVariant = () => {
    switch (issue.type) {
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      case 'info':
        return 'outline'
    }
  }
  
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={getBadgeVariant() as any} className="text-xs">
              {issue.category}
            </Badge>
            {issue.sheet && (
              <Badge variant="outline" className="text-xs">
                {issue.sheet}
              </Badge>
            )}
            {issue.row && (
              <Badge variant="outline" className="text-xs">
                Row {issue.row}
              </Badge>
            )}
          </div>
          <p className="text-sm">{issue.message}</p>
          {issue.details && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Show details
                  </>
                )}
              </Button>
              {isExpanded && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  {issue.details}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ValidationResults({ budgetData, analysisResult, onNext }: ValidationResultsProps) {
  // Collect all validation issues
  const issues: ValidationIssue[] = []
  
  // Add issues from budget data validation
  if (budgetData?.validation) {
    budgetData.validation.errors?.forEach((error: string) => {
      issues.push({
        type: 'error',
        category: 'Budget Processing',
        message: error
      })
    })
    
    budgetData.validation.warnings?.forEach((warning: string) => {
      issues.push({
        type: 'warning',
        category: 'Budget Processing',
        message: warning
      })
    })
    
    budgetData.validation.info?.forEach((info: string) => {
      issues.push({
        type: 'info',
        category: 'Budget Processing',
        message: info
      })
    })
  }
  
  // Add issues from analysis result validation
  if (analysisResult?.validation) {
    analysisResult.validation.errors?.forEach((error: string) => {
      issues.push({
        type: 'error',
        category: 'File Analysis',
        message: error
      })
    })
    
    analysisResult.validation.warnings?.forEach((warning: string) => {
      issues.push({
        type: 'warning',
        category: 'File Analysis',
        message: warning
      })
    })
    
    analysisResult.validation.info?.forEach((info: string) => {
      issues.push({
        type: 'info',
        category: 'File Analysis',
        message: info
      })
    })
  }
  
  // Add data quality checks
  if (budgetData) {
    // Check for missing WBS codes
    const totalItems = Object.values(budgetData.details || {}).flat().length
    const itemsWithWBS = Object.values(budgetData.details || {}).flat().filter((item: any) => item.wbs_code).length
    const missingWBS = totalItems - itemsWithWBS
    
    if (missingWBS > 0) {
      issues.push({
        type: 'warning',
        category: 'Data Quality',
        message: `${missingWBS} budget items are missing WBS codes`,
        details: 'Items without WBS codes will be imported but won\'t appear in the hierarchical structure. Consider adding WBS codes for better organization.'
      })
    }
    
    // Check for missing disciplines
    const itemsWithoutDiscipline = Object.values(budgetData.details || {})
      .flat()
      .filter((item: any) => !item.discipline)
      .length
    
    if (itemsWithoutDiscipline > 0) {
      issues.push({
        type: 'info',
        category: 'Data Quality',
        message: `${itemsWithoutDiscipline} items could not be automatically assigned to disciplines`,
        details: 'These items will be imported but may need manual discipline assignment later.'
      })
    }
    
    // Check for zero-value items
    const zeroValueItems = Object.values(budgetData.details || {})
      .flat()
      .filter((item: any) => item.total_cost === 0)
      .length
    
    if (zeroValueItems > 0) {
      issues.push({
        type: 'info',
        category: 'Data Quality',
        message: `${zeroValueItems} items have zero cost`,
        details: 'Zero-cost items are valid and will be imported. They may represent placeholder or informational entries.'
      })
    }
  }
  
  // Count issues by type
  const errorCount = issues.filter(i => i.type === 'error').length
  const warningCount = issues.filter(i => i.type === 'warning').length
  const infoCount = issues.filter(i => i.type === 'info').length
  
  const hasErrors = errorCount > 0
  const canProceed = !hasErrors
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={cn(errorCount > 0 && "border-destructive")}>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className={cn("h-5 w-5", errorCount > 0 ? "text-destructive" : "text-muted-foreground")} />
              <span className="text-2xl font-bold">{errorCount}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(warningCount > 0 && "border-warning/50")}>
          <CardHeader className="pb-2">
            <CardDescription>Warnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", warningCount > 0 ? "text-warning" : "text-muted-foreground")} />
              <span className="text-2xl font-bold">{warningCount}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Info className={cn("h-5 w-5", infoCount > 0 ? "text-blue-600" : "text-muted-foreground")} />
              <span className="text-2xl font-bold">{infoCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Overall Status */}
      <Card>
        <CardContent className="pt-6">
          {canProceed ? (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Validation Passed</AlertTitle>
              <AlertDescription>
                Your budget data has been validated and is ready for import. 
                {warningCount > 0 && ` Please review the ${warningCount} warning${warningCount === 1 ? '' : 's'} below before proceeding.`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation Failed</AlertTitle>
              <AlertDescription>
                There are {errorCount} error{errorCount === 1 ? '' : 's'} that must be resolved before importing. 
                Please review the issues below and fix your Excel file.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Issues List */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Issues</CardTitle>
            <CardDescription>
              Review all issues found during validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">
                  All ({issues.length})
                </TabsTrigger>
                <TabsTrigger value="errors" disabled={errorCount === 0}>
                  Errors ({errorCount})
                </TabsTrigger>
                <TabsTrigger value="warnings" disabled={warningCount === 0}>
                  Warnings ({warningCount})
                </TabsTrigger>
                <TabsTrigger value="info" disabled={infoCount === 0}>
                  Info ({infoCount})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {issues.map((issue, index) => (
                      <ValidationItem key={index} issue={issue} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="errors" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {issues
                      .filter(i => i.type === 'error')
                      .map((issue, index) => (
                        <ValidationItem key={index} issue={issue} />
                      ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="warnings" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {issues
                      .filter(i => i.type === 'warning')
                      .map((issue, index) => (
                        <ValidationItem key={index} issue={issue} />
                      ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="info" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {issues
                      .filter(i => i.type === 'info')
                      .map((issue, index) => (
                        <ValidationItem key={index} issue={issue} />
                      ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      
      {/* Navigation */}
      {onNext && (
        <div className="flex justify-end">
          <Button 
            onClick={onNext}
            disabled={!canProceed}
          >
            {canProceed ? 'Continue to Export' : 'Fix Errors to Continue'}
          </Button>
        </div>
      )}
    </div>
  )
}