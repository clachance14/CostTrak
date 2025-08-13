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
    
    // Get division filter from query params
    const { searchParams } = new URL(request.url)
    const divisionId = searchParams.get('division_id')

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get budget data from projects table with correct column names
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        total_labor_budget,
        labor_direct_budget,
        labor_indirect_budget,
        labor_staff_budget,
        materials_budget,
        equipment_budget,
        subcontracts_budget,
        small_tools_budget
      `)
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error fetching project budget:', projectError)
      throw projectError
    }
    
    const projectBudget = project

    // Get POs for the project, filtered by division if specified
    let poQuery = supabase
      .from('purchase_orders')
      .select('*')
      .eq('project_id', projectId)
    
    if (divisionId) {
      poQuery = poQuery.eq('division_id', divisionId)
    }
    
    const { data: allPOs } = await poQuery
    

    // Define budget categories with their mappings (removed ADD ONS)
    const budgetCategories = [
      {
        category: 'LABOR',
        budget: projectBudget?.total_labor_budget || 0,
        costCodeCategories: ['labor'],
        costCenterCodes: [], // Labor doesn't use cost centers
        hasSubcategories: true
      },
      {
        category: 'SMALL TOOLS & CONSUMABLES',
        budget: projectBudget?.small_tools_budget || 0,
        costCodeCategories: ['small_tools', 'consumables'],
        costCenterCodes: ['5000'] // Small tools cost center
      },
      {
        category: 'MATERIALS',
        budget: projectBudget?.materials_budget || 0,
        costCodeCategories: ['material', 'materials'],
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
      budgetCategories.map(async (cat) => {
        let committed = 0
        let actuals = 0
        let forecastedFinal = cat.budget // Default to budget
        let leftToSpend = 0 // Will be calculated differently for labor vs non-labor

        if (cat.category === 'LABOR') {
          // Get labor actuals with employee category details
          let laborQuery = supabase
            .from('labor_employee_actuals')
            .select(`
              st_wages,
              ot_wages,
              total_cost_with_burden,
              total_burden_amount,
              employees!inner(
                category
              )
            `)
            .eq('project_id', projectId)
          
          if (divisionId) {
            laborQuery = laborQuery.eq('division_id', divisionId)
          }
          
          const { data: laborActuals } = await laborQuery

          // Calculate labor actuals manually since we're using labor_employee_actuals
          let directActuals = 0
          let indirectActuals = 0
          let staffActuals = 0
          
          laborActuals?.forEach(labor => {
            // Use total_cost_with_burden if available, otherwise calculate from wages
            const cost = labor.total_cost_with_burden || 
                        ((labor.st_wages || 0) + (labor.ot_wages || 0)) * 1.28
            const category = labor.employees?.category?.toLowerCase() || 'direct'
            
            if (category === 'indirect') {
              indirectActuals += cost
            } else if (category === 'staff') {
              staffActuals += cost
            } else {
              directActuals += cost
            }
          })
          
          // Get per diem costs for this project
          let perDiemQuery = supabase
            .from('per_diem_costs')
            .select('employee_type, amount')
            .eq('project_id', projectId)
          
          if (divisionId) {
            // If filtering by division, we need to join with labor_employee_actuals
            perDiemQuery = supabase
              .from('per_diem_costs')
              .select(`
                employee_type, 
                amount,
                labor_employee_actuals!inner(division_id)
              `)
              .eq('project_id', projectId)
              .eq('labor_employee_actuals.division_id', divisionId)
          }
          
          const { data: perDiemCosts } = await perDiemQuery
          
          // Add per diem costs to the appropriate labor categories
          let directPerDiem = 0
          let indirectPerDiem = 0
          
          perDiemCosts?.forEach(perDiem => {
            if (perDiem.employee_type === 'Direct') {
              directPerDiem += perDiem.amount || 0
            } else if (perDiem.employee_type === 'Indirect') {
              indirectPerDiem += perDiem.amount || 0
            }
          })
          
          // Add per diem to actuals
          directActuals += directPerDiem
          indirectActuals += indirectPerDiem
          
          actuals = directActuals + indirectActuals + staffActuals
          committed = actuals // For labor, committed = actuals

          // Get ALL labor forecasts - we'll filter by actuals later
          let laborForecastQuery = supabase
            .from('labor_headcount_forecasts')
            .select(`
              headcount,
              avg_weekly_hours,
              craft_type_id,
              week_ending
            `)
            .eq('project_id', projectId)
          
          if (divisionId) {
            laborForecastQuery = laborForecastQuery.eq('division_id', divisionId)
          }
          
          const { data: laborForecast, error: forecastError } = await laborForecastQuery
          
          if (forecastError) {
            console.error('Error fetching labor forecast:', forecastError)
          }
          
          // Get weeks that have actuals to exclude them from forecast
          const { data: actualWeeks } = await supabase
            .from('labor_employee_actuals')
            .select('week_ending')
            .eq('project_id', projectId)
          
          // Create a set of weeks that have actual data
          const weeksWithActuals = new Set(actualWeeks?.map(w => {
            const weekEnding = new Date(w.week_ending)
            return weekEnding.toISOString().split('T')[0]
          }) || [])
          
          // Filter forecast to only include weeks without actuals
          const futureForecasts = laborForecast?.filter(f => {
            const weekEndingDate = new Date(f.week_ending).toISOString().split('T')[0]
            return !weeksWithActuals.has(weekEndingDate)
          }) || []

          // Get craft types for mapping
          const { data: craftTypes } = await supabase
            .from('craft_types')
            .select('id, default_rate, category')

          // Calculate future labor using centralized service
          const runningAverageRates = ForecastCalculationService.calculateLaborRatesByCraft(laborActuals || [])
          
          const futureLaborCosts = await ForecastCalculationService.calculateFutureLaborCost(
            projectId,
            futureForecasts.map(f => ({
              forecasted_headcount: f.headcount,
              weekly_hours: f.avg_weekly_hours,
              craft_type: f.craft_type_id,
              week_starting: f.week_ending  // The service expects week_starting but we have week_ending
            })),
            runningAverageRates,
            craftTypes || []
          )

          const directForecast = futureLaborCosts.byCategory.direct || 0
          const indirectForecast = futureLaborCosts.byCategory.indirect || 0
          const staffForecast = futureLaborCosts.byCategory.staff || 0

          // Calculate the remaining labor forecast (this is "Left to Spend" for labor)
          const remainingLaborForecast = futureLaborCosts.total || 0
          leftToSpend = remainingLaborForecast
          
          if (futureLaborCosts.total > 0) {
            forecastedFinal = actuals + futureLaborCosts.total
          } else {
            // No future forecast exists, so forecasted final should at least be actuals
            forecastedFinal = actuals
          }

          // Tax & insurance is now included in the burdened labor costs
          // No need to calculate separately

          // Use the labor subcategory budgets directly from projects table
          const laborBudgets = {
            'DIRECT LABOR': projectBudget?.labor_direct_budget || 0,
            'INDIRECT LABOR': projectBudget?.labor_indirect_budget || 0,
            'STAFF LABOR': projectBudget?.labor_staff_budget || 0
          }

          // If we don't have individual labor budgets, try to get from project_budget_breakdowns
          if (laborBudgets['DIRECT LABOR'] === 0 && laborBudgets['INDIRECT LABOR'] === 0 && laborBudgets['STAFF LABOR'] === 0) {
            const { data: laborBudgetBreakdowns } = await supabase
              .from('project_budget_breakdowns')
              .select('cost_type, value')
              .eq('project_id', projectId)
              .in('cost_type', ['DIRECT LABOR', 'INDIRECT LABOR', 'PERDIEM', 'PER DIEM'])

            laborBudgetBreakdowns?.forEach(breakdown => {
              if (breakdown.cost_type === 'DIRECT LABOR') {
                laborBudgets['DIRECT LABOR'] += breakdown.value || 0
              } else if (breakdown.cost_type === 'INDIRECT LABOR') {
                laborBudgets['INDIRECT LABOR'] += breakdown.value || 0
              } else if (breakdown.cost_type === 'PERDIEM' || breakdown.cost_type === 'PER DIEM') {
                laborBudgets['STAFF LABOR'] += breakdown.value || 0
              }
            })
          }

          // Store subcategories for later
          cat.subcategories = [
            {
              category: 'DIRECT LABOR',
              budget: laborBudgets['DIRECT LABOR'],
              committed: directActuals,
              actuals: directActuals,
              leftToSpend: directForecast,
              forecastedFinal: Math.max(directActuals, directActuals + directForecast),
              variance: laborBudgets['DIRECT LABOR'] - Math.max(directActuals, directActuals + directForecast)
            },
            {
              category: 'INDIRECT LABOR',
              budget: laborBudgets['INDIRECT LABOR'],
              committed: indirectActuals,
              actuals: indirectActuals,
              leftToSpend: indirectForecast,
              forecastedFinal: Math.max(indirectActuals, indirectActuals + indirectForecast),
              variance: laborBudgets['INDIRECT LABOR'] - Math.max(indirectActuals, indirectActuals + indirectForecast)
            },
            {
              category: 'STAFF LABOR',
              budget: laborBudgets['STAFF LABOR'],
              committed: staffActuals,
              actuals: staffActuals,
              leftToSpend: staffForecast,
              forecastedFinal: Math.max(staffActuals, staffActuals + staffForecast),
              variance: laborBudgets['STAFF LABOR'] - Math.max(staffActuals, staffActuals + staffForecast)
            }
          ]

          // Tax & insurance is now included in the burdened labor costs
          
          // The main LABOR budget is already set from total_labor_budget
          // No need to recalculate from subcategories
        } else if (cat.costCodeCategories.length > 0 || cat.costCenterCodes.length > 0) {
          // Filter POs for this category
          const categoryPOs = allPOs?.filter(po => {
            // Map budget_category values to our category names
            const poCategory = po.budget_category?.toLowerCase() || ''
            
            // Direct category name match
            if (poCategory === cat.category.toLowerCase()) {
              return true
            }
            
            // Map common variations
            if (cat.category === 'MATERIALS' && (poCategory === 'material' || poCategory === 'materials')) {
              return true
            }
            if (cat.category === 'EQUIPMENT' && poCategory === 'equipment') {
              return true
            }
            if (cat.category === 'SUBCONTRACTS' && (poCategory === 'subcontract' || poCategory === 'subcontracts')) {
              return true
            }
            if (cat.category === 'SMALL TOOLS & CONSUMABLES' && 
                (poCategory === 'small tools' || poCategory === 'small_tools' || 
                 poCategory === 'consumables' || poCategory === 'small tools & consumables')) {
              return true
            }
            
            // Check by cost center code as fallback
            if (po.cost_center && cat.costCenterCodes.includes(po.cost_center)) {
              return true
            }
            
            return false
          }) || []

          if (categoryPOs.length > 0) {
            // Calculate PO totals using total_amount for actuals (to match PO Breakdown chart)
            committed = categoryPOs.reduce((sum, po) => sum + (po.committed_amount || 0), 0)
            actuals = categoryPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0)
            
            console.log(`${cat.category}: ${categoryPOs.length} POs, actuals: $${actuals}`)
            
            // Use service for forecast calculation
            const poTotals = ForecastCalculationService.calculateTotalPOForecast(categoryPOs)
            forecastedFinal = poTotals.forecasted
            
            // For POs, "Left to Spend" is remaining commitments
            leftToSpend = Math.max(0, committed - actuals)
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
          leftToSpend,  // Add this field for the component
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