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
          role: 'project_manager'
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
          labor_direct_budget: number
          labor_indirect_budget: number
          labor_staff_budget: number
          materials_budget: number
          equipment_budget: number
          subcontracts_budget: number
          small_tools_budget: number
          total_labor_budget: number
          total_non_labor_budget: number
          total_budget: number
          budget_imported_at: string | null
          budget_imported_by: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          job_number: string
          name: string
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
          labor_direct_budget?: number
          labor_indirect_budget?: number
          labor_staff_budget?: number
          materials_budget?: number
          equipment_budget?: number
          subcontracts_budget?: number
          small_tools_budget?: number
          total_labor_budget?: number
          total_non_labor_budget?: number
          total_budget?: number
          budget_imported_at?: string | null
          budget_imported_by?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          job_number?: string
          name?: string
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
          labor_direct_budget?: number
          labor_indirect_budget?: number
          labor_staff_budget?: number
          materials_budget?: number
          equipment_budget?: number
          subcontracts_budget?: number
          small_tools_budget?: number
          total_labor_budget?: number
          total_non_labor_budget?: number
          total_budget?: number
          budget_imported_at?: string | null
          budget_imported_by?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
      }
      // divisions table removed in simplification
      // financial_snapshots table removed in simplification
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
      client_po_line_items: {
        Row: {
          id: string
          project_id: string
          line_number: number
          description: string
          amount: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          line_number: number
          description: string
          amount: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          line_number?: number
          description?: string
          amount?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      change_orders: {
        Row: {
          id: string
          project_id: string
          co_number: string
          description: string
          pricing_type: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          amount: number
          status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          notes: string | null
          client_approval_date: string | null
          created_by: string
          approved_by: string | null
          approved_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          co_number: string
          description: string
          pricing_type?: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          amount?: number
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          notes?: string | null
          client_approval_date?: string | null
          created_by: string
          approved_by?: string | null
          approved_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          co_number?: string
          description?: string
          pricing_type?: 'LS' | 'T&M' | 'Estimate' | 'Credit'
          amount?: number
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
          notes?: string | null
          client_approval_date?: string | null
          created_by?: string
          approved_by?: string | null
          approved_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      labor_actuals: {
        Row: {
          id: string
          project_id: string
          week_ending: string
          craft_type_id: string
          actual_hours: number
          actual_cost: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week_ending: string
          craft_type_id: string
          actual_hours: number
          actual_cost: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week_ending?: string
          craft_type_id?: string
          actual_hours?: number
          actual_cost?: number
          created_at?: string
          updated_at?: string
        }
      }
      labor_headcount_forecasts: {
        Row: {
          id: string
          project_id: string
          week_ending: string
          craft_type_id: string
          headcount: number
          avg_weekly_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week_ending: string
          craft_type_id: string
          headcount: number
          avg_weekly_hours: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week_ending?: string
          craft_type_id?: string
          headcount?: number
          avg_weekly_hours?: number
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
      // user_2fa_settings table removed in simplification
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
      budget_line_items: {
        Row: {
          id: string
          project_id: string
          source_sheet: string
          source_row: number | null
          import_batch_id: string
          wbs_code: string | null
          discipline: string | null
          category: 'LABOR' | 'NON_LABOR'
          subcategory: string | null
          line_number: string | null
          description: string
          quantity: number | null
          unit_of_measure: string | null
          unit_rate: number | null
          manhours: number | null
          crew_size: number | null
          duration_days: number | null
          labor_direct_cost: number
          labor_indirect_cost: number
          labor_staff_cost: number
          materials_cost: number
          equipment_cost: number
          subcontracts_cost: number
          small_tools_cost: number
          total_cost: number
          notes: string | null
          contractor_name: string | null
          supplier_name: string | null
          owned_or_rented: 'OWNED' | 'RENTED' | null
          created_at: string
          updated_at: string
          cost_type: string | null
          phase: string | null
          labor_category: string | null
          is_add_on: boolean | null
          discipline_group: string | null
        }
        Insert: {
          id?: string
          project_id: string
          source_sheet: string
          source_row?: number | null
          import_batch_id: string
          wbs_code?: string | null
          discipline?: string | null
          category: 'LABOR' | 'NON_LABOR'
          subcategory?: string | null
          line_number?: string | null
          description: string
          quantity?: number | null
          unit_of_measure?: string | null
          unit_rate?: number | null
          manhours?: number | null
          crew_size?: number | null
          duration_days?: number | null
          labor_direct_cost?: number
          labor_indirect_cost?: number
          labor_staff_cost?: number
          materials_cost?: number
          equipment_cost?: number
          subcontracts_cost?: number
          small_tools_cost?: number
          total_cost: number
          notes?: string | null
          contractor_name?: string | null
          supplier_name?: string | null
          owned_or_rented?: 'OWNED' | 'RENTED' | null
          created_at?: string
          updated_at?: string
          cost_type?: string | null
          phase?: string | null
          labor_category?: string | null
          is_add_on?: boolean | null
          discipline_group?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          source_sheet?: string
          source_row?: number | null
          import_batch_id?: string
          wbs_code?: string | null
          discipline?: string | null
          category?: 'LABOR' | 'NON_LABOR'
          subcategory?: string | null
          line_number?: string | null
          description?: string
          quantity?: number | null
          unit_of_measure?: string | null
          unit_rate?: number | null
          manhours?: number | null
          crew_size?: number | null
          duration_days?: number | null
          labor_direct_cost?: number
          labor_indirect_cost?: number
          labor_staff_cost?: number
          materials_cost?: number
          equipment_cost?: number
          subcontracts_cost?: number
          small_tools_cost?: number
          total_cost?: number
          notes?: string | null
          contractor_name?: string | null
          supplier_name?: string | null
          owned_or_rented?: 'OWNED' | 'RENTED' | null
          created_at?: string
          updated_at?: string
          cost_type?: string | null
          phase?: string | null
          labor_category?: string | null
          is_add_on?: boolean | null
          discipline_group?: string | null
        }
      }
      wbs_structure: {
        Row: {
          id: string
          code: string
          category: 'LABOR' | 'NON_LABOR'
          description: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          category: 'LABOR' | 'NON_LABOR'
          description: string
          sort_order: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          category?: 'LABOR' | 'NON_LABOR'
          description?: string
          sort_order?: number
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
      user_role: 'project_manager'
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