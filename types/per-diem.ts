// Per Diem Type Extensions
// These types extend the database schema for per diem functionality

export interface PerDiemCost {
  id: string
  project_id: string
  employee_id: string
  work_date: string
  employee_type: 'Direct' | 'Indirect'
  rate_applied: number
  days_worked: number
  amount: number
  labor_actual_id?: string | null
  pay_period_ending?: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithPerDiem {
  per_diem_enabled: boolean
  per_diem_rate_direct: number
  per_diem_rate_indirect: number
}

export interface PerDiemSummary {
  project_id: string
  project_name: string
  project_number: string
  per_diem_enabled: boolean
  per_diem_rate_direct: number
  per_diem_rate_indirect: number
  unique_employees: number
  days_with_per_diem: number
  total_direct_per_diem: number
  total_indirect_per_diem: number
  total_per_diem_amount: number
  last_per_diem_date?: string | null
  first_per_diem_date?: string | null
}

export interface PerDiemRecalculationResult {
  project_id: string
  records_processed: number
  total_per_diem_amount: number
  recalculated_at: string
}