import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type RiskStatus = 'normal' | 'at-risk' | 'over-budget'

interface RiskStatusBadgeProps {
  status: RiskStatus
  showIcon?: boolean
  className?: string
}

export function RiskStatusBadge({ status, showIcon = true, className }: RiskStatusBadgeProps) {
  const getStatusConfig = (status: RiskStatus) => {
    switch (status) {
      case 'normal':
        return {
          label: 'Normal',
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 hover:bg-green-200'
        }
      case 'at-risk':
        return {
          label: 'At Risk',
          icon: AlertTriangle,
          className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
        }
      case 'over-budget':
        return {
          label: 'Over Budget',
          icon: AlertCircle,
          className: 'bg-red-100 text-red-800 hover:bg-red-200'
        }
      default:
        return {
          label: 'Unknown',
          icon: AlertCircle,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <Badge 
      variant="outline" 
      className={cn('gap-1 border-0', config.className, className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}