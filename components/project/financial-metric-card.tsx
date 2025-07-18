'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LucideIcon, TrendingUp, TrendingDown, ChevronRight, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FinancialDetail {
  label: string
  value: string | number
  subItems?: Array<{
    label: string
    value: string | number
    isPositive?: boolean
  }>
}

interface FinancialMetricCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
    label?: string
  }
  status?: 'good' | 'warning' | 'danger'
  details?: FinancialDetail[]
  helpText?: string
  className?: string
  onClick?: () => void
}

export function FinancialMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  status,
  details,
  helpText,
  className,
  onClick
}: FinancialMetricCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const hasDetails = details && details.length > 0
  const isClickable = hasDetails || onClick

  const getStatusColor = () => {
    switch (status) {
      case 'good':
        return 'border-green-200 bg-green-50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50'
      case 'danger':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-white'
    }
  }

  const getValueColor = () => {
    switch (status) {
      case 'good':
        return 'text-green-700'
      case 'warning':
        return 'text-yellow-700'
      case 'danger':
        return 'text-red-700'
      default:
        return 'text-gray-900'
    }
  }

  const cardContent = (
    <Card 
      className={cn(
        'transition-all',
        getStatusColor(),
        isClickable && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={() => {
        if (onClick) {
          onClick()
        } else if (hasDetails) {
          setShowDetails(true)
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              {helpText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={cn('text-2xl font-bold', getValueColor())}>
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                  {trend.label && ` ${trend.label}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-gray-400" />}
            {isClickable && <ChevronRight className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (!hasDetails) {
    return cardContent
  }

  return (
    <>
      {cardContent}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{title} Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {details.map((detail, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">{detail.label}</span>
                  <span className="font-semibold">{detail.value}</span>
                </div>
                {detail.subItems && (
                  <div className="ml-4 space-y-1">
                    {detail.subItems.map((subItem, subIndex) => (
                      <div key={subIndex} className="flex justify-between text-sm">
                        <span className="text-gray-600">{subItem.label}</span>
                        <span className={cn(
                          'font-medium',
                          subItem.isPositive === true && 'text-green-600',
                          subItem.isPositive === false && 'text-red-600'
                        )}>
                          {subItem.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}