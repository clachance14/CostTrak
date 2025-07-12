'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StatusDistributionProps {
  data: Record<string, number>
}

const STATUS_COLORS = {
  planning: 'bg-yellow-500',
  active: 'bg-green-500',
  on_hold: 'bg-orange-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-gray-500'
}

const STATUS_LABELS = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

export function StatusDistribution({ data }: StatusDistributionProps) {
  const total = Object.values(data).reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Status Distribution</CardTitle>
        <CardDescription>Projects by current status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(data).map(([status, count]) => {
            const percentage = total > 0 ? (count / total) * 100 : 0
            const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-500'
            const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status

            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm text-gray-700">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`${color} h-2 rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Total Projects</span>
            <span className="font-bold">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}