import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForecastCalculationService } from '../forecast-calculations'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [
          { id: 'craft1', default_rate: 50, category: 'direct' },
          { id: 'craft2', default_rate: 60, category: 'indirect' },
          { id: 'craft3', default_rate: 70, category: 'staff' },
        ],
      })),
    })),
  })),
}))

describe('ForecastCalculationService', () => {
  describe('calculatePOForecast', () => {
    it('should use forecasted_final_cost when available', () => {
      const po = {
        committed_amount: 1000,
        invoiced_amount: 500,
        forecast_amount: 1200,
        forecasted_final_cost: 1500,
      }
      expect(ForecastCalculationService.calculatePOForecast(po)).toBe(1500)
    })

    it('should fall back to forecast_amount when forecasted_final_cost is null', () => {
      const po = {
        committed_amount: 1000,
        invoiced_amount: 500,
        forecast_amount: 1200,
        forecasted_final_cost: null,
      }
      expect(ForecastCalculationService.calculatePOForecast(po)).toBe(1200)
    })

    it('should fall back to committed_amount when both forecasts are null', () => {
      const po = {
        committed_amount: 1000,
        invoiced_amount: 500,
        forecast_amount: null,
        forecasted_final_cost: null,
      }
      expect(ForecastCalculationService.calculatePOForecast(po)).toBe(1000)
    })

    it('should never return less than invoiced_amount', () => {
      const po = {
        committed_amount: 1000,
        invoiced_amount: 1500,
        forecast_amount: 1200,
        forecasted_final_cost: null,
      }
      expect(ForecastCalculationService.calculatePOForecast(po)).toBe(1500)
    })

    it('should handle all null values', () => {
      const po = {
        committed_amount: null,
        invoiced_amount: null,
        forecast_amount: null,
        forecasted_final_cost: null,
      }
      expect(ForecastCalculationService.calculatePOForecast(po)).toBe(0)
    })
  })

  describe('calculateTotalPOForecast', () => {
    const purchaseOrders = [
      {
        committed_amount: 1000,
        invoiced_amount: 500,
        forecast_amount: 1200,
        forecasted_final_cost: null,
      },
      {
        committed_amount: 2000,
        invoiced_amount: 1800,
        forecast_amount: 2100,
        forecasted_final_cost: 2200,
      },
      {
        committed_amount: 500,
        invoiced_amount: 0,
        forecast_amount: null,
        forecasted_final_cost: null,
      },
    ]

    it('should calculate totals correctly', () => {
      const result = ForecastCalculationService.calculateTotalPOForecast(purchaseOrders)
      
      expect(result.committed).toBe(3500)
      expect(result.invoiced).toBe(2300)
      expect(result.forecasted).toBe(3900) // 1200 + 2200 + 500
      expect(result.remainingCommitments).toBe(1200) // 3500 - 2300
    })

    it('should handle empty array', () => {
      const result = ForecastCalculationService.calculateTotalPOForecast([])
      
      expect(result.committed).toBe(0)
      expect(result.invoiced).toBe(0)
      expect(result.forecasted).toBe(0)
      expect(result.remainingCommitments).toBe(0)
    })

    it('should not return negative remaining commitments', () => {
      const overInvoiced = [{
        committed_amount: 1000,
        invoiced_amount: 1500,
        forecast_amount: null,
        forecasted_final_cost: null,
      }]
      
      const result = ForecastCalculationService.calculateTotalPOForecast(overInvoiced)
      expect(result.remainingCommitments).toBe(0)
    })
  })

  describe('calculateLaborRatesByCraft', () => {
    const laborActuals = [
      {
        actual_cost: 1000,
        actual_hours: 20,
        actual_cost_with_burden: 1200,
        burden_amount: 200,
        week_ending: '2025-01-15',
        craft_type: { id: 'craft1', name: 'Carpenter', code: 'CARP', category: 'direct' },
      },
      {
        actual_cost: 1500,
        actual_hours: 25,
        actual_cost_with_burden: 1800,
        burden_amount: 300,
        week_ending: '2025-01-22',
        craft_type: { id: 'craft1', name: 'Carpenter', code: 'CARP', category: 'direct' },
      },
      {
        actual_cost: 2000,
        actual_hours: 30,
        actual_cost_with_burden: null,
        burden_amount: null,
        week_ending: '2025-01-15',
        craft_type: { id: 'craft2', name: 'Foreman', code: 'FORE', category: 'indirect' },
      },
    ]

    it('should calculate running average rates by craft type', () => {
      const rates = ForecastCalculationService.calculateLaborRatesByCraft(laborActuals)
      
      // Craft1: (1200 + 1800) / (20 + 25) = 3000 / 45 = 66.67
      expect(rates.craft1).toBeCloseTo(66.67, 2)
      
      // Craft2: 2000 / 30 = 66.67 (no burden, so uses actual_cost)
      expect(rates.craft2).toBeCloseTo(66.67, 2)
    })

    it('should prefer actual_cost_with_burden over actual_cost', () => {
      const actuals = [{
        actual_cost: 1000,
        actual_hours: 10,
        actual_cost_with_burden: 1500,
        burden_amount: 500,
        week_ending: '2025-01-15',
        craft_type: { id: 'craft1', name: 'Test', code: 'TEST', category: 'direct' },
      }]
      
      const rates = ForecastCalculationService.calculateLaborRatesByCraft(actuals)
      expect(rates.craft1).toBe(150) // 1500 / 10
    })

    it('should ignore entries with zero or null hours', () => {
      const actuals = [
        {
          actual_cost: 1000,
          actual_hours: 0,
          actual_cost_with_burden: 1200,
          burden_amount: 200,
          week_ending: '2025-01-15',
          craft_type: { id: 'craft1', name: 'Test', code: 'TEST', category: 'direct' },
        },
        {
          actual_cost: 2000,
          actual_hours: null,
          actual_cost_with_burden: 2400,
          burden_amount: 400,
          week_ending: '2025-01-22',
          craft_type: { id: 'craft1', name: 'Test', code: 'TEST', category: 'direct' },
        },
      ]
      
      const rates = ForecastCalculationService.calculateLaborRatesByCraft(actuals)
      expect(rates).toEqual({})
    })

    it('should handle empty array', () => {
      const rates = ForecastCalculationService.calculateLaborRatesByCraft([])
      expect(rates).toEqual({})
    })
  })

  describe('calculateFutureLaborCost', () => {
    const laborForecasts = [
      { forecasted_headcount: 5, weekly_hours: 40, craft_type: 'craft1' },
      { forecasted_headcount: 3, weekly_hours: 40, craft_type: 'craft2' },
      { forecasted_headcount: 2, weekly_hours: 40, craft_type: 'craft3' },
    ]

    const runningAverageRates = {
      craft1: 55,
      craft2: 65,
    }

    const craftTypes = [
      { id: 'craft1', default_rate: 50, category: 'direct' },
      { id: 'craft2', default_rate: 60, category: 'indirect' },
      { id: 'craft3', default_rate: 70, category: 'staff' },
    ]

    it('should calculate future labor costs using running average rates when available', async () => {
      const result = await ForecastCalculationService.calculateFutureLaborCost(
        'project1',
        laborForecasts,
        runningAverageRates,
        craftTypes
      )

      // Craft1: 5 * 40 * 55 = 11,000 (using running average)
      // Craft2: 3 * 40 * 65 = 7,800 (using running average)
      // Craft3: 2 * 40 * 70 = 5,600 (using default rate)
      expect(result.total).toBe(24400)
      expect(result.byCategory.direct).toBe(11000)
      expect(result.byCategory.indirect).toBe(7800)
      expect(result.byCategory.staff).toBe(5600)
    })

    it('should use default rates when running averages are not available', async () => {
      const result = await ForecastCalculationService.calculateFutureLaborCost(
        'project1',
        laborForecasts,
        {},
        craftTypes
      )

      // All using default rates
      expect(result.total).toBe(22800) // (5*40*50) + (3*40*60) + (2*40*70)
      expect(result.byCategory.direct).toBe(10000)
      expect(result.byCategory.indirect).toBe(7200)
      expect(result.byCategory.staff).toBe(5600)
    })

    it('should use 50 as fallback rate when no rate is available', async () => {
      const forecasts = [{ forecasted_headcount: 2, weekly_hours: 40, craft_type: 'unknown' }]
      
      const result = await ForecastCalculationService.calculateFutureLaborCost(
        'project1',
        forecasts,
        {},
        craftTypes
      )

      expect(result.total).toBe(4000) // 2 * 40 * 50
    })

    it('should handle empty forecasts', async () => {
      const result = await ForecastCalculationService.calculateFutureLaborCost(
        'project1',
        [],
        runningAverageRates,
        craftTypes
      )

      expect(result.total).toBe(0)
      expect(result.byCategory).toEqual({ direct: 0, indirect: 0, staff: 0 })
    })

    it('should default weekly hours to 40 when not specified', async () => {
      const forecasts = [{ forecasted_headcount: 1, craft_type: 'craft1', weekly_hours: undefined }]
      
      const result = await ForecastCalculationService.calculateFutureLaborCost(
        'project1',
        forecasts,
        runningAverageRates,
        craftTypes
      )

      expect(result.total).toBe(2200) // 1 * 40 * 55
    })
  })
})