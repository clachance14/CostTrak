'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileSpreadsheet, 
  Download, 
  Upload,
  TrendingUp,
  DollarSign,
  Wrench,
  Package,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { DisciplineSummary } from '@/types/budget-breakdown'

interface BudgetBreakdownTabProps {
  projectId: string
  originalContract?: number
}

export function BudgetBreakdownTab({ projectId }: BudgetBreakdownTabProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null)

  const canImport = user?.role === 'controller'

  // Fetch budget breakdown summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['budget-breakdown-summary', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/project-budget-breakdowns/summary/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch budget summary')
      return response.json()
    }
  })

  // Fetch detailed breakdowns
  const { data: breakdowns } = useQuery({
    queryKey: ['budget-breakdowns', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/project-budget-breakdowns/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch budget breakdowns')
      return response.json()
    }
  })

  const getCostTypeIcon = (costType: string) => {
    const type = costType.toUpperCase()
    if (type.includes('LABOR')) return <Clock className="h-4 w-4" />
    if (type === 'MATERIALS') return <Package className="h-4 w-4" />
    if (type === 'EQUIPMENT') return <Wrench className="h-4 w-4" />
    if (type === 'SUBCONTRACT') return <FileSpreadsheet className="h-4 w-4" />
    return <DollarSign className="h-4 w-4" />
  }

  const exportToExcel = async () => {
    // Implementation for exporting budget breakdown to Excel
    // This would use the XLSX library to create and download a file
    console.log('Export to Excel')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const hasBudget = summary?.disciplines && summary.disciplines.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Budget Breakdown</h3>
        <div className="flex gap-2">
          {hasBudget && (
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {canImport && (
            <Button 
              size="sm" 
              onClick={() => router.push(`/projects/${projectId}/budget-import`)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Budget
            </Button>
          )}
        </div>
      </div>

      {!hasBudget ? (
        <Card className="p-8 text-center">
          <FileSpreadsheet className="mx-auto h-12 w-12 text-foreground/40 mb-4" />
          <h4 className="text-lg font-medium mb-2">No Budget Breakdown</h4>
          <p className="text-foreground/60 mb-4">
            No budget breakdown has been imported for this project yet.
          </p>
          {canImport && (
            <Button onClick={() => router.push(`/projects/${projectId}/budget-import`)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Budget Breakdown
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Budget</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.summary.totals.budget)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-foreground/20" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Budget Variance</p>
                  <p className="text-2xl font-bold">
                    {summary.summary.budgetVariance !== null 
                      ? formatCurrency(Math.abs(summary.summary.budgetVariance))
                      : 'N/A'}
                  </p>
                  {summary.summary.budgetVariancePercent !== null && (
                    <p className={`text-sm ${summary.summary.budgetVariance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.summary.budgetVariance < 0 ? 'Under' : 'Over'} by {Math.abs(summary.summary.budgetVariancePercent).toFixed(1)}%
                    </p>
                  )}
                </div>
                <TrendingUp className="h-8 w-8 text-foreground/20" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Manhours</p>
                  <p className="text-2xl font-bold">
                    {summary.summary.totals.manhours.toLocaleString()}
                  </p>
                  <p className="text-sm text-foreground/60">
                    {summary.summary.disciplineCount} disciplines
                  </p>
                </div>
                <Clock className="h-8 w-8 text-foreground/20" />
              </div>
            </Card>
          </div>

          {/* Discipline Breakdown */}
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Breakdown by Discipline</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">Discipline</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Labor</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Materials</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Equipment</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Subcontract</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Other</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Total</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">%</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Manhours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.disciplines.map((discipline: DisciplineSummary) => (
                    <tr 
                      key={discipline.discipline}
                      className="hover:bg-background cursor-pointer"
                      onClick={() => setSelectedDiscipline(
                        selectedDiscipline === discipline.discipline ? null : discipline.discipline
                      )}
                    >
                      <td className="px-4 py-2 font-medium">{discipline.discipline}</td>
                      <td className="px-4 py-2 text-right">
                        {discipline.laborValue > 0 ? formatCurrency(discipline.laborValue) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.materialsValue > 0 ? formatCurrency(discipline.materialsValue) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.equipmentValue > 0 ? formatCurrency(discipline.equipmentValue) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.subcontractValue > 0 ? formatCurrency(discipline.subcontractValue) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.otherValue > 0 ? formatCurrency(discipline.otherValue) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(discipline.totalValue)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.percentageOfTotal.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        {discipline.totalManhours > 0 ? discipline.totalManhours.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.labor)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.materials)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.equipment)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.subcontract)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.other)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(summary.summary.totals.budget)}</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    <td className="px-4 py-2 text-right">{summary.summary.totals.manhours.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Discipline Detail */}
          {selectedDiscipline && breakdowns?.breakdowns && (
            <Card className="p-6">
              <h4 className="font-semibold mb-4">{selectedDiscipline} Detail</h4>
              <div className="space-y-2">
                {breakdowns.breakdowns
                  .filter((b: { discipline: string }) => b.discipline === selectedDiscipline)
                  .map((item: {
                    id: string
                    cost_type: string
                    description?: string
                    value: number
                    manhours: number
                  }) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-2">
                        {getCostTypeIcon(item.cost_type)}
                        <div>
                          <p className="font-medium">{item.cost_type}</p>
                          {item.description && (
                            <p className="text-sm text-foreground/60">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.value)}</p>
                        {item.manhours > 0 && (
                          <p className="text-sm text-foreground/60">{item.manhours.toLocaleString()} hrs</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}