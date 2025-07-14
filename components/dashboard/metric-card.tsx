import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className
}: MetricCardProps) {
  return (
    <Card className={cn("shadow-sm border-foreground/20 hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-6 w-6 text-foreground/80" />}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-sm text-foreground/80">{description}</p>
        )}
        {trend && (
          <p className={cn(
            "text-sm mt-2 font-medium",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}%
          </p>
        )}
      </CardContent>
    </Card>
  )
}