'use client'

import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

interface ProgressBreakdown {
  label: string
  value: number
  percentage: number
  color?: string
}

interface ClickableProgressBarProps {
  value: number
  label?: string
  breakdown?: ProgressBreakdown[]
  className?: string
  showPercentage?: boolean
  progressMethod?: 'labor_hours' | 'cost' | 'milestones'
}

export function ClickableProgressBar({
  value,
  label = 'Progress',
  breakdown,
  className,
  showPercentage = true,
  progressMethod = 'labor_hours'
}: ClickableProgressBarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getProgressMethodLabel = () => {
    switch (progressMethod) {
      case 'labor_hours':
        return 'Based on Labor Hours'
      case 'cost':
        return 'Based on Cost'
      case 'milestones':
        return 'Based on Milestones'
      default:
        return ''
    }
  }

  const progressBar = (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          {showPercentage && (
            <span className="text-sm font-semibold">{value.toFixed(1)}%</span>
          )}
          {breakdown && (
            <Info className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
      <Progress 
        value={value} 
        className={cn(
          'h-4',
          breakdown && 'cursor-pointer hover:opacity-90 transition-opacity'
        )}
      />
      {progressMethod && (
        <p className="text-xs text-gray-500 mt-1">{getProgressMethodLabel()}</p>
      )}
    </div>
  )

  if (!breakdown) {
    return progressBar
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {progressBar}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Progress Breakdown</h4>
          <div className="space-y-2">
            {breakdown.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      item.color || 'bg-blue-600'
                    )}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {item.value.toLocaleString()} hours
                </p>
              </div>
            ))}
          </div>
          {breakdown.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total Progress</span>
                <span className="font-semibold">{value.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}