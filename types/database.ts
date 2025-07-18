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
          status: 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date: string
          end_date: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          cost_to_complete_notes: string | null
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
          status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date: string
          end_date?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          cost_to_complete_notes?: string | null
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
          status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
          start_date?: string
          end_date?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          cost_to_complete_notes?: string | null
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
      financial_snapshots: {
        Row: {
          id: string
          snapshot_type: 'project' | 'division' | 'company'
          project_id: string | null
          division_id: string | null
          snapshot_date: string
          original_contract: number
          approved_change_orders: number
          revised_contract: number
          total_po_committed: number
          total_labor_cost: number
          total_other_cost: number
          total_committed: number
          forecasted_cost: number
          forecasted_profit: number
          profit_margin: number
          cost_to_complete: number
          percent_complete: number
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          snapshot_type: 'project' | 'division' | 'company'
          project_id?: string | null
          division_id?: string | null
          snapshot_date: string
          original_contract?: number
          approved_change_orders?: number
          revised_contract?: number
          total_po_committed?: number
          total_labor_cost?: number
          total_other_cost?: number
          total_committed?: number
          forecasted_cost?: number
          forecasted_profit?: number
          profit_margin?: number
          cost_to_complete?: number
          percent_complete?: number
          metadata?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          snapshot_type?: 'project' | 'division' | 'company'
          project_id?: string | null
          division_id?: string | null
          snapshot_date?: string
          original_contract?: number
          approved_change_orders?: number
          revised_contract?: number
          total_po_committed?: number
          total_labor_cost?: number
          total_other_cost?: number
          total_committed?: number
          forecasted_cost?: number
          forecasted_profit?: number
          profit_margin?: number
          cost_to_complete?: number
          percent_complete?: number
          metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          name: string
          description: string | null
          file_path: string
          file_size: number
          mime_type: string
          entity_type: string
          entity_id: string
          category: string
          uploaded_by: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          file_path: string
          file_size: number
          mime_type: string
          entity_type: string
          entity_id: string
          category: string
          uploaded_by: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          file_path?: string
          file_size?: number
          mime_type?: string
          entity_type?: string
          entity_id?: string
          category?: string
          uploaded_by?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      purchase_orders: {
        Row: {
          id: string
          project_id: string
          po_number: string
          vendor_name: string
          description: string | null
          status: string
          total_amount: number
          committed_amount: number
          invoiced_amount: number
          invoice_percentage: number
          forecast_amount: number
          forecasted_overrun: number
          risk_status: 'normal' | 'at-risk' | 'over-budget'
          cost_center: string | null
          budget_category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          po_number: string
          vendor_name: string
          description?: string | null
          status?: string
          total_amount?: number
          committed_amount?: number
          invoiced_amount?: number
          invoice_percentage?: number
          forecast_amount?: number
          risk_status?: 'normal' | 'at-risk' | 'over-budget'
          cost_center?: string | null
          budget_category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          po_number?: string
          vendor_name?: string
          description?: string | null
          status?: string
          total_amount?: number
          committed_amount?: number
          invoiced_amount?: number
          invoice_percentage?: number
          forecast_amount?: number
          risk_status?: 'normal' | 'at-risk' | 'over-budget'
          cost_center?: string | null
          budget_category?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      change_orders: {
        Row: {
          id: string
          project_id: string
          co_number: string
          description: string
          amount: number
          status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          pricing_type: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          impact_schedule_days: number
          reason: string | null
          manhours: number | null
          labor_amount: number | null
          equipment_amount: number | null
          material_amount: number | null
          subcontract_amount: number | null
          markup_amount: number | null
          tax_amount: number | null
          submitted_date: string | null
          approved_date: string | null
          approved_by: string | null
          rejection_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          co_number: string
          description: string
          amount: number
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          pricing_type: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          impact_schedule_days?: number
          reason?: string | null
          manhours?: number | null
          labor_amount?: number | null
          equipment_amount?: number | null
          material_amount?: number | null
          subcontract_amount?: number | null
          markup_amount?: number | null
          tax_amount?: number | null
          submitted_date?: string | null
          approved_date?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          co_number?: string
          description?: string
          amount?: number
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          pricing_type?: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          impact_schedule_days?: number
          reason?: string | null
          manhours?: number | null
          labor_amount?: number | null
          equipment_amount?: number | null
          material_amount?: number | null
          subcontract_amount?: number | null
          markup_amount?: number | null
          tax_amount?: number | null
          submitted_date?: string | null
          approved_date?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      co_attachments: {
        Row: {
          id: string
          change_order_id: string
          file_url: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          change_order_id: string
          file_url: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          change_order_id?: string
          file_url?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
        }
      }
      labor_actuals: {
        Row: {
          id: string
          project_id: string
          week_ending: string
          craft_type_id: string
          total_hours: number
          total_cost: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week_ending: string
          craft_type_id: string
          total_hours: number
          total_cost: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week_ending?: string
          craft_type_id?: string
          total_hours?: number
          total_cost?: number
          created_at?: string
          updated_at?: string
        }
      }
      labor_headcount_forecasts: {
        Row: {
          id: string
          project_id: string
          week_starting: string
          craft_type_id: string
          headcount: number
          weekly_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week_starting: string
          craft_type_id: string
          headcount: number
          weekly_hours: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week_starting?: string
          craft_type_id?: string
          headcount?: number
          weekly_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      labor_running_averages: {
        Row: {
          id: string
          project_id: string
          craft_type_id: string
          avg_rate: number
          total_hours: number
          total_cost: number
          week_count: number
          last_updated: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          craft_type_id: string
          avg_rate: number
          total_hours: number
          total_cost: number
          week_count: number
          last_updated: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          craft_type_id?: string
          avg_rate?: number
          total_hours?: number
          total_cost?: number
          week_count?: number
          last_updated?: string
          created_at?: string
          updated_at?: string
        }
      }
      craft_types: {
        Row: {
          id: string
          name: string
          code: string
          category: 'direct' | 'indirect' | 'staff'
          default_rate?: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          category: 'direct' | 'indirect' | 'staff'
          default_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          category?: 'direct' | 'indirect' | 'staff'
          default_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: string
          changes: any
          performed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          action: string
          changes?: any
          performed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          changes?: any
          performed_by?: string
          created_at?: string
        }
      }
      user_2fa_settings: {
        Row: {
          id: string
          user_id: string
          secret: string
          backup_codes: string[] | null
          enabled: boolean
          enabled_at: string | null
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          secret: string
          backup_codes?: string[] | null
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          secret?: string
          backup_codes?: string[] | null
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      po_forecast_history: {
        Row: {
          id: string
          purchase_order_id: string
          changed_by: string
          change_date: string
          field_name: string
          old_value: string | null
          new_value: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          changed_by: string
          change_date?: string
          field_name: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          changed_by?: string
          change_date?: string
          field_name?: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          created_at?: string
        }
      }
      project_budget_breakdowns: {
        Row: {
          id: string
          project_id: string
          discipline: string
          cost_type: string
          manhours: number | null
          value: number
          description: string | null
          import_source: string
          import_batch_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          discipline: string
          cost_type: string
          manhours?: number | null
          value?: number
          description?: string | null
          import_source?: string
          import_batch_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          discipline?: string
          cost_type?: string
          manhours?: number | null
          value?: number
          description?: string | null
          import_source?: string
          import_batch_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_assignments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'primary_pm' | 'delegate_pm' | 'viewer'
          permissions: Record<string, any>
          assigned_by: string
          assigned_at: string
          expires_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: 'primary_pm' | 'delegate_pm' | 'viewer'
          permissions?: Record<string, any>
          assigned_by: string
          assigned_at?: string
          expires_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'primary_pm' | 'delegate_pm' | 'viewer'
          permissions?: Record<string, any>
          assigned_by?: string
          assigned_at?: string
          expires_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          employee_number: string
          first_name: string
          last_name: string
          payroll_name?: string | null
          legal_middle_name?: string | null
          craft_type_id: string
          base_rate: number
          category: 'Direct' | 'Indirect' | 'Staff'
          class?: string | null
          job_title_description?: string | null
          location_code?: string | null
          location_description?: string | null
          is_direct: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_number: string
          first_name: string
          last_name: string
          payroll_name?: string | null
          legal_middle_name?: string | null
          craft_type_id: string
          base_rate: number
          category: 'Direct' | 'Indirect' | 'Staff'
          class?: string | null
          job_title_description?: string | null
          location_code?: string | null
          location_description?: string | null
          is_direct?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_number?: string
          first_name?: string
          last_name?: string
          payroll_name?: string | null
          legal_middle_name?: string | null
          craft_type_id?: string
          base_rate?: number
          category?: 'Direct' | 'Indirect' | 'Staff'
          class?: string | null
          job_title_description?: string | null
          location_code?: string | null
          location_description?: string | null
          is_direct?: boolean
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
      user_has_project_permission: {
        Args: {
          p_project_id: string
          p_permission: string
        }
        Returns: boolean
      }
      create_notification: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type: string
          p_priority?: string
          p_related_entity_type?: string
          p_related_entity_id?: string
          p_action_url?: string
          p_expires_at?: string
          p_metadata?: any
        }
        Returns: string
      }
    }
    Enums: {
      user_role: 'controller' | 'executive' | 'ops_manager' | 'project_manager' | 'accounting' | 'viewer'
      project_status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
      change_order_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
      pricing_type: 'LS' | 'T&M' | 'Estimate' | 'Credit'
      notification_type: 'system' | 'project' | 'change_order' | 'purchase_order' | 'labor' | 'financial' | 'document' | 'user'
      risk_status: 'normal' | 'at-risk' | 'over-budget'
      assignment_role: 'primary_pm' | 'delegate_pm' | 'viewer'
    }
    CompositeTypes: {}
  }
}