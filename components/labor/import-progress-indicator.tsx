'use client'

import { cn } from '@/lib/utils'
import { Check, AlertCircle } from 'lucide-react'

interface ImportProgressIndicatorProps {
  totalEmployees: number
  processedEmployees: number
  errors: number
  className?: string
}

export function ImportProgressIndicator({
  totalEmployees,
  processedEmployees,
  errors,
  className
}: ImportProgressIndicatorProps) {
  const successCount = processedEmployees - errors
  const progressPercentage = totalEmployees > 0 
    ? Math.round((successCount / totalEmployees) * 100)
    : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-foreground/70">Progress</span>
          <span className="font-medium">
            {successCount} of {totalEmployees} employees ready
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Status Items */}
      <div className="space-y-2">
        {successCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-foreground">
              Labor data processed ({successCount} employee{successCount !== 1 ? 's' : ''})
            </span>
          </div>
        )}
        
        {errors > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-foreground">
              {errors} employee{errors !== 1 ? 's need' : ' needs'} wage information to complete
            </span>
          </div>
        )}
      </div>
    </div>
  )
}