'use client'

import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface KeyMetricsBarProps {
  originalContract: number
  revisedContract: number
  changeOrdersTotal: number
  totalSpent: number
  totalCommitted: number
  totalBudget: number
  remainingBudget: number
  projectHealth: {
    status: 'good' | 'warning' | 'critical'
    riskCount: number
  }
}

export function KeyMetricsBar({
  originalContract,
  revisedContract,
  changeOrdersTotal,
  totalSpent,
  totalCommitted,
  totalBudget,
  remainingBudget,
  projectHealth
}: KeyMetricsBarProps) {
  // Calculate the actual amount spent/committed
  // If remaining is negative, we've spent more than the budget
  const actualAmountUsed = totalBudget - remainingBudget
  const actualBudgetUsedPercentage = (actualAmountUsed / totalBudget) * 100
  const budgetUsedPercentage = Math.min(actualBudgetUsedPercentage, 100) // Cap display at 100%
  const isOverBudget = remainingBudget < 0
  
  const getHealthIcon = () => {
    switch (projectHealth.status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }
  
  const getHealthColor = () => {
    switch (projectHealth.status) {
      case 'good':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Contract Value */}
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Contract</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">
              {formatCurrency(originalContract)}
            </span>
            {revisedContract !== originalContract && (
              <>
                <span className="text-lg font-semibold text-gray-900">→</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(revisedContract)}
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {changeOrdersTotal > 0 ? 
              `(+${formatCurrency(changeOrdersTotal)} changes)` : 
              'No change orders'}
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="flex-1 lg:max-w-md">
          <div className="text-xs text-gray-600 mb-1">Budget Used</div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative h-6 w-full bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                    isOverBudget ? 'bg-red-600' :
                    actualBudgetUsedPercentage >= 90 ? 'bg-red-500' : 
                    actualBudgetUsedPercentage >= 70 ? 'bg-yellow-500' : 
                    'bg-blue-500'
                  } ${isOverBudget ? '' : 'rounded-full'}`}
                  style={{ width: `${budgetUsedPercentage}%` }}
                />
                {isOverBudget && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">OVER BUDGET</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`text-lg font-semibold min-w-[65px] text-right ${
              isOverBudget ? 'text-red-600' : 'text-gray-900'
            }`}>
              {actualBudgetUsedPercentage.toFixed(0)}%
            </div>
          </div>
          <div className={`text-xs mt-0.5 ${
            remainingBudget < 0 ? 'text-red-600 font-semibold' : 'text-gray-500'
          }`}>
            {remainingBudget < 0 ? 'Over Budget: ' : 'Remaining: '}
            {formatCurrency(Math.abs(remainingBudget))}
            {remainingBudget < 0 && ' over'}
          </div>
        </div>

        {/* Health Status */}
        <div className="flex-1 lg:flex-shrink-0">
          <div className="text-xs text-gray-600 mb-1">Health</div>
          <div className="flex items-center gap-2">
            {getHealthIcon()}
            <span className={`text-lg font-semibold capitalize ${getHealthColor()}`}>
              {projectHealth.status}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {projectHealth.riskCount} {projectHealth.riskCount === 1 ? 'risk' : 'risks'}
          </div>
        </div>
      </div>
    </div>
  )
}