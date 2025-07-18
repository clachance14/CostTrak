'use client'

import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import { BudgetCategoryPOModal } from './budget-category-po-modal'
import { cn } from '@/lib/utils'

interface BudgetVsActualTabProps {
  projectId: string
  contractValue?: number
}

interface BudgetCategory {
  category: string
  budget: number
  committed: number
  actuals: number
  forecastedFinal: number
  variance: number
  subcategories?: BudgetCategory[] | null
}

export function BudgetVsActualTab({ projectId, contractValue }: BudgetVsActualTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Fetch budget vs actual data
  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget-vs-actual', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/budget-vs-actual`)
      if (!response.ok) throw new Error('Failed to fetch budget data')
      return response.json()
    }
  })

  const handleCategoryClick = (category: string, hasSubcategories: boolean) => {
    // If category has subcategories, toggle expansion instead
    if (hasSubcategories) {
      toggleCategoryExpansion(category)
      return
    }
    
    // Don't open modal for LABOR, ADD ONS, or RISK
    if (category === 'LABOR' || category === 'ADD ONS' || category === 'RISK') {
      return
    }
    setSelectedCategory(category)
    setModalOpen(true)
  }

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const categories: BudgetCategory[] = budgetData?.categories || []

  const totals = categories.reduce((acc, cat) => ({
    budget: acc.budget + cat.budget,
    committed: acc.committed + cat.committed,
    actuals: acc.actuals + cat.actuals,
    forecastedFinal: acc.forecastedFinal + cat.forecastedFinal,
    variance: acc.variance + cat.variance
  }), { budget: 0, committed: 0, actuals: 0, forecastedFinal: 0, variance: 0 })

  return (
    <div className="space-y-6">
      {/* Contract Value Header */}
      {contractValue && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Contract Value</p>
            <p className="text-2xl font-bold">{formatCurrency(contractValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Forecasted Profit</p>
            <p className={cn(
              "text-2xl font-bold",
              contractValue - totals.forecastedFinal >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(contractValue - totals.forecastedFinal)}
            </p>
            <p className="text-sm text-muted-foreground">
              Margin: {((contractValue - totals.forecastedFinal) / contractValue * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Budget vs Actual Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Budget vs Actual by Category</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Budget Category</th>
                <th className="text-right py-3 px-4">Budget</th>
                <th className="text-right py-3 px-4">Committed</th>
                <th className="text-right py-3 px-4">Actuals</th>
                <th className="text-right py-3 px-4">Forecasted Final</th>
                <th className="text-right py-3 px-4">Variance</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const hasSubcategories = category.subcategories && category.subcategories.length > 0
                const isClickable = hasSubcategories || (
                  category.category !== 'LABOR' && 
                  category.category !== 'ADD ONS' && 
                  category.category !== 'RISK'
                )
                const isExpanded = expandedCategories.has(category.category)
                
                return (
                  <Fragment key={category.category}>
                    <tr 
                      key={category.category}
                      className={cn(
                        "border-b hover:bg-muted/50",
                        isClickable && "cursor-pointer"
                      )}
                      onClick={() => handleCategoryClick(category.category, hasSubcategories)}
                    >
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          {hasSubcategories && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCategoryExpansion(category.category)
                              }}
                              className="p-0.5 hover:bg-muted rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          {!hasSubcategories && <div className="w-5" />}
                          {category.category}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(category.budget)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(category.committed)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(category.actuals)}
                          {category.actuals > category.committed && category.category !== 'LABOR' && (
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(category.forecastedFinal)}
                      </td>
                      <td className={cn(
                        "text-right py-3 px-4 font-medium",
                        category.variance > 0 ? "text-green-600" : category.variance < 0 ? "text-red-600" : ""
                      )}>
                        {category.variance > 0 && '+'}
                        {formatCurrency(category.variance)}
                      </td>
                      <td className="py-3 px-4">
                        {isClickable && !hasSubcategories && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                    {/* Render subcategories when expanded */}
                    {isExpanded && category.subcategories?.map((subcat) => (
                      <tr 
                        key={`${category.category}-${subcat.category}`}
                        className="border-b bg-muted/20 hover:bg-muted/30"
                      >
                        <td className="py-3 px-4 pl-12 text-sm">
                          {subcat.category}
                        </td>
                        <td className="text-right py-3 px-4 text-sm">
                          {formatCurrency(subcat.budget)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm">
                          {formatCurrency(subcat.committed)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm">
                          {formatCurrency(subcat.actuals)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm">
                          {formatCurrency(subcat.forecastedFinal)}
                        </td>
                        <td className={cn(
                          "text-right py-3 px-4 text-sm font-medium",
                          subcat.variance > 0 ? "text-green-600" : subcat.variance < 0 ? "text-red-600" : ""
                        )}>
                          {subcat.variance > 0 && '+'}
                          {formatCurrency(subcat.variance)}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-3 px-4">Total</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.budget)}</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.committed)}</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.actuals)}</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.forecastedFinal)}</td>
                <td className={cn(
                  "text-right py-3 px-4",
                  totals.variance > 0 ? "text-green-600" : totals.variance < 0 ? "text-red-600" : ""
                )}>
                  {totals.variance > 0 && '+'}
                  {formatCurrency(totals.variance)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Category PO Modal */}
      {selectedCategory && (
        <BudgetCategoryPOModal
          projectId={projectId}
          category={selectedCategory}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </div>
  )
}