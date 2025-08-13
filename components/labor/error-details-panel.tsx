'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, User, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface EmployeeError {
  employee_number: string
  first_name: string
  last_name: string
  error_message: string
  row?: number
}

interface ErrorDetailsPanelProps {
  errors: EmployeeError[]
  onFixIndividual: (employee: EmployeeError) => void
  className?: string
}

export function ErrorDetailsPanel({
  errors,
  onFixIndividual,
  className
}: ErrorDetailsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Group errors by type for better organization
  const employeeErrors = errors.filter(e => 
    e.error_message?.includes('wage') || 
    e.error_message?.includes('rate') ||
    e.error_message?.includes('base_rate')
  )

  const getFriendlyErrorMessage = (error: string) => {
    if (error.includes('base_rate=0') || error.includes('wage')) {
      return 'Missing hourly wage rate'
    }
    if (error.includes('craft')) {
      return 'Missing craft type'
    }
    return 'Missing required information'
  }

  const getErrorTip = (error: string) => {
    if (error.includes('base_rate=0') || error.includes('wage')) {
      return "Enter the employee's standard hourly rate"
    }
    if (error.includes('craft')) {
      return 'Select the appropriate craft type for this employee'
    }
    return 'Update the missing information to continue'
  }

  if (errors.length === 0) return null

  return (
    <div className={cn('space-y-4', className)}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
          <span className="font-medium text-foreground">
            {isExpanded ? 'Hide' : 'Show'} Details ({errors.length} item{errors.length !== 1 ? 's' : ''} needing attention)
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Employee Error Cards */}
          {employeeErrors.map((error, index) => (
            <Card key={`${error.employee_number}-${index}`} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-foreground">
                      {error.last_name}, {error.first_name} ({error.employee_number})
                    </span>
                  </div>
                  
                  <div className="text-sm text-foreground/80">
                    <span className="font-medium">Issue:</span> {getFriendlyErrorMessage(error.error_message)}
                  </div>
                  
                  <div className="text-sm text-foreground/60">
                    <span className="font-medium">Tip:</span> {getErrorTip(error.error_message)}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFixIndividual(error)}
                  className="ml-4"
                >
                  Fix Individual →
                </Button>
              </div>
            </Card>
          ))}

          {/* Other errors if any */}
          {errors.length > employeeErrors.length && (
            <Card className="p-4 bg-gray-50">
              <div className="text-sm text-foreground/70">
                <span className="font-medium">
                  {errors.length - employeeErrors.length} other issue{errors.length - employeeErrors.length !== 1 ? 's' : ''}
                </span>
                {' detected. Please review the import data.'}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Help Section - Always visible */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Help</p>
            <p>Wage rates are used to calculate accurate labor costs.</p>
            <p className="text-blue-800 mt-1">Example: $32.50 per hour</p>
          </div>
        </div>
      </Card>
    </div>
  )
}