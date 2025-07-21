import { createClient } from '@/lib/supabase/server'

export interface DivisionAlert {
  id: string
  division_id: string
  project_id: string
  alert_type: 'budget_overrun' | 'margin_risk' | 'po_risk' | 'schedule_delay' | 'missing_forecast'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  threshold_value?: number
  actual_value?: number
  created_at: string
}

export interface DivisionThreshold {
  budget_warning_percent: number // Default 80%
  budget_critical_percent: number // Default 90%
  margin_warning_percent: number // Default 10%
  margin_critical_percent: number // Default 5%
  po_uncommitted_warning_days: number // Default 30
  forecast_stale_days: number // Default 14
}

const DEFAULT_THRESHOLDS: DivisionThreshold = {
  budget_warning_percent: 80,
  budget_critical_percent: 90,
  margin_warning_percent: 10,
  margin_critical_percent: 5,
  po_uncommitted_warning_days: 30,
  forecast_stale_days: 14
}

export class DivisionBusinessRules {
  private supabase: Promise<ReturnType<typeof createClient>>

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Check all business rules for a division and generate alerts
   */
  async checkDivisionRules(projectId: string, divisionId: string): Promise<DivisionAlert[]> {
    const alerts: DivisionAlert[] = []

    try {
      // Get division data
      const { data: divisionData } = await this.supabase
        .from('division_cost_summary')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .single()

      if (!divisionData) return alerts

      const { data: budget } = await this.supabase
        .from('division_budgets')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .single()

      const { data: forecast } = await this.supabase
        .from('division_forecasts')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .order('forecast_date', { ascending: false })
        .limit(1)
        .single()

      // Check budget utilization
      if (budget && budget.total_budget > 0) {
        const utilizationPercent = (divisionData.total_committed / budget.total_budget) * 100

        if (utilizationPercent >= DEFAULT_THRESHOLDS.budget_critical_percent) {
          alerts.push({
            id: `${divisionId}-budget-critical`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'budget_overrun',
            severity: 'critical',
            message: `Division budget is ${utilizationPercent.toFixed(1)}% committed`,
            threshold_value: DEFAULT_THRESHOLDS.budget_critical_percent,
            actual_value: utilizationPercent,
            created_at: new Date().toISOString()
          })
        } else if (utilizationPercent >= DEFAULT_THRESHOLDS.budget_warning_percent) {
          alerts.push({
            id: `${divisionId}-budget-warning`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'budget_overrun',
            severity: 'high',
            message: `Division budget is ${utilizationPercent.toFixed(1)}% committed`,
            threshold_value: DEFAULT_THRESHOLDS.budget_warning_percent,
            actual_value: utilizationPercent,
            created_at: new Date().toISOString()
          })
        }
      }

      // Check margin
      if (budget && divisionData.total_committed > 0) {
        const projectedRevenue = budget.total_budget * 1.15 // Assume 15% markup target
        const projectedProfit = projectedRevenue - (forecast?.forecasted_cost || divisionData.total_committed)
        const marginPercent = (projectedProfit / projectedRevenue) * 100

        if (marginPercent < DEFAULT_THRESHOLDS.margin_critical_percent) {
          alerts.push({
            id: `${divisionId}-margin-critical`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'margin_risk',
            severity: 'critical',
            message: `Division margin at ${marginPercent.toFixed(1)}%`,
            threshold_value: DEFAULT_THRESHOLDS.margin_critical_percent,
            actual_value: marginPercent,
            created_at: new Date().toISOString()
          })
        } else if (marginPercent < DEFAULT_THRESHOLDS.margin_warning_percent) {
          alerts.push({
            id: `${divisionId}-margin-warning`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'margin_risk',
            severity: 'high',
            message: `Division margin at ${marginPercent.toFixed(1)}%`,
            threshold_value: DEFAULT_THRESHOLDS.margin_warning_percent,
            actual_value: marginPercent,
            created_at: new Date().toISOString()
          })
        }
      }

      // Check forecast freshness
      if (forecast) {
        const daysSinceForecast = Math.floor(
          (new Date().getTime() - new Date(forecast.forecast_date).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceForecast > DEFAULT_THRESHOLDS.forecast_stale_days) {
          alerts.push({
            id: `${divisionId}-forecast-stale`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'missing_forecast',
            severity: 'medium',
            message: `Division forecast is ${daysSinceForecast} days old`,
            threshold_value: DEFAULT_THRESHOLDS.forecast_stale_days,
            actual_value: daysSinceForecast,
            created_at: new Date().toISOString()
          })
        }
      } else {
        alerts.push({
          id: `${divisionId}-forecast-missing`,
          division_id: divisionId,
          project_id: projectId,
          alert_type: 'missing_forecast',
          severity: 'high',
          message: 'No forecast exists for this division',
          created_at: new Date().toISOString()
        })
      }

      // Check for uncommitted POs
      const { data: uncommittedPOs } = await this.supabase
        .from('purchase_orders')
        .select('id, po_number, created_at')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .eq('status', 'draft')
        .order('created_at', { ascending: true })

      if (uncommittedPOs && uncommittedPOs.length > 0) {
        const oldestPO = uncommittedPOs[0]
        const daysOld = Math.floor(
          (new Date().getTime() - new Date(oldestPO.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysOld > DEFAULT_THRESHOLDS.po_uncommitted_warning_days) {
          alerts.push({
            id: `${divisionId}-po-uncommitted`,
            division_id: divisionId,
            project_id: projectId,
            alert_type: 'po_risk',
            severity: 'medium',
            message: `${uncommittedPOs.length} uncommitted POs, oldest is ${daysOld} days old`,
            threshold_value: DEFAULT_THRESHOLDS.po_uncommitted_warning_days,
            actual_value: daysOld,
            created_at: new Date().toISOString()
          })
        }
      }

    } catch (error) {
      console.error('Error checking division rules:', error)
    }

    return alerts
  }

  /**
   * Check all divisions for a project
   */
  async checkProjectDivisionRules(projectId: string): Promise<DivisionAlert[]> {
    const allAlerts: DivisionAlert[] = []

    try {
      // Get all divisions for the project
      const { data: divisions } = await this.supabase
        .from('project_divisions')
        .select('division_id')
        .eq('project_id', projectId)

      if (!divisions) return allAlerts

      // Check each division
      for (const division of divisions) {
        const alerts = await this.checkDivisionRules(projectId, division.division_id)
        allAlerts.push(...alerts)
      }

      // Check for cross-division issues
      const crossDivisionAlerts = await this.checkCrossDivisionRules(projectId, divisions)
      allAlerts.push(...crossDivisionAlerts)

    } catch (error) {
      console.error('Error checking project division rules:', error)
    }

    return allAlerts
  }

  /**
   * Check for issues that span multiple divisions
   */
  private async checkCrossDivisionRules(
    projectId: string, 
    divisions: Array<{ division_id: string }>
  ): Promise<DivisionAlert[]> {
    const alerts: DivisionAlert[] = []

    try {
      // Check for unbalanced workload
      const { data: divisionCosts } = await this.supabase
        .from('division_cost_summary')
        .select('division_id, division_name, total_committed, total_labor_hours')
        .eq('project_id', projectId)
        .in('division_id', divisions.map(d => d.division_id))

      if (divisionCosts && divisionCosts.length > 1) {
        const totalHours = divisionCosts.reduce((sum, d) => sum + (d.total_labor_hours || 0), 0)
        const avgHours = totalHours / divisionCosts.length

        for (const division of divisionCosts) {
          const variance = Math.abs((division.total_labor_hours || 0) - avgHours) / avgHours
          if (variance > 0.5) { // 50% variance from average
            alerts.push({
              id: `${division.division_id}-workload-imbalance`,
              division_id: division.division_id,
              project_id: projectId,
              alert_type: 'schedule_delay',
              severity: 'low',
              message: `${division.division_name} workload varies ${(variance * 100).toFixed(0)}% from project average`,
              actual_value: variance * 100,
              created_at: new Date().toISOString()
            })
          }
        }
      }

      // Check for divisions without recent activity
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      for (const division of divisions) {
        const { data: recentActivity } = await this.supabase
          .from('purchase_orders')
          .select('id')
          .eq('project_id', projectId)
          .eq('division_id', division.division_id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .limit(1)

        if (!recentActivity || recentActivity.length === 0) {
          // Check labor activity too
          const { data: recentLabor } = await this.supabase
            .from('labor_actuals')
            .select('id')
            .eq('project_id', projectId)
            .eq('division_id', division.division_id)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .limit(1)

          if (!recentLabor || recentLabor.length === 0) {
            alerts.push({
              id: `${division.division_id}-no-activity`,
              division_id: division.division_id,
              project_id: projectId,
              alert_type: 'schedule_delay',
              severity: 'medium',
              message: 'No activity in the last 30 days',
              actual_value: 30,
              created_at: new Date().toISOString()
            })
          }
        }
      }

    } catch (error) {
      console.error('Error checking cross-division rules:', error)
    }

    return alerts
  }

  /**
   * Create notification triggers for division alerts
   */
  async createDivisionNotificationTriggers(projectId: string, divisionId: string) {
    const triggers = [
      {
        trigger_type: 'budget_overrun',
        entity_type: 'division',
        entity_id: divisionId,
        threshold_value: DEFAULT_THRESHOLDS.budget_warning_percent,
        threshold_unit: 'percent',
        comparison_operator: '>=',
        notification_frequency: 'daily'
      },
      {
        trigger_type: 'margin_threshold',
        entity_type: 'division',
        entity_id: divisionId,
        threshold_value: DEFAULT_THRESHOLDS.margin_warning_percent,
        threshold_unit: 'percent',
        comparison_operator: '<=',
        notification_frequency: 'daily'
      },
      {
        trigger_type: 'missing_forecast',
        entity_type: 'division',
        entity_id: divisionId,
        threshold_value: DEFAULT_THRESHOLDS.forecast_stale_days,
        threshold_unit: 'days',
        comparison_operator: '>=',
        notification_frequency: 'weekly'
      }
    ]

    try {
      for (const trigger of triggers) {
        await this.supabase
          .from('notification_triggers')
          .upsert(trigger, {
            onConflict: 'trigger_type,entity_type,entity_id'
          })
      }
    } catch (error) {
      console.error('Error creating notification triggers:', error)
    }
  }

  /**
   * Get division performance metrics for reporting
   */
  async getDivisionPerformanceMetrics(projectId: string, divisionId: string) {
    try {
      const { data: summary } = await this.supabase
        .from('division_cost_summary')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .single()

      const { data: budget } = await this.supabase
        .from('division_budgets')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .single()

      const { data: forecasts } = await this.supabase
        .from('division_forecasts')
        .select('*')
        .eq('project_id', projectId)
        .eq('division_id', divisionId)
        .order('forecast_date', { ascending: false })
        .limit(3)

      if (!summary || !budget) return null

      // Calculate metrics
      const budgetUtilization = budget.total_budget > 0 
        ? (summary.total_committed / budget.total_budget) * 100 
        : 0

      const costPerformanceIndex = budget.total_budget > 0
        ? budget.total_budget / (summary.total_committed || 1)
        : 1

      const forecastAccuracy = forecasts && forecasts.length >= 2
        ? this.calculateForecastAccuracy(forecasts)
        : null

      return {
        division_id: divisionId,
        division_name: summary.division_name,
        budget_utilization: budgetUtilization,
        cost_performance_index: costPerformanceIndex,
        total_committed: summary.total_committed,
        total_budget: budget.total_budget,
        budget_variance: summary.budget_variance,
        labor_hours: summary.total_labor_hours,
        forecast_accuracy: forecastAccuracy,
        last_updated: summary.last_updated
      }
    } catch (error) {
      console.error('Error getting division performance metrics:', error)
      return null
    }
  }

  /**
   * Calculate forecast accuracy based on historical forecasts
   */
  private calculateForecastAccuracy(forecasts: Array<{ forecasted_cost: number; actual_cost_at_forecast: number }>): number {
    if (forecasts.length < 2) return 100

    const latestForecast = forecasts[0]
    const previousForecast = forecasts[1]

    const variance = Math.abs(latestForecast.forecasted_cost - previousForecast.forecasted_cost)
    const accuracy = 100 - (variance / previousForecast.forecasted_cost * 100)

    return Math.max(0, Math.min(100, accuracy))
  }
}

// Export singleton instance
export const divisionBusinessRules = new DivisionBusinessRules()