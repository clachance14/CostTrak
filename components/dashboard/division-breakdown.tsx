'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface DivisionData {
  name: string
  projectCount: number
  totalValue: number
}

interface DivisionBreakdownProps {
  data: DivisionData[]
}

export function DivisionBreakdown({ data }: DivisionBreakdownProps) {
  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Division Breakdown</CardTitle>
        <CardDescription>Active projects by division</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((division) => {
            const percentage = totalValue > 0 ? (division.totalValue / totalValue) * 100 : 0
            
            return (
              <div key={division.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{division.name}</span>
                    <span className="text-sm text-gray-700">
                      ({division.projectCount} projects)
                    </span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(division.totalValue)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}