import { createClient } from '@/lib/supabase/server'

interface PurchaseOrder {
  committed_amount: number | null
  invoiced_amount: number | null
  forecast_amount: number | null
  forecasted_final_cost: number | null
}

interface LaborActual {
  actual_cost: number | null
  actual_hours: number | null
  actual_cost_with_burden?: number | null
  burden_amount?: number | null
  week_ending: string
  craft_type?: {
    id: string
    name?: string
    code?: string
    category?: string
  } | null
}

interface LaborForecast {
  forecasted_headcount: number
  weekly_hours?: number
  craft_type: string
  week_ending?: string
  week_starting?: string
}

interface CraftType {
  id: string
  default_rate: number | null
  category: string
}

/**
 * Centralized service for calculating project forecasts
 * Ensures consistency across all views and reports
 */
export class ForecastCalculationService {
  /**
   * Calculate the forecasted final cost for a purchase order
   * Uses hierarchy: forecasted_final_cost > forecast_amount > committed_amount
   * Always ensures forecast >= actuals (invoiced_amount)
   */
  static calculatePOForecast(po: PurchaseOrder): number {
    const invoiced = po.invoiced_amount || 0
    const committed = po.committed_amount || 0
    
    // Use the hierarchy: forecasted_final_cost > forecast_amount > committed_amount
    let forecast = po.forecasted_final_cost || po.forecast_amount || committed
    
    // Ensure forecast is never less than what's already invoiced
    return Math.max(forecast, invoiced)
  }

  /**
   * Calculate total PO forecasts for a project
   */
  static calculateTotalPOForecast(purchaseOrders: PurchaseOrder[]): {
    committed: number
    invoiced: number
    forecasted: number
    remainingCommitments: number
  } {
    const committed = purchaseOrders.reduce((sum, po) => sum + (po.committed_amount || 0), 0)
    const invoiced = purchaseOrders.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0)
    const forecasted = purchaseOrders.reduce((sum, po) => sum + this.calculatePOForecast(po), 0)
    const remainingCommitments = Math.max(0, committed - invoiced)

