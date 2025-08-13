// API Response Types

// Removed Division and Client interfaces as part of simplification

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'project_manager'
  created_at: string
  updated_at: string
}

export interface ClientPOLineItem {
  id: string
  project_id: string
  line_number: number
  description: string
  amount: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface Project {
  id: string
  name: string
  job_number: string
  project_manager_id: string
  original_contract: number
  revised_contract: number
  base_margin_percentage?: number
  start_date: string
  end_date: string
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  address?: string
  city?: string
  state?: string
  zip_code?: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at?: string
  // Relations
  project_manager?: User
  created_by_user?: User
  purchase_orders?: PurchaseOrder[] | { count: number }[]
  labor_forecasts?: LaborForecast[] | { count: number }[]
  client_po_line_items?: ClientPOLineItem[]
}

export interface PurchaseOrder {
  id: string
  project_id: string
  po_number: string
  vendor_name: string
  description: string
  amount: number
  status: 'draft' | 'approved' | 'cancelled'
  created_at: string
  created_by: string
  approved_by?: string
  approved_at?: string
}


export interface LaborForecast {
  id: string
  project_id: string
  week_ending: string
  craft_type_id: string
  forecasted_hours: number
  forecasted_rate: number
  forecasted_cost: number
  actual_hours?: number
  actual_cost?: number
  created_at: string
  created_by: string
}


// API Request Types
export interface ProjectFormData {
  name: string
  job_number: string
  project_manager_id: string
  original_contract: number
  start_date: string
  end_date: string
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  address?: string
  city?: string
  state?: string
  zip_code?: string
  description?: string
  // New fields for enhanced project creation
  superintendent_id?: string
  budget?: ProjectBudget
  client_po_line_items?: Array<{
    line_number: number
    description: string
    amount: number
  }>
}

export interface ProjectBudget {
  labor_budget: number
  small_tools_consumables_budget: number
  materials_budget: number
  equipment_budget: number
  subcontracts_budget: number
  other_budget: number
  other_budget_description?: string
  notes?: string
}


// API Response Types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}