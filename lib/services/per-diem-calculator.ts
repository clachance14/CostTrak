import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'
import type { PerDiemCost, PerDiemRecalculationResult, PerDiemSummary } from '@/types/per-diem'

export class PerDiemCalculator {
  private supabase: ReturnType<typeof createClient<Database>>

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient
  }

  /**
   * Get per diem summary for a specific project
   */
  async getProjectPerDiemSummary(projectId: string): Promise<PerDiemSummary | null> {
    const { data, error } = await this.supabase
      .from('per_diem_summary')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error) {
      console.error('Error fetching per diem summary:', error)
      return null
    }

    return data as PerDiemSummary
  }

  /**
   * Get all per diem costs for a project
   */
  async getProjectPerDiemCosts(
    projectId: string,
    options?: {
      startDate?: string
      endDate?: string
      employeeId?: string
      employeeType?: 'Direct' | 'Indirect'
    }
  ): Promise<PerDiemCost[]> {
    let query = this.supabase
      .from('per_diem_costs')
      .select(`
        *,
        employee:employees(
          id,
          name,
          employee_id,
          employee_type
        )
      `)
      .eq('project_id', projectId)
      .order('work_date', { ascending: false })

    if (options?.startDate) {
      query = query.gte('work_date', options.startDate)
    }
    if (options?.endDate) {
      query = query.lte('work_date', options.endDate)
    }
    if (options?.employeeId) {
      query = query.eq('employee_id', options.employeeId)
    }
    if (options?.employeeType) {
      query = query.eq('employee_type', options.employeeType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching per diem costs:', error)
      return []
    }

    return data as PerDiemCost[]
  }

  /**
   * Recalculate all per diem costs for a project
   */
  async recalculateProjectPerDiem(projectId: string): Promise<PerDiemRecalculationResult | null> {
    const { data, error } = await this.supabase
      .rpc('recalculate_project_per_diem', { p_project_id: projectId })

    if (error) {
      console.error('Error recalculating per diem:', error)
      return null
    }

    return data as PerDiemRecalculationResult
  }

  /**
   * Get per diem costs by pay period
   */
  async getPerDiemByPayPeriod(
    projectId: string,
    payPeriodEnding: string
  ): Promise<{
    direct: number
    indirect: number
    total: number
    employeeCount: number
    details: PerDiemCost[]
  }> {
    const { data, error } = await this.supabase
      .from('per_diem_costs')
      .select(`
        *,
        employee:employees(
          id,
          name,
          employee_id,
          employee_type
        )
      `)
      .eq('project_id', projectId)
      .eq('pay_period_ending', payPeriodEnding)

    if (error || !data) {
      console.error('Error fetching per diem by pay period:', error)
      return {
        direct: 0,
        indirect: 0,
        total: 0,
        employeeCount: 0,
        details: []
      }
    }

    const costs = data as PerDiemCost[]
    const summary = costs.reduce(
      (acc, cost) => {
        if (cost.employee_type === 'Direct') {
          acc.direct += cost.amount
        } else {
          acc.indirect += cost.amount
        }
        acc.total += cost.amount
        acc.employees.add(cost.employee_id)
        return acc
      },
      { direct: 0, indirect: 0, total: 0, employees: new Set<string>() }
    )

    return {
      direct: summary.direct,
      indirect: summary.indirect,
      total: summary.total,
      employeeCount: summary.employees.size,
      details: costs
    }
  }

  /**
   * Calculate per diem for a specific date range
   */
  async calculatePerDiemForDateRange(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalAmount: number
    directAmount: number
    indirectAmount: number
    daysCount: number
    employeesCount: number
  }> {
    const costs = await this.getProjectPerDiemCosts(projectId, {
      startDate,
      endDate
    })

    const summary = costs.reduce(
      (acc, cost) => {
        acc.totalAmount += cost.amount
        if (cost.employee_type === 'Direct') {
          acc.directAmount += cost.amount
        } else {
          acc.indirectAmount += cost.amount
        }
        acc.dates.add(cost.work_date)
        acc.employees.add(cost.employee_id)
        return acc
      },
      {
        totalAmount: 0,
        directAmount: 0,
        indirectAmount: 0,
        dates: new Set<string>(),
        employees: new Set<string>()
      }
    )

    return {
      totalAmount: summary.totalAmount,
      directAmount: summary.directAmount,
      indirectAmount: summary.indirectAmount,
      daysCount: summary.dates.size,
      employeesCount: summary.employees.size
    }
  }

  /**
   * Validate per diem configuration for a project
   */
  async validateProjectPerDiemConfig(projectId: string): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    // Fetch project configuration
    const { data: project, error } = await this.supabase
      .from('projects')
      .select('per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      errors.push('Failed to fetch project configuration')
      return { isValid: false, errors, warnings }
    }

    if (!project.per_diem_enabled) {
      warnings.push('Per diem is not enabled for this project')
    }

    if (project.per_diem_rate_direct === 0 && project.per_diem_rate_indirect === 0) {
      warnings.push('Both direct and indirect per diem rates are set to zero')
    }

    if (project.per_diem_rate_direct > 500) {
      warnings.push(`Direct per diem rate ($${project.per_diem_rate_direct}) seems unusually high`)
    }

    if (project.per_diem_rate_indirect > 500) {
      warnings.push(`Indirect per diem rate ($${project.per_diem_rate_indirect}) seems unusually high`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get per diem trends for a project (for charts/analytics)
   */
  async getPerDiemTrends(
    projectId: string,
    groupBy: 'week' | 'month' = 'week'
  ): Promise<Array<{
    period: string
    directAmount: number
    indirectAmount: number
    totalAmount: number
    employeeCount: number
  }>> {
    const costs = await this.getProjectPerDiemCosts(projectId)

    // Group costs by period
    const grouped = new Map<string, {
      direct: number
      indirect: number
      total: number
      employees: Set<string>
    }>()

    costs.forEach(cost => {
      const date = new Date(cost.work_date)
      let period: string

      if (groupBy === 'week') {
        // Get week starting Monday
        const monday = new Date(date)
        monday.setDate(date.getDate() - date.getDay() + 1)
        period = monday.toISOString().split('T')[0]
      } else {
        // Group by month
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!grouped.has(period)) {
        grouped.set(period, {
          direct: 0,
          indirect: 0,
          total: 0,
          employees: new Set()
        })
      }

      const group = grouped.get(period)!
      if (cost.employee_type === 'Direct') {
        group.direct += cost.amount
      } else {
        group.indirect += cost.amount
      }
      group.total += cost.amount
      group.employees.add(cost.employee_id)
    })

    // Convert to array and sort
    return Array.from(grouped.entries())
      .map(([period, data]) => ({
        period,
        directAmount: data.direct,
        indirectAmount: data.indirect,
        totalAmount: data.total,
        employeeCount: data.employees.size
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }
}