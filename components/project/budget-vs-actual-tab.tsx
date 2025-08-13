'use client'

import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ChevronRight, ChevronDown, BarChart3, FolderTree, DollarSign } from 'lucide-react'
import { BudgetCategoryPOModal } from './budget-category-po-modal'
import { BudgetPerDiemRow } from './budget-per-diem-row'
// DivisionFilter removed - divisions no longer used
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface BudgetVsActualTabProps {
  projectId: string
  contractValue?: number
}

interface BudgetCategory {
  category: string
  budget: number
  committed: number
  actuals: number
  leftToSpend?: number
  forecastedFinal: number
  variance: number
  subcategories?: BudgetCategory[] | null
  wbs_code?: string
  has_detail?: boolean
}

interface BudgetData {
  categories?: BudgetCategory[]
  hasDetailedBudget?: boolean
  wbsView?: BudgetCategory[]
  categoryView?: BudgetCategory[]
  totals?: {
    budget: number
    committed: number
    actuals: number
    forecastedFinal: number
    variance: number
  }
}

// Division interface removed - no longer used

export function BudgetVsActualTab({ projectId, contractValue }: BudgetVsActualTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  // Division filtering removed
  const [viewMode, setViewMode] = useState<'category' | 'wbs'>('category')

  // Division fetching removed - no longer used

  // Check if project has detailed budget data
  const { data: hasDetailedBudget } = useQuery({
    queryKey: ['has-detailed-budget', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/project-budgets/import-coversheet?projectId=${projectId}`)
      if (!response.ok) return false
      const data = await response.json()
      return data.hasExistingData || false
    }
  })

  // Fetch budget vs actual data
  const { data: budgetData, isLoading } = useQuery<BudgetData>({
    queryKey: ['budget-vs-actual', projectId, hasDetailedBudget, viewMode],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Use enhanced endpoint if detailed budget exists and WBS view is selected
      const endpoint = hasDetailedBudget && viewMode === 'wbs' 
        ? 'budget-vs-actual-enhanced' 
        : 'budget-vs-actual'
      
      if (hasDetailedBudget && viewMode === 'wbs') {
        params.append('use_wbs', 'true')
      }
      
      const url = `/api/projects/${projectId}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch budget data')
      return response.json()
    },
    enabled: hasDetailedBudget !== undefined
  })

  const handleCategoryClick = (category: string, hasSubcategories: boolean) => {
    // If category has subcategories, toggle expansion instead
    if (hasSubcategories) {
      toggleCategoryExpansion(category)
      return
    }
    
    // Don't open modal for LABOR or RISK
    if (category === 'LABOR' || category === 'RISK') {
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

  // Use appropriate data based on view mode
  const categories: BudgetCategory[] = 
    viewMode === 'wbs' && budgetData?.wbsView 
      ? budgetData.wbsView 
      : (budgetData?.categories || budgetData?.categoryView || [])

  const totals = budgetData?.totals || categories.reduce((acc, cat) => ({
    budget: acc.budget + cat.budget,
    actuals: acc.actuals + cat.actuals,
    leftToSpend: acc.leftToSpend + (cat.leftToSpend ?? (cat.forecastedFinal - cat.actuals)),
    forecastedFinal: acc.forecastedFinal + cat.forecastedFinal,
    variance: acc.variance + cat.variance
  }), { budget: 0, actuals: 0, leftToSpend: 0, forecastedFinal: 0, variance: 0 })

  // Use contract value directly
  const displayContractValue = contractValue

  return (
    <div className="space-y-6">
      {/* Contract Value Header */}
      {displayContractValue && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Contract Value
            </p>
            <p className="text-2xl font-bold">{formatCurrency(displayContractValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Forecasted Profit</p>
            <p className={cn(
              "text-2xl font-bold",
              displayContractValue - totals.forecastedFinal >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(displayContractValue - totals.forecastedFinal)}
            </p>
            <p className="text-sm text-muted-foreground">
              Margin: {displayContractValue > 0 ? ((displayContractValue - totals.forecastedFinal) / displayContractValue * 100).toFixed(1) : '0.0'}%
            </p>
          </div>
        </div>
      )}

      {/* Division Funnel removed - no longer used */}

      {/* Budget vs Actual Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Budget vs Actual by {viewMode === 'wbs' ? 'WBS' : 'Category'}
          </h3>
          {hasDetailedBudget && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'category' | 'wbs')}>
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="category">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Category
                </TabsTrigger>
                <TabsTrigger value="wbs">
                  <FolderTree className="h-4 w-4 mr-1" />
                  WBS
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">{viewMode === 'wbs' ? 'WBS Code' : 'Budget Category'}</th>
                <th className="text-right py-3 px-4">Budget</th>
                <th className="text-right py-3 px-4">Actuals</th>
                <th className="text-right py-3 px-4">Left to Spend</th>
                <th className="text-right py-3 px-4">Forecasted Final</th>
                <th className="text-right py-3 px-4">Variance</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const hasSubcategories = category.subcategories && category.subcategories.length > 0
                const isClickable = viewMode === 'category' && (hasSubcategories || (
                  category.category !== 'LABOR' && 
                  category.category !== 'RISK'
                ))
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
                        {formatCurrency(category.actuals)}
                      </td>
                      <td className={cn(
                        "text-right py-3 px-4",
                        (category.leftToSpend ?? (category.forecastedFinal - category.actuals)) < 0 ? "text-red-600" : ""
                      )}>
                        {formatCurrency(category.leftToSpend ?? (category.forecastedFinal - category.actuals))}
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
                          {formatCurrency(subcat.actuals)}
                        </td>
                        <td className={cn(
                          "text-right py-3 px-4 text-sm",
                          (subcat.leftToSpend ?? (subcat.forecastedFinal - subcat.actuals)) < 0 ? "text-red-600" : ""
                        )}>
                          {formatCurrency(subcat.leftToSpend ?? (subcat.forecastedFinal - subcat.actuals))}
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
              {/* Add Per Diem row if enabled */}
              <BudgetPerDiemRow projectId={projectId} />
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-3 px-4">Total</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.budget)}</td>
                <td className="text-right py-3 px-4">{formatCurrency(totals.actuals)}</td>
                <td className={cn(
                  "text-right py-3 px-4",
                  (totals.leftToSpend ?? (totals.forecastedFinal - totals.actuals)) < 0 ? "text-red-600" : ""
                )}>
                  {formatCurrency(totals.leftToSpend ?? (totals.forecastedFinal - totals.actuals))}
                </td>
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