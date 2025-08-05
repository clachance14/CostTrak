/**
 * Multi-Division Support Type Extensions
 * 
 * These types extend the existing database types to include
 * the new multi-division support tables.
 */

export interface DivisionTables {
  project_divisions: {
    Row: {
      id: string
      project_id: string
      division_id: string
      division_pm_id: string | null
      is_lead_division: boolean
      budget_allocated: number
      created_at: string
      updated_at: string
      created_by: string | null
    }
    Insert: {
      id?: string
      project_id: string
      division_id: string
      division_pm_id?: string | null
      is_lead_division?: boolean
      budget_allocated?: number
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
    Update: {
      id?: string
      project_id?: string
      division_id?: string
      division_pm_id?: string | null
      is_lead_division?: boolean
      budget_allocated?: number
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
  }
  division_budgets: {
    Row: {
      id: string
      project_id: string
      division_id: string
      labor_budget: number
      materials_budget: number
      equipment_budget: number
      subcontracts_budget: number
      other_budget: number
      other_budget_description: string | null
      total_budget: number
      created_at: string
      updated_at: string
      created_by: string | null
    }
    Insert: {
      id?: string
      project_id: string
      division_id: string
      labor_budget?: number
      materials_budget?: number
      equipment_budget?: number
      subcontracts_budget?: number
      other_budget?: number
      other_budget_description?: string | null
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
    Update: {
      id?: string
      project_id?: string
      division_id?: string
      labor_budget?: number
      materials_budget?: number
      equipment_budget?: number
      subcontracts_budget?: number
      other_budget?: number
      other_budget_description?: string | null
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
  }
  division_forecasts: {
    Row: {
      id: string
      project_id: string
      division_id: string
      forecast_date: string
      forecasted_cost: number
      cost_to_complete: number
      percent_complete: number
      notes: string | null
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      project_id: string
      division_id: string
      forecast_date?: string
      forecasted_cost?: number
      cost_to_complete?: number
      percent_complete?: number
      notes?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      project_id?: string
      division_id?: string
      forecast_date?: string
      forecasted_cost?: number
      cost_to_complete?: number
      percent_complete?: number
      notes?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
  }
  division_discipline_mapping: {
    Row: {
      id: string
      division_id: string
      discipline_name: string
      created_at: string
      created_by: string | null
    }
    Insert: {
      id?: string
      division_id: string
      discipline_name: string
      created_at?: string
      created_by?: string | null
    }
    Update: {
      id?: string
      division_id?: string
      discipline_name?: string
      created_at?: string
      created_by?: string | null
    }
  }
  craft_type_divisions: {
    Row: {
      id: string
      craft_type_id: string
      division_id: string
      is_primary: boolean
      created_at: string
      created_by: string | null
    }
    Insert: {
      id?: string
      craft_type_id: string
      division_id: string
      is_primary?: boolean
      created_at?: string
      created_by?: string | null
    }
    Update: {
      id?: string
      craft_type_id?: string
      division_id?: string
      is_primary?: boolean
      created_at?: string
      created_by?: string | null
    }
  }
}

// Extended types for tables that now have division_id
export interface ExtendedPurchaseOrder {
  division_id?: string | null
}

export interface ExtendedChangeOrder {
  division_id?: string | null
}

export interface ExtendedLaborActual {
  division_id?: string | null
}

export interface ExtendedLaborHeadcountForecast {
  division_id?: string | null
}

export interface ExtendedInvoice {
  division_id?: string | null
}

export interface ExtendedLaborEmployeeActual {
  division_id?: string | null
}

// View type
export interface DivisionCostSummary {
  project_id: string
  job_number: string
  project_name: string
  division_id: string
  division_name: string
  division_code: string
  division_budget: number
  total_po_committed: number
  total_po_invoiced: number
  total_labor_cost: number
  total_labor_hours: number
  approved_change_orders: number
  total_committed: number
  budget_variance: number
}