    return { committed, invoiced, forecasted, remainingCommitments }
  }

  /**
   * Calculate labor rates from actuals
   * Returns running average rates by craft type
   */
  static calculateLaborRatesByCraft(laborActuals: LaborActual[]): Record<string, number> {
    const ratesByCraft: Record<string, { totalCost: number; totalHours: number }> = {}
    
    // Group by craft type and calculate totals
    laborActuals.forEach(labor => {
      if (labor.craft_type?.id && labor.actual_hours && labor.actual_hours > 0) {
        const craftId = labor.craft_type.id
        const cost = labor.actual_cost_with_burden || labor.actual_cost || 0
        
        if (!ratesByCraft[craftId]) {
          ratesByCraft[craftId] = { totalCost: 0, totalHours: 0 }
        }
        
        ratesByCraft[craftId].totalCost += cost
        ratesByCraft[craftId].totalHours += labor.actual_hours
      }
    })
    
    // Calculate average rates
    const rates: Record<string, number> = {}
    Object.entries(ratesByCraft).forEach(([craftId, data]) => {
      if (data.totalHours > 0) {
        rates[craftId] = data.totalCost / data.totalHours
      }
    })
    
    return rates
  }

  /**
   * Calculate future labor costs from headcount forecasts
   * Uses running average rates when available, falls back to default rates
   */
  static async calculateFutureLaborCost(
    projectId: string,
    laborForecasts: LaborForecast[],
    runningAverageRates: Record<string, number>,
    craftTypes?: CraftType[]
  ): Promise<{ total: number; byCategory: Record<string, number> }> {
    let craftTypeMap: Record<string, CraftType> = {}
    
    // Get craft types if not provided
    if (!craftTypes) {
      const supabase = await createClient()
      const { data: craftTypesData } = await supabase
        .from('craft_types')
        .select('id, default_rate, category')
      
      if (craftTypesData) {
        craftTypesData.forEach(ct => {
          craftTypeMap[ct.id] = ct
        })
      }
    } else {
      craftTypes.forEach(ct => {
        craftTypeMap[ct.id] = ct
      })
    }
    
    let total = 0
    const byCategory: Record<string, number> = {
      direct: 0,
      indirect: 0,
      staff: 0
    }
    
    laborForecasts.forEach(forecast => {
      // Use running average rate if available, otherwise use default rate
      const rate = runningAverageRates[forecast.craft_type] || 
                   craftTypeMap[forecast.craft_type]?.default_rate || 
                   50 // fallback rate
      
      // Use weekly_hours if provided, otherwise default to 40
      const weeklyHours = (forecast.weekly_hours || 40) * forecast.forecasted_headcount
      const weeklyLaborCost = weeklyHours * rate
      
      total += weeklyLaborCost
      
      // Track by category
      const category = craftTypeMap[forecast.craft_type]?.category || 'direct'
      byCategory[category] = (byCategory[category] || 0) + weeklyLaborCost
    })
    
    return { total, byCategory }
  }

  /**
   * Calculate total labor actuals with burden
   */
  static calculateTotalLaborActuals(laborActuals: LaborActual[]): {
    total: number
    byCategory: Record<string, number>
  } {
    let total = 0
    const byCategory: Record<string, number> = {
      direct: 0,
      indirect: 0,
      staff: 0
    }
    
    laborActuals.forEach(labor => {
      // Always use burdened cost when available
      const cost = labor.actual_cost_with_burden || labor.actual_cost || 0
      total += cost
      
      const category = labor.craft_type?.category || 'direct'
      byCategory[category] = (byCategory[category] || 0) + cost
    })
    
    return { total, byCategory }
  }

  /**
   * Calculate project Estimate at Completion (EAC)
   * This is the main method that should be used for project-level forecasts
   */
  static async calculateProjectEAC(
    projectId: string,
    purchaseOrders: PurchaseOrder[],
    laborActuals: LaborActual[],
    laborForecasts: LaborForecast[]
  ): Promise<{
    actualCostToDate: number
    estimateToComplete: number
    estimateAtCompletion: number
    breakdown: {
      poActuals: number
      poRemaining: number
      poForecasted: number
      laborActuals: number
      laborFuture: number
    }
  }> {
    // Calculate PO totals
    const poTotals = this.calculateTotalPOForecast(purchaseOrders)
    
    // Calculate labor actuals
    const laborActualTotals = this.calculateTotalLaborActuals(laborActuals)
    
    // Calculate running average rates
    const runningAverageRates = this.calculateLaborRatesByCraft(laborActuals)
    
    // Calculate future labor costs
    const futureLaborCosts = await this.calculateFutureLaborCost(
      projectId,
      laborForecasts,
      runningAverageRates
    )
    
    // Calculate totals
    const actualCostToDate = poTotals.invoiced + laborActualTotals.total
    const estimateToComplete = poTotals.remainingCommitments + futureLaborCosts.total
    const estimateAtCompletion = actualCostToDate + estimateToComplete
    
    return {
      actualCostToDate,
      estimateToComplete,
      estimateAtCompletion,
      breakdown: {
        poActuals: poTotals.invoiced,
        poRemaining: poTotals.remainingCommitments,
        poForecasted: poTotals.forecasted,
        laborActuals: laborActualTotals.total,
        laborFuture: futureLaborCosts.total
      }
    }
  }

  /**
   * Calculate forecast for a specific budget category
   * Used in budget vs actual views
   */
  static async calculateCategoryForecast(
    categoryName: string,
    budget: number,
    purchaseOrders: PurchaseOrder[],
    laborActuals?: LaborActual[],
    laborForecasts?: LaborForecast[],
    laborCategory?: 'direct' | 'indirect' | 'staff'
  ): Promise<{
    budget: number
    committed: number
    actuals: number
    forecastedFinal: number
    variance: number
  }> {
    let committed = 0
    let actuals = 0
    let forecastedFinal = budget // Default to budget
    
    if (categoryName === 'LABOR' && laborActuals && laborForecasts) {
      // Calculate labor totals
      const laborActualTotals = this.calculateTotalLaborActuals(laborActuals)
      actuals = laborCategory ? laborActualTotals.byCategory[laborCategory] || 0 : laborActualTotals.total
      committed = actuals // For labor, committed = actuals
      
      // Calculate future labor
      const runningAverageRates = this.calculateLaborRatesByCraft(laborActuals)
      const futureLaborCosts = await this.calculateFutureLaborCost(
        '', // projectId not needed if we pass craftTypes
        laborForecasts,
        runningAverageRates
      )
      
      const futureCost = laborCategory ? futureLaborCosts.byCategory[laborCategory] || 0 : futureLaborCosts.total
      forecastedFinal = actuals + futureCost
    } else if (purchaseOrders.length > 0) {
      // Calculate PO totals
      committed = purchaseOrders.reduce((sum, po) => sum + (po.committed_amount || 0), 0)
      actuals = purchaseOrders.reduce((sum, po) => sum + (po.invoiced_amount || 0), 0)
      forecastedFinal = purchaseOrders.reduce((sum, po) => sum + this.calculatePOForecast(po), 0)
    }
    
    // Ensure forecasted final is never less than actuals
    forecastedFinal = Math.max(forecastedFinal, actuals)
    
    // Calculate variance (positive = under budget, negative = over budget)
    const variance = budget - forecastedFinal
    
    return {
      budget,
      committed,
      actuals,
      forecastedFinal,
      variance
    }
  }
}