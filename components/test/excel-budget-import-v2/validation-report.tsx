'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, Info, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationResult {
  isValid: boolean
  summary: {
    totalErrors: number
    totalWarnings: number
    sheetsValidated: number
  }
  details: Record<string, SheetValidation>
  crossSheetValidation?: CrossSheetValidation[]
}

interface SheetValidation {
  sheetName: string
  isValid: boolean
  errors: string[]
  warnings: string[]
  budgetComparison?: {
    budgetValue: number
    sheetValue: number
    difference: number
    percentDifference: number
  }
}

interface CrossSheetValidation {
  rule: string
  isValid: boolean
  message: string
  details?: any
}

interface ValidationReportProps {
  validationResult?: ValidationResult
}

export function ValidationReport({ validationResult }: ValidationReportProps) {
  if (!validationResult) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No validation results available
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const getValidationIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  const getStatusBadge = (isValid: boolean) => {
    return (
      <Badge 
        variant={isValid ? "default" : "destructive"}
        className={cn(
          isValid 
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        )}
      >
        {isValid ? 'VALID' : 'INVALID'}
      </Badge>
    )
  }

  // Get sheets with issues
  const sheetsWithIssues = Object.values(validationResult.details).filter(
    detail => detail.errors.length > 0 || detail.warnings.length > 0
  )

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getValidationIcon(validationResult.isValid)}
              Validation Summary
            </CardTitle>
            {getStatusBadge(validationResult.isValid)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{validationResult.summary.sheetsValidated}</p>
                <p className="text-sm text-muted-foreground">Sheets Validated</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-950 rounded-md">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{validationResult.summary.totalErrors}</p>
                <p className="text-sm text-muted-foreground">Errors Found</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-md">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{validationResult.summary.totalWarnings}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet Details */}
      {sheetsWithIssues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Sheet Validation Details</h3>
          
          {sheetsWithIssues.map(detail => (
            <Card key={detail.sheetName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {detail.sheetName}
                    {detail.isValid ? (
                      <Badge variant="outline" className="text-xs">Valid</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Invalid</Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2 text-sm">
                    {detail.errors.length > 0 && (
                      <span className="text-red-600">{detail.errors.length} errors</span>
                    )}
                    {detail.warnings.length > 0 && (
                      <span className="text-amber-600">{detail.warnings.length} warnings</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget Comparison */}
                {detail.budgetComparison && (
                  <div className="bg-muted p-4 rounded-md space-y-2">
                    <p className="text-sm font-medium">Budget Comparison</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">BUDGETS Value</p>
                        <p className="font-medium">{formatCurrency(detail.budgetComparison.budgetValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sheet Value</p>
                        <p className="font-medium">{formatCurrency(detail.budgetComparison.sheetValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Difference</p>
                        <p className={cn(
                          "font-medium",
                          detail.budgetComparison.difference > 0.01 && "text-red-600"
                        )}>
                          {formatCurrency(detail.budgetComparison.difference)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">% Difference</p>
                        <p className={cn(
                          "font-medium",
                          detail.budgetComparison.percentDifference > 0.01 && "text-red-600"
                        )}>
                          {detail.budgetComparison.percentDifference.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {detail.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">Errors</p>
                    <div className="space-y-1">
                      {detail.errors.map((error, idx) => (
                        <Alert key={idx} variant="destructive" className="py-2">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">{error}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {detail.warnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-600">Warnings</p>
                    <div className="space-y-1">
                      {detail.warnings.map((warning, idx) => (
                        <Alert key={idx} className="py-2 border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-sm">{warning}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cross-Sheet Validation */}
      {validationResult.crossSheetValidation && validationResult.crossSheetValidation.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Cross-Sheet Validation</h3>
          
          <Card>
            <CardContent className="pt-6 space-y-3">
              {validationResult.crossSheetValidation.map((validation, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  {validation.isValid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{validation.rule}</p>
                    <p className="text-sm text-muted-foreground">{validation.message}</p>
                    {validation.details && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(validation.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Message */}
      {validationResult.isValid && (
        <Alert className="border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Validation Passed</AlertTitle>
          <AlertDescription>
            All sheets have been validated successfully against the BUDGETS sheet. 
            The Excel file is ready for import.
          </AlertDescription>
        </Alert>
      )}

      {/* Info about BUDGETS as source of truth */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Validation Principle</AlertTitle>
        <AlertDescription>
          <div className="space-y-2">
            <p>The BUDGETS sheet is the single source of truth for all costs and manhours.</p>
            <p className="text-sm">Expected relationships between sheets:</p>
            <ul className="text-sm list-disc list-inside ml-2 space-y-1">
              <li>STAFF typically represents ~15% of INDIRECT LABOR (subset of total indirect costs)</li>
              <li>CONSTRUCTABILITY details can be 20-40x higher than BUDGETS (full estimate vs budgeted subset)</li>
              <li>GENERAL EQUIPMENT contains shared equipment only (discipline-specific equipment in DISC EQUIPMENT sheets)</li>
              <li>ADD ONS from BUDGETS enhance indirect labor calculations</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}