// API Response Types

export interface Division {
  id: string
  name: string
  code: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
  division_id?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  job_number: string
  client_id: string
  division_id: string
  project_manager_id: string
  original_contract: number
  revised_contract: number
  start_date: string
  end_date: string
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
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
  client?: Client
  division?: Division
  project_manager?: User
  created_by_user?: User
  purchase_orders?: PurchaseOrder[] | { count: number }[]
  change_orders?: ChangeOrder[] | { count: number }[]
  labor_forecasts?: LaborForecast[] | { count: number }[]
  financial_snapshots?: FinancialSnapshot[]
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

export interface ChangeOrder {
  id: string
  project_id: string
  co_number: string
  description: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
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

export interface FinancialSnapshot {
  id: string
  project_id: string
  snapshot_date: string
  committed_cost: number
  forecasted_cost: number
  actual_cost: number
  created_at: string
}

// API Request Types
export interface ProjectFormData {
  name: string
  job_number: string
  client_id: string
  division_id: string
  project_manager_id: string
  original_contract: number
  start_date: string
  end_date: string
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  address?: string
  city?: string
  state?: string
  zip_code?: string
  description?: string
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