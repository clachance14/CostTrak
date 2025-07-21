/**
 * Database type extensions for multi-division support
 * These types supplement the auto-generated database.generated.ts
 * until we can regenerate the full types from Supabase
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
    Relationships: [
      {
        foreignKeyName: "project_divisions_project_id_fkey"
        columns: ["project_id"]
        isOneToOne: false
        referencedRelation: "projects"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "project_divisions_division_id_fkey"
        columns: ["division_id"]
        isOneToOne: false
        referencedRelation: "divisions"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "project_divisions_division_pm_id_fkey"
        columns: ["division_pm_id"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      }
    ]
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
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "division_budgets_project_id_fkey"
        columns: ["project_id"]
        isOneToOne: false
        referencedRelation: "projects"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "division_budgets_division_id_fkey"
        columns: ["division_id"]
        isOneToOne: false
        referencedRelation: "divisions"
        referencedColumns: ["id"]
      }
    ]
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
      actual_cost_at_forecast: number | null
      created_at: string
      updated_at: string
      created_by: string | null
    }
    Insert: {
      id?: string
      project_id: string
      division_id: string
      forecast_date: string
      forecasted_cost: number
      cost_to_complete: number
      percent_complete: number
      notes?: string | null
      actual_cost_at_forecast?: number | null
      created_at?: string
      updated_at?: string
      created_by?: string | null
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
      actual_cost_at_forecast?: number | null
      created_at?: string
      updated_at?: string
      created_by?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "division_forecasts_project_id_fkey"
        columns: ["project_id"]
        isOneToOne: false
        referencedRelation: "projects"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "division_forecasts_division_id_fkey"
        columns: ["division_id"]
        isOneToOne: false
        referencedRelation: "divisions"
        referencedColumns: ["id"]
      }
    ]
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
    Relationships: [
      {
        foreignKeyName: "division_discipline_mapping_division_id_fkey"
        columns: ["division_id"]
        isOneToOne: false
        referencedRelation: "divisions"
        referencedColumns: ["id"]
      }
    ]
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
    Relationships: [
      {
        foreignKeyName: "craft_type_divisions_craft_type_id_fkey"
        columns: ["craft_type_id"]
        isOneToOne: false
        referencedRelation: "craft_types"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "craft_type_divisions_division_id_fkey"
        columns: ["division_id"]
        isOneToOne: false
        referencedRelation: "divisions"
        referencedColumns: ["id"]
      }
    ]
  }
  notification_triggers: {
    Row: {
      id: string
      trigger_type: string
      entity_type: string
      entity_id: string
      threshold_value: number
      threshold_unit: string
      comparison_operator: string
      notification_frequency: string
      last_triggered_at: string | null
      is_active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      trigger_type: string
      entity_type: string
      entity_id: string
      threshold_value: number
      threshold_unit: string
      comparison_operator: string
      notification_frequency: string
      last_triggered_at?: string | null
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      trigger_type?: string
      entity_type?: string
      entity_id?: string
      threshold_value?: number
      threshold_unit?: string
      comparison_operator?: string
      notification_frequency?: string
      last_triggered_at?: string | null
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
}

export interface DivisionViews {
  division_cost_summary: {
    Row: {
      project_id: string | null
      division_id: string | null
      division_name: string | null
      division_code: string | null
      total_po_committed: number | null
      total_po_invoiced: number | null
      total_labor_cost: number | null
      total_labor_hours: number | null
      approved_change_orders: number | null
      total_committed: number | null
      budget_variance: number | null
      last_updated: string | null
    }
    Relationships: []
  }
}

// Updated types for existing tables with division_id
export interface UpdatedTableColumns {
  purchase_orders: {
    division_id: string | null
  }
  change_orders: {
    division_id: string | null
  }
  labor_actuals: {
    division_id: string | null
  }
  labor_headcount_forecasts: {
    division_id: string | null
  }
  invoices: {
    division_id: string | null
  }
  labor_employee_actuals: {
    division_id: string | null
  }
}

// Helper types for API responses
export interface ProjectWithDivisions {
  id: string
  name: string
  job_number: string
  divisions?: Array<{
    division_id: string
    division_name: string
    division_code: string
    is_lead_division: boolean
    division_pm_id: string | null
    division_pm_name?: string
    budget_allocated: number
  }>
}

export interface DivisionBudgetSummary {
  division_id: string
  division_name: string
  labor_budget: number
  materials_budget: number
  equipment_budget: number
  subcontracts_budget: number
  other_budget: number
  total_budget: number
  total_committed?: number
  budget_variance?: number
  percent_complete?: number
}