import { Badge } from '@/components/ui/badge'
import { Check, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChangeOrderStatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | string
  className?: string
}

export function ChangeOrderStatusBadge({ status, className }: ChangeOrderStatusBadgeProps) {
  const config = {
    pending: {
      label: 'Submitted',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
    },
    approved: {
      label: 'Approved',
      icon: Check,
      className: 'bg-green-100 text-green-800 hover:bg-green-100'
    },
    rejected: {
      label: 'Denied',
      icon: X,
      className: 'bg-red-100 text-red-800 hover:bg-red-100'
    }
  }

  const { label, icon: Icon, className: statusClassName } = config[status as keyof typeof config] || config.pending

  return (
    <Badge className={cn(statusClassName, 'gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}