// User roles in the system
export type UserRole = 
  | 'controller'
  | 'executive'
  | 'ops_manager'
  | 'project_manager'
  | 'accounting'
  | 'viewer'

// Base entity types (will be expanded with database types)
export interface User {
  id: string
  email: string
  role: UserRole
  first_name: string
  last_name: string
  division_id?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  job_number: string
  division_id: string
  project_manager_id?: string
  status: 'planning' | 'active' | 'completed' | 'on_hold'
  original_contract: number
  revised_contract?: number
  start_date: string
  end_date?: string
  created_at: string
  updated_at: string
}

export interface Division {
  id: string
  name: string
  code: string
  created_at: string
  updated_at: string
}