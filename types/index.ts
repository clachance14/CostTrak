// User roles in the system - simplified to single role
export type UserRole = 'project_manager'

// Base entity types (will be expanded with database types)
export interface User {
  id: string
  email: string
  role: UserRole
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  job_number: string
  project_manager_id?: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  original_contract: number
  revised_contract?: number
  start_date: string
  end_date?: string
  created_at: string
  updated_at: string
}