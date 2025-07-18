'use client'

import { Clock, TrendingDown, DollarSign, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActionItem {
  type: 'stale_labor' | 'stale_po' | 'missing_labor' | 'missing_po' | 'budget_overrun' | 'low_margin'
  severity: 'critical' | 'warning'
  message: string
  actionLabel: string
  onAction: () => void
}

interface ActionRequiredBannerProps {
  actions: ActionItem[]
  className?: string
}

export function ActionRequiredBanner({ actions, className }: ActionRequiredBannerProps) {
  if (actions.length === 0) return null

  // Sort actions by severity (critical first)
  const sortedActions = [...actions].sort((a, b) => {
    if (a.severity === 'critical' && b.severity === 'warning') return -1
    if (a.severity === 'warning' && b.severity === 'critical') return 1
    return 0
  })

  // Take the most critical action to display prominently
  const primaryAction = sortedActions[0]
  const additionalCount = actions.length - 1

  const getIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'stale_labor':
      case 'stale_po':
        return Clock
      case 'missing_labor':
      case 'missing_po':
        return Upload
      case 'budget_overrun':
        return DollarSign
      case 'low_margin':
        return TrendingDown
    }
  }

  const Icon = getIcon(primaryAction.type)

  return (
    <div
      className={cn(
        'w-full p-4 flex items-center justify-between gap-4',
        primaryAction.severity === 'critical' 
          ? 'bg-red-50 border-y border-red-200' 
          : 'bg-yellow-50 border-y border-yellow-200',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Icon 
          className={cn(
            'h-5 w-5',
            primaryAction.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
          )} 
        />
        <div>
          <div className="flex items-center gap-2">
            <span 
              className={cn(
                'font-medium',
                primaryAction.severity === 'critical' ? 'text-red-900' : 'text-yellow-900'
              )}
            >
              {primaryAction.message}
            </span>
            {additionalCount > 0 && (
              <span className="text-sm text-gray-600">
                (+{additionalCount} more {additionalCount === 1 ? 'issue' : 'issues'})
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={primaryAction.severity === 'critical' ? 'destructive' : 'default'}
          onClick={primaryAction.onAction}
        >
          {primaryAction.actionLabel}
        </Button>
        {additionalCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Scroll to alerts tab or open a dialog with all actions
              const alertsTab = document.querySelector('[value="alerts"]')
              if (alertsTab) {
                (alertsTab as HTMLElement).click()
              }
            }}
          >
            View All
          </Button>
        )}
      </div>
    </div>
  )
}