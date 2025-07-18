import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
              craft_type:craft_types(
                category
              )
            `)
            .eq('project_id', projectId)

          // Calculate subcategory totals
          let directActuals = 0
          let indirectActuals = 0
          let staffActuals = 0

          if (laborActuals) {
            laborActuals.forEach(la => {
              const cost = la.actual_cost || 0
              switch (la.craft_type?.category) {
                case 'direct':
                  directActuals += cost
                  break
                case 'indirect':
                  indirectActuals += cost
                  break
                case 'staff':
                  staffActuals += cost
                  break
              }
            })
            actuals = directActuals + indirectActuals + staffActuals
            committed = actuals // For labor, committed = actuals
          }

          // Get labor forecast from headcount with categories
          const { data: laborForecast } = await supabase
            .from('labor_headcount_forecasts')
            .select(`
              headcount,
              weekly_hours,
              craft_type:craft_types(
                default_rate,
                category
              )
            `)
            .eq('project_id', projectId)
            .gte('week_starting', new Date().toISOString())

          let directForecast = 0
          let indirectForecast = 0
          let staffForecast = 0

          if (laborForecast && laborForecast.length > 0) {
            laborForecast.forEach(forecast => {
              const rate = forecast.craft_type?.default_rate || 50
              const weeklyHours = forecast.weekly_hours * forecast.headcount
              const cost = weeklyHours * rate
              
              switch (forecast.craft_type?.category) {
                case 'direct':
                  directForecast += cost
                  break
                case 'indirect':
                  indirectForecast += cost
                  break
                case 'staff':
                  staffForecast += cost
                  break
              }
            })
            const futureLabor = directForecast + indirectForecast + staffForecast
            forecastedFinal = actuals + futureLabor
          }

          // Calculate taxes & insurance (typically 25-30% of labor)
          const taxesInsuranceRate = 0.28 // 28% burden rate
          const taxesInsuranceActuals = actuals * taxesInsuranceRate
          const taxesInsuranceForecast = forecastedFinal * taxesInsuranceRate

          // Get labor budget breakdown from project_budget_breakdowns
          const { data: laborBudgetBreakdowns } = await supabase
            .from('project_budget_breakdowns')
            .select('cost_type, value')
            .eq('project_id', projectId)
            .in('cost_type', ['DIRECT LABOR', 'INDIRECT LABOR', 'TAXES & INSURANCE', 'PERDIEM', 'PER DIEM'])

          // Calculate labor subcategory budgets from actual breakdown data
          const laborBudgets = {
            'DIRECT LABOR': 0,
            'INDIRECT LABOR': 0,
            'STAFF LABOR': 0,
            'TAXES & INSURANCE': 0
          }

          laborBudgetBreakdowns?.forEach(breakdown => {
            if (breakdown.cost_type === 'DIRECT LABOR') {
              laborBudgets['DIRECT LABOR'] += breakdown.value
            } else if (breakdown.cost_type === 'INDIRECT LABOR') {
              laborBudgets['INDIRECT LABOR'] += breakdown.value
            } else if (breakdown.cost_type === 'TAXES & INSURANCE') {
              laborBudgets['TAXES & INSURANCE'] += breakdown.value
            } else if (breakdown.cost_type === 'PERDIEM' || breakdown.cost_type === 'PER DIEM') {
              laborBudgets['STAFF LABOR'] += breakdown.value
            }
          })

          // Store subcategories for later
          cat.subcategories = [
            {
              category: 'DIRECT LABOR',
              budget: laborBudgets['DIRECT LABOR'],
              committed: directActuals,
              actuals: directActuals,
              forecastedFinal: directActuals + directForecast,
              variance: laborBudgets['DIRECT LABOR'] - (directActuals + directForecast)
            },
            {
              category: 'INDIRECT LABOR',
              budget: laborBudgets['INDIRECT LABOR'],
              committed: indirectActuals,
              actuals: indirectActuals,
              forecastedFinal: indirectActuals + indirectForecast,
              variance: laborBudgets['INDIRECT LABOR'] - (indirectActuals + indirectForecast)
            },
            {
              category: 'STAFF LABOR',
              budget: laborBudgets['STAFF LABOR'],
              committed: staffActuals,
              actuals: staffActuals,
              forecastedFinal: staffActuals + staffForecast,
              variance: laborBudgets['STAFF LABOR'] - (staffActuals + staffForecast)
            },
            {
              category: 'TAXES & INSURANCE',
              budget: laborBudgets['TAXES & INSURANCE'],
              committed: taxesInsuranceActuals,
              actuals: taxesInsuranceActuals,
              forecastedFinal: taxesInsuranceForecast,
              variance: laborBudgets['TAXES & INSURANCE'] - taxesInsuranceForecast
            }
          ]

          // Update totals to include taxes & insurance
          actuals += taxesInsuranceActuals
          committed += taxesInsuranceActuals
          forecastedFinal += taxesInsuranceForecast
          
          // Set main LABOR budget to sum of all subcategory budgets
          cat.budget = laborBudgets['DIRECT LABOR'] + laborBudgets['INDIRECT LABOR'] + 
                       laborBudgets['STAFF LABOR'] + laborBudgets['TAXES & INSURANCE']
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
            committed = categoryPOs.reduce((sum, po) => sum + (po.committed_amount || 0), 0)
            
            // Calculate forecasted final
            forecastedFinal = categoryPOs.reduce((sum, po) => {
              // Use forecasted_final_cost if available, otherwise use committed_amount
              return sum + (po.forecasted_final_cost || po.committed_amount || 0)
            }, 0)

            // Calculate actuals from PO invoiced_amount field
            actuals = categoryPOs.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0)
          }
          
          // If no POs found but we have a budget, forecast should at least be the budget amount
          if (forecastedFinal === cat.budget && categoryPOs.length === 0 && cat.budget > 0) {
            // Keep forecasted as budget amount for categories with no POs
            forecastedFinal = cat.budget
          }
        }

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