import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ForecastCalculationService } from '@/lib/services/forecast-calculations'

interface CategoryResult {
  category: string
  budget: number
  committed: number
  actuals: number
  forecastedFinal: number
  variance: number
  subcategories?: CategoryResult[]
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const projectId = params.id
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get project budget data
    const { data: projectBudget, error: budgetError } = await supabase
      .from('project_budgets')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (budgetError && budgetError.code !== 'PGRST116') {
      throw budgetError
    }

    // Get all POs for the project first
    const { data: allPOs } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        cost_code:cost_codes(
          id,
          code,
          description,
          category,
          discipline
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'approved')

    // Define budget categories with their mappings
    const budgetCategories = [
      {
        category: 'LABOR',
        budget: projectBudget?.labor_budget || 0,
        costCodeCategories: ['labor'],
        costCenterCodes: [], // Labor doesn't use cost centers
        hasSubcategories: true
      },
      {
        category: 'ADD ONS',
        budget: projectBudget?.other_budget || 0,
        costCodeCategories: [],
        costCenterCodes: []
      },
      {
        category: 'SMALL TOOLS & CONSUMABLES',
        budget: projectBudget?.small_tools_consumables_budget || 0,
        costCodeCategories: ['material', 'other'],
        costCenterCodes: ['5000'] // Small tools cost center
      },
      {
        category: 'MATERIALS',
        budget: projectBudget?.materials_budget || 0,
        costCodeCategories: ['material'],
        costCenterCodes: ['3000'] // Materials cost center
      },
      {
        category: 'EQUIPMENT',
        budget: projectBudget?.equipment_budget || 0,
        costCodeCategories: ['equipment'],
        costCenterCodes: ['2000'] // Equipment cost center
      },
      {
        category: 'SUBCONTRACTS',
        budget: projectBudget?.subcontracts_budget || 0,
        costCodeCategories: ['subcontract'],
        costCenterCodes: ['4000'] // Subcontracts cost center
      },
      {
        category: 'RISK',
        budget: 0,
        costCodeCategories: [],
        costCenterCodes: []
      }
    ]

    // Get cost codes for each category
    const categoryResults = await Promise.all(
      budgetCategories.map(async (cat: any) => {
        let committed = 0
        let actuals = 0
        let forecastedFinal = cat.budget // Default to budget

        if (cat.category === 'LABOR') {
          // Get labor actuals with craft type details
          const { data: laborActuals } = await supabase
            .from('labor_actuals')
            .select(`
              actual_cost,
              actual_cost_with_burden,
              burden_amount,
              craft_type:craft_types(
                category
              )
            `)
            .eq('project_id', projectId)

          // Use centralized service for labor calculations
          const laborTotals = ForecastCalculationService.calculateTotalLaborActuals(laborActuals || [])
          const directActuals = laborTotals.byCategory.direct || 0
          const indirectActuals = laborTotals.byCategory.indirect || 0
          const staffActuals = laborTotals.byCategory.staff || 0
          
          actuals = laborTotals.total
          committed = actuals // For labor, committed = actuals

          // Get labor forecast from headcount with categories
          const { data: laborForecast } = await supabase
            .from('labor_headcount_forecasts')
            .select(`
              headcount,
              weekly_hours,
              craft_type,
              week_starting
            `)
            .eq('project_id', projectId)
            .gte('week_starting', new Date().toISOString())

          // Get craft types for mapping
          const { data: craftTypes } = await supabase
            .from('craft_types')
            .select('id, default_rate, category')

          // Calculate future labor using centralized service
          const runningAverageRates = ForecastCalculationService.calculateLaborRatesByCraft(laborActuals || [])
          const futureLaborCosts = await ForecastCalculationService.calculateFutureLaborCost(
            projectId,
            laborForecast?.map(f => ({
              forecasted_headcount: f.headcount,
              weekly_hours: f.weekly_hours,
              craft_type: f.craft_type,
              week_starting: f.week_starting
            })) || [],
            runningAverageRates,
            craftTypes || []
          )

          const directForecast = futureLaborCosts.byCategory.direct || 0
          const indirectForecast = futureLaborCosts.byCategory.indirect || 0
          const staffForecast = futureLaborCosts.byCategory.staff || 0

          if (futureLaborCosts.total > 0) {
            forecastedFinal = actuals + futureLaborCosts.total
          } else {
            // No future forecast exists, so forecasted final should at least be actuals
            forecastedFinal = actuals
          }

          // Tax & insurance is now included in the burdened labor costs
          // No need to calculate separately

          // Get labor budget breakdown from project_budget_breakdowns
          const { data: laborBudgetBreakdowns } = await supabase
            .from('project_budget_breakdowns')
            .select('cost_type, value')
            .eq('project_id', projectId)
            .in('cost_type', ['DIRECT LABOR', 'INDIRECT LABOR', 'PERDIEM', 'PER DIEM'])

          // Calculate labor subcategory budgets from actual breakdown data
          const laborBudgets = {
            'DIRECT LABOR': 0,
            'INDIRECT LABOR': 0,
            'STAFF LABOR': 0
          }

          laborBudgetBreakdowns?.forEach(breakdown => {
            if (breakdown.cost_type === 'DIRECT LABOR') {
              laborBudgets['DIRECT LABOR'] += breakdown.value || 0
            } else if (breakdown.cost_type === 'INDIRECT LABOR') {
              laborBudgets['INDIRECT LABOR'] += breakdown.value || 0
            } else if (breakdown.cost_type === 'PERDIEM' || breakdown.cost_type === 'PER DIEM') {
              laborBudgets['STAFF LABOR'] += breakdown.value || 0
            }
          })

          // Store subcategories for later
          cat.subcategories = [
            {
              category: 'DIRECT LABOR',
              budget: laborBudgets['DIRECT LABOR'],
              committed: directActuals,
              actuals: directActuals,
              forecastedFinal: Math.max(directActuals, directActuals + directForecast),
              variance: laborBudgets['DIRECT LABOR'] - Math.max(directActuals, directActuals + directForecast)
            },
            {
              category: 'INDIRECT LABOR',
              budget: laborBudgets['INDIRECT LABOR'],
              committed: indirectActuals,
              actuals: indirectActuals,
              forecastedFinal: Math.max(indirectActuals, indirectActuals + indirectForecast),
              variance: laborBudgets['INDIRECT LABOR'] - Math.max(indirectActuals, indirectActuals + indirectForecast)
            },
            {
              category: 'STAFF LABOR',
              budget: laborBudgets['STAFF LABOR'],
              committed: staffActuals,
              actuals: staffActuals,
              forecastedFinal: Math.max(staffActuals, staffActuals + staffForecast),
              variance: laborBudgets['STAFF LABOR'] - Math.max(staffActuals, staffActuals + staffForecast)
            }
          ]

          // Tax & insurance is now included in the burdened labor costs
          
          // Set main LABOR budget to sum of all subcategory budgets
          const breakdownTotal = laborBudgets['DIRECT LABOR'] + laborBudgets['INDIRECT LABOR'] + 
                                laborBudgets['STAFF LABOR']
          
          // Only override if we found labor breakdown data
          if (laborBudgetBreakdowns && laborBudgetBreakdowns.length > 0) {
            cat.budget = breakdownTotal
          }
          // Otherwise cat.budget keeps the original value from projectBudget?.labor_budget
        } else if (cat.costCodeCategories.length > 0 || cat.costCenterCodes.length > 0) {
          // Filter POs for this category
          const categoryPOs = allPOs?.filter(po => {
            // Check by cost code category
            if (po.cost_code?.category && cat.costCodeCategories.includes(po.cost_code.category)) {
              return true
            }
            // Check by cost center code
            if (po.cost_center && cat.costCenterCodes.includes(po.cost_center)) {
              return true
            }
            // For backwards compatibility, check budget_category field
            if (po.budget_category && po.budget_category.toLowerCase() === cat.category.toLowerCase()) {
              return true
            }
            return false
          }) || []

          if (categoryPOs.length > 0) {
            // Use centralized service for PO calculations
            const poTotals = ForecastCalculationService.calculateTotalPOForecast(categoryPOs)
            committed = poTotals.committed
            actuals = poTotals.invoiced
            forecastedFinal = poTotals.forecasted
          }
          
          // If no POs found but we have a budget, forecast should at least be the budget amount
          if (forecastedFinal === cat.budget && categoryPOs.length === 0 && cat.budget > 0) {
            // Keep forecasted as budget amount for categories with no POs
            forecastedFinal = cat.budget
          }
        }

        // Final safety check: ensure forecasted final is never less than actuals
        forecastedFinal = Math.max(forecastedFinal, actuals)
        
        const variance = cat.budget - forecastedFinal

        return {
          category: cat.category,
          budget: cat.budget,
          committed,
          actuals,
          forecastedFinal,
          variance,
          subcategories: cat.subcategories || null
        }
      })
    )

    return NextResponse.json({
      categories: categoryResults,
      projectBudget
    })
  } catch (error) {
    console.error('Budget vs actual error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}