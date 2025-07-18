'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { ChevronRight, FileSpreadsheet, DollarSign, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface BudgetBreakdownByDisciplineProps {
  projectId: string
}

interface CostType {
  cost_type: string
  value: number
  manhours: number | null
  description?: string
}

interface DisciplineBreakdown {
  discipline: string
  costTypes: CostType[]
  total: number
  totalManhours: number
}

export function BudgetBreakdownByDiscipline({ projectId }: BudgetBreakdownByDisciplineProps) {
  const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-breakdown-by-discipline', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/budget-breakdown-by-discipline`)
      if (!response.ok) throw new Error('Failed to fetch budget breakdown')
      return response.json()
    }
  })

  const toggleDiscipline = (discipline: string) => {
    setExpandedDisciplines(prev => ({
      ...prev,
      [discipline]: !prev[discipline]
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          Failed to load budget breakdown
        </div>
      </Card>
    )
  }

  const { disciplines, summary } = data || { disciplines: [], summary: {} }

  if (disciplines.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileSpreadsheet className="mx-auto h-12 w-12 text-foreground/40 mb-4" />
        <h4 className="text-lg font-medium mb-2">No Budget Breakdown</h4>
        <p className="text-foreground/60">
          No budget breakdown has been imported for this project yet.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Total Budget</p>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.grandTotal || 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Total Manhours</p>
              <p className="text-2xl font-bold">
                {(summary.grandTotalManhours || 0).toLocaleString()}
              </p>
            </div>
            <Clock className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Disciplines</p>
              <p className="text-2xl font-bold">
                {summary.disciplineCount || 0}
              </p>
            </div>
            <FileSpreadsheet className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/60">Cost Types</p>
              <p className="text-2xl font-bold">
                {summary.costTypeCount || 0}
              </p>
            </div>
            <FileSpreadsheet className="h-8 w-8 text-foreground/20" />
          </div>
        </Card>
      </div>

      {/* Discipline Breakdowns */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Budget Breakdown by Discipline</h3>
        
        <div className="space-y-2">
          {disciplines.map((discipline: DisciplineBreakdown) => (
            <div key={discipline.discipline} className="border rounded-lg">
              {/* Discipline Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleDiscipline(discipline.discipline)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        expandedDisciplines[discipline.discipline] && "rotate-90"
                      )}
                    />
                    <span className="font-medium">{discipline.discipline}</span>
                    <span className="text-sm text-muted-foreground">
                      ({discipline.costTypes.length} items)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {discipline.totalManhours > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {discipline.totalManhours.toLocaleString()} hrs
                      </span>
                    )}
                    <span className="font-semibold">
                      {formatCurrency(discipline.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cost Type Details */}
              {expandedDisciplines[discipline.discipline] && (
                <div className="border-t bg-muted/20">
                  <table className="w-full">
                    <thead>
                      <tr className="text-sm text-muted-foreground border-b">
                        <th className="text-left p-4">Cost Type</th>
                        <th className="text-right p-4">Manhours</th>
                        <th className="text-right p-4">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discipline.costTypes.map((costType: CostType, index: number) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{costType.cost_type}</p>
                              {costType.description && (
                                <p className="text-sm text-muted-foreground">
                                  {costType.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="text-right p-4 text-muted-foreground">
                            {costType.manhours ? costType.manhours.toLocaleString() : '-'}
                          </td>
                          <td className="text-right p-4 font-medium">
                            {formatCurrency(costType.value)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-4">Total</td>
                        <td className="text-right p-4">
                          {discipline.totalManhours > 0 ? discipline.totalManhours.toLocaleString() : '-'}
                        </td>
                        <td className="text-right p-4">
                          {formatCurrency(discipline.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Grand Total */}
        <div className="mt-4 pt-4 border-t-2 flex justify-between items-center">
          <span className="text-lg font-semibold">Grand Total</span>
          <div className="flex items-center gap-6">
            {summary.grandTotalManhours > 0 && (
              <span className="text-muted-foreground">
                {summary.grandTotalManhours.toLocaleString()} hrs
              </span>
            )}
            <span className="text-xl font-bold">
              {formatCurrency(summary.grandTotal || 0)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}