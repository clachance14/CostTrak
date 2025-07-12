// This file will be auto-generated from Supabase schema
// For now, we'll define the essential types manually

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          role: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
          division_id: string | null
          is_active: boolean
          phone: string | null
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name: string
          role: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
          division_id?: string | null
          is_active?: boolean
          phone?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
          division_id?: string | null
          is_active?: boolean
          phone?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          job_number: string
          name: string
          division_id: string
          client_id: string | null
          project_manager_id: string | null
          original_contract: number
          revised_contract: number
          status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date: string
          end_date: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          job_number: string
          name: string
          division_id: string
          client_id?: string | null
          project_manager_id?: string | null
          original_contract?: number
          revised_contract?: number
          status?: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date: string
          end_date?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          job_number?: string
          name?: string
          division_id?: string
          client_id?: string | null
          project_manager_id?: string | null
          original_contract?: number
          revised_contract?: number
          status?: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date?: string
          end_date?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
      }
      divisions: {
        Row: {
          id: string
          name: string
          code: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {
      get_current_user_role: {
        Args: {}
        Returns: string | null
      }
      user_has_project_access: {
        Args: {
          project_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
      project_status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
    }
  }
}