export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          amount: number
          approved_by: string | null
          approved_date: string | null
          co_number: string
          created_at: string
          created_by: string | null
          description: string
          equipment_amount: number | null
          id: string
          impact_schedule_days: number | null
          labor_amount: number | null
          manhours: number | null
          markup_amount: number | null
          material_amount: number | null
          pricing_type: string
          project_id: string
          reason: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["change_order_status"] | null
          subcontract_amount: number | null
          submitted_date: string | null
          tax_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          approved_date?: string | null
          co_number: string
          created_at?: string
          created_by?: string | null
          description: string
          equipment_amount?: number | null
          id?: string
          impact_schedule_days?: number | null
          labor_amount?: number | null
          manhours?: number | null
          markup_amount?: number | null
          material_amount?: number | null
          pricing_type: string
          project_id: string
          reason?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["change_order_status"] | null
          subcontract_amount?: number | null
          submitted_date?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          approved_date?: string | null
          co_number?: string
          created_at?: string
          created_by?: string | null
          description?: string
          equipment_amount?: number | null
          id?: string
          impact_schedule_days?: number | null
          labor_amount?: number | null
          manhours?: number | null
          markup_amount?: number | null
          material_amount?: number | null
          pricing_type?: string
          project_id?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["change_order_status"] | null
          subcontract_amount?: number | null
          submitted_date?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      co_attachments: {
        Row: {
          change_order_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          change_order_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          change_order_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "co_attachments_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string
          description: string
          discipline: string
          id: string
          is_active: boolean | null
          parent_code_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          description: string
          discipline: string
          id?: string
          is_active?: boolean | null
          parent_code_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          description?: string
          discipline?: string
          id?: string
          is_active?: boolean | null
          parent_code_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_parent_code_id_fkey"
            columns: ["parent_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      craft_types: {
        Row: {
          billing_rate: number | null
          category: string
          code: string
          created_at: string
          default_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          billing_rate?: number | null
          category: string
          code: string
          created_at?: string
          default_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          billing_rate?: number | null
          category?: string
          code?: string
          created_at?: string
          default_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_imports: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          file_hash: string | null
          file_name: string | null
          id: string
          import_status: string
          import_type: string
          imported_at: string
          imported_by: string
          metadata: Json | null
          project_id: string
          records_failed: number | null
          records_processed: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          import_status: string
          import_type: string
          imported_at?: string
          imported_by: string
          metadata?: Json | null
          project_id: string
          records_failed?: number | null
          records_processed?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          import_status?: string
          import_type?: string
          imported_at?: string
          imported_by?: string
          metadata?: Json | null
          project_id?: string
          records_failed?: number | null
          records_processed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          base_rate: number
          category: string
          class: string | null
          craft_type_id: string
          created_at: string
          employee_number: string
          first_name: string
          id: string
          is_active: boolean
          is_direct: boolean
          job_title_description: string | null
          last_name: string
          legal_middle_name: string | null
          location_code: string | null
          location_description: string | null
          payroll_name: string | null
          updated_at: string
        }
        Insert: {
          base_rate: number
          category: string
          class?: string | null
          craft_type_id: string
          created_at?: string
          employee_number: string
          first_name: string
          id?: string
          is_active?: boolean
          is_direct?: boolean
          job_title_description?: string | null
          last_name: string
          legal_middle_name?: string | null
          location_code?: string | null
          location_description?: string | null
          payroll_name?: string | null
          updated_at?: string
        }
        Update: {
          base_rate?: number
          category?: string
          class?: string | null
          craft_type_id?: string
          created_at?: string
          employee_number?: string
          first_name?: string
          id?: string
          is_active?: boolean
          is_direct?: boolean
          job_title_description?: string | null
          last_name?: string
          legal_middle_name?: string | null
          location_code?: string | null
          location_description?: string | null
          payroll_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_craft_type_id_fkey"
            columns: ["craft_type_id"]
            isOneToOne: false
            referencedRelation: "craft_types"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_snapshots: {
        Row: {
          approved_change_orders: number | null
          cost_to_complete: number | null
          created_at: string
          division_id: string | null
          forecasted_cost: number | null
          forecasted_profit: number | null
          id: string
          metadata: Json | null
          original_contract: number | null
          percent_complete: number | null
          profit_margin: number | null
          project_id: string | null
          revised_contract: number | null
          snapshot_date: string
          snapshot_type: string
          total_committed: number | null
          total_labor_cost: number | null
          total_other_cost: number | null
          total_po_committed: number | null
        }
        Insert: {
          approved_change_orders?: number | null
          cost_to_complete?: number | null
          created_at?: string
          division_id?: string | null
          forecasted_cost?: number | null
          forecasted_profit?: number | null
          id?: string
          metadata?: Json | null
          original_contract?: number | null
          percent_complete?: number | null
          profit_margin?: number | null
          project_id?: string | null
          revised_contract?: number | null
          snapshot_date: string
          snapshot_type: string
          total_committed?: number | null
          total_labor_cost?: number | null
          total_other_cost?: number | null
          total_po_committed?: number | null
        }
        Update: {
          approved_change_orders?: number | null
          cost_to_complete?: number | null
          created_at?: string
          division_id?: string | null
          forecasted_cost?: number | null
          forecasted_profit?: number | null
          id?: string
          metadata?: Json | null
          original_contract?: number | null
          percent_complete?: number | null
          profit_margin?: number | null
          project_id?: string | null
          revised_contract?: number | null
          snapshot_date?: string
          snapshot_type?: string
          total_committed?: number | null
          total_labor_cost?: number | null
          total_other_cost?: number | null
          total_po_committed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_date: string | null
          payment_terms: string | null
          project_id: string
          purchase_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          payment_date?: string | null
          payment_terms?: string | null
          project_id: string
          purchase_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_date?: string | null
          payment_terms?: string | null
          project_id?: string
          purchase_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_actuals: {
        Row: {
          actual_cost: number
          actual_cost_with_burden: number | null
          actual_hours: number
          burden_amount: number | null
          burden_rate: number | null
          cost_code_id: string | null
          craft_type_id: string
          created_at: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          week_ending: string
        }
        Insert: {
          actual_cost?: number
          actual_cost_with_burden?: number | null
          actual_hours?: number
          burden_amount?: number | null
          burden_rate?: number | null
          cost_code_id?: string | null
          craft_type_id: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          week_ending: string
        }
        Update: {
          actual_cost?: number
          actual_cost_with_burden?: number | null
          actual_hours?: number
          burden_amount?: number | null
          burden_rate?: number | null
          cost_code_id?: string | null
          craft_type_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_actuals_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_actuals_craft_type_id_fkey"
            columns: ["craft_type_id"]
            isOneToOne: false
            referencedRelation: "craft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_employee_actuals: {
        Row: {
          burden_rate: number | null
          created_at: string
          daily_hours: Json | null
          employee_id: string
          id: string
          ot_hours: number
          ot_wages: number
          project_id: string
          st_burden_amount: number | null
          st_hours: number
          st_wages: number
          st_wages_with_burden: number | null
          total_burden_amount: number | null
          total_cost: number | null
          total_cost_with_burden: number | null
          total_hours: number | null
          updated_at: string
          week_ending: string
        }
        Insert: {
          burden_rate?: number | null
          created_at?: string
          daily_hours?: Json | null
          employee_id: string
          id?: string
          ot_hours?: number
          ot_wages?: number
          project_id: string
          st_burden_amount?: number | null
          st_hours?: number
          st_wages?: number
          st_wages_with_burden?: number | null
          total_burden_amount?: number | null
          total_cost?: number | null
          total_cost_with_burden?: number | null
          total_hours?: number | null
          updated_at?: string
          week_ending: string
        }
        Update: {
          burden_rate?: number | null
          created_at?: string
          daily_hours?: Json | null
          employee_id?: string
          id?: string
          ot_hours?: number
          ot_wages?: number
          project_id?: string
          st_burden_amount?: number | null
          st_hours?: number
          st_wages?: number
          st_wages_with_burden?: number | null
          total_burden_amount?: number | null
          total_cost?: number | null
          total_cost_with_burden?: number | null
          total_hours?: number | null
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_employee_actuals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_employee_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_employee_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_headcount_forecasts: {
        Row: {
          avg_weekly_hours: number
          craft_type_id: string
          created_at: string
          headcount: number
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          week_starting: string
        }
        Insert: {
          avg_weekly_hours?: number
          craft_type_id: string
          created_at?: string
          headcount: number
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          week_starting: string
        }
        Update: {
          avg_weekly_hours?: number
          craft_type_id?: string
          created_at?: string
          headcount?: number
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_headcount_forecasts_craft_type_id_fkey"
            columns: ["craft_type_id"]
            isOneToOne: false
            referencedRelation: "craft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_headcount_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_headcount_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_running_averages: {
        Row: {
          avg_cost: number
          avg_hours: number
          avg_rate: number | null
          craft_type_id: string
          created_at: string
          id: string
          last_updated: string
          project_id: string
          updated_at: string
          week_count: number
        }
        Insert: {
          avg_cost?: number
          avg_hours?: number
          avg_rate?: number | null
          craft_type_id: string
          created_at?: string
          id?: string
          last_updated: string
          project_id: string
          updated_at?: string
          week_count?: number
        }
        Update: {
          avg_cost?: number
          avg_hours?: number
          avg_rate?: number | null
          craft_type_id?: string
          created_at?: string
          id?: string
          last_updated?: string
          project_id?: string
          updated_at?: string
          week_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "labor_running_averages_craft_type_id_fkey"
            columns: ["craft_type_id"]
            isOneToOne: false
            referencedRelation: "craft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_running_averages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_running_averages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_forecasts: {
        Row: {
          created_at: string | null
          current_month_revenue: number
          id: string
          next_month_revenue: number
          notes: string | null
          percent_complete: number
          plus_two_month_revenue: number
          project_id: string
          remaining_backlog: number
          reporting_month: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          current_month_revenue?: number
          id?: string
          next_month_revenue?: number
          notes?: string | null
          percent_complete?: number
          plus_two_month_revenue?: number
          project_id: string
          remaining_backlog?: number
          reporting_month: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          current_month_revenue?: number
          id?: string
          next_month_revenue?: number
          notes?: string | null
          percent_complete?: number
          plus_two_month_revenue?: number
          project_id?: string
          remaining_backlog?: number
          reporting_month?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_triggers: {
        Row: {
          comparison_operator: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          notification_frequency: string | null
          threshold_unit: string | null
          threshold_value: number | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          comparison_operator?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_frequency?: string | null
          threshold_unit?: string | null
          threshold_value?: number | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          comparison_operator?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_frequency?: string | null
          threshold_unit?: string | null
          threshold_value?: number | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_triggers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      po_forecast_history: {
        Row: {
          forecasted_final_cost: number
          id: string
          notes: string | null
          purchase_order_id: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          forecasted_final_cost: number
          id?: string
          notes?: string | null
          purchase_order_id: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          forecasted_final_cost?: number
          id?: string
          notes?: string | null
          purchase_order_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_forecast_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_forecast_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          amount: number | null
          category: string | null
          contract_extra_type: string | null
          created_at: string
          description: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_ticket: string | null
          line_number: number
          material_description: string | null
          notes: string | null
          purchase_order_id: string
          quantity: number | null
          total_amount: number
          unit_of_measure: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          contract_extra_type?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_ticket?: string | null
          line_number: number
          material_description?: string | null
          notes?: string | null
          purchase_order_id: string
          quantity?: number | null
          total_amount: number
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          contract_extra_type?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_ticket?: string | null
          line_number?: number
          material_description?: string | null
          notes?: string | null
          purchase_order_id?: string
          quantity?: number | null
          total_amount?: number
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          division_id: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          email: string
          first_name: string
          id: string
          is_active?: boolean | null
          last_name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_breakdowns: {
        Row: {
          cost_code_id: string | null
          cost_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discipline: string
          id: string
          import_batch_id: string | null
          import_source: string | null
          manhours: number | null
          project_id: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          cost_code_id?: string | null
          cost_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discipline: string
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          manhours?: number | null
          project_id: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          cost_code_id?: string | null
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discipline?: string
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          manhours?: number | null
          project_id?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_breakdowns_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_breakdowns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_status: string | null
          created_at: string
          created_by: string | null
          equipment_budget: number | null
          id: string
          labor_budget: number | null
          materials_budget: number | null
          notes: string | null
          other_budget: number | null
          other_budget_description: string | null
          project_id: string
          small_tools_consumables_budget: number | null
          subcontracts_budget: number | null
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_status?: string | null
          created_at?: string
          created_by?: string | null
          equipment_budget?: number | null
          id?: string
          labor_budget?: number | null
          materials_budget?: number | null
          notes?: string | null
          other_budget?: number | null
          other_budget_description?: string | null
          project_id: string
          small_tools_consumables_budget?: number | null
          subcontracts_budget?: number | null
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_status?: string | null
          created_at?: string
          created_by?: string | null
          equipment_budget?: number | null
          id?: string
          labor_budget?: number | null
          materials_budget?: number | null
          notes?: string | null
          other_budget?: number | null
          other_budget_description?: string | null
          project_id?: string
          small_tools_consumables_budget?: number | null
          subcontracts_budget?: number | null
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contract_breakdowns: {
        Row: {
          client_po_number: string | null
          client_representative: string | null
          contract_date: string | null
          contract_terms: string | null
          created_at: string
          created_by: string | null
          demo_po_amount: number | null
          id: string
          labor_po_amount: number | null
          materials_po_amount: number | null
          project_id: string
          total_contract_amount: number | null
          updated_at: string
        }
        Insert: {
          client_po_number?: string | null
          client_representative?: string | null
          contract_date?: string | null
          contract_terms?: string | null
          created_at?: string
          created_by?: string | null
          demo_po_amount?: number | null
          id?: string
          labor_po_amount?: number | null
          materials_po_amount?: number | null
          project_id: string
          total_contract_amount?: number | null
          updated_at?: string
        }
        Update: {
          client_po_number?: string | null
          client_representative?: string | null
          contract_date?: string | null
          contract_terms?: string | null
          created_at?: string
          created_by?: string | null
          demo_po_amount?: number | null
          id?: string
          labor_po_amount?: number | null
          materials_po_amount?: number | null
          project_id?: string
          total_contract_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contract_breakdowns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contract_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contract_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_po_line_items: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          line_number: number
          project_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          line_number: number
          project_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          line_number?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_po_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_po_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_po_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost_to_date: number | null
          actual_revenue_to_date: number | null
          address: string | null
          city: string | null
          client_id: string | null
          cost_to_complete: number | null
          cost_to_complete_notes: string | null
          created_at: string
          created_by: string | null
          data_health_checked_at: string | null
          data_health_status: string | null
          deleted_at: string | null
          description: string | null
          division_id: string
          end_date: string | null
          estimated_final_cost: number | null
          forecast_revenue_current_year: number | null
          forecast_revenue_next_year: number | null
          id: string
          job_number: string
          last_labor_import_at: string | null
          last_po_import_at: string | null
          margin_percent: number | null
          name: string
          original_contract: number | null
          percent_complete: number | null
          physical_percent_complete: number | null
          physical_progress_method: string | null
          profit_forecast: number | null
          project_manager_id: string | null
          revised_contract: number | null
          start_date: string
          state: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          superintendent_id: string | null
          updated_at: string
          variance_at_completion: number | null
          zip_code: string | null
        }
        Insert: {
          actual_cost_to_date?: number | null
          actual_revenue_to_date?: number | null
          address?: string | null
          city?: string | null
          client_id?: string | null
          cost_to_complete?: number | null
          cost_to_complete_notes?: string | null
          created_at?: string
          created_by?: string | null
          data_health_checked_at?: string | null
          data_health_status?: string | null
          deleted_at?: string | null
          description?: string | null
          division_id: string
          end_date?: string | null
          estimated_final_cost?: number | null
          forecast_revenue_current_year?: number | null
          forecast_revenue_next_year?: number | null
          id?: string
          job_number: string
          last_labor_import_at?: string | null
          last_po_import_at?: string | null
          margin_percent?: number | null
          name: string
          original_contract?: number | null
          percent_complete?: number | null
          physical_percent_complete?: number | null
          physical_progress_method?: string | null
          profit_forecast?: number | null
          project_manager_id?: string | null
          revised_contract?: number | null
          start_date: string
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          superintendent_id?: string | null
          updated_at?: string
          variance_at_completion?: number | null
          zip_code?: string | null
        }
        Update: {
          actual_cost_to_date?: number | null
          actual_revenue_to_date?: number | null
          address?: string | null
          city?: string | null
          client_id?: string | null
          cost_to_complete?: number | null
          cost_to_complete_notes?: string | null
          created_at?: string
          created_by?: string | null
          data_health_checked_at?: string | null
          data_health_status?: string | null
          deleted_at?: string | null
          description?: string | null
          division_id?: string
          end_date?: string | null
          estimated_final_cost?: number | null
          forecast_revenue_current_year?: number | null
          forecast_revenue_next_year?: number | null
          id?: string
          job_number?: string
          last_labor_import_at?: string | null
          last_po_import_at?: string | null
          margin_percent?: number | null
          name?: string
          original_contract?: number | null
          percent_complete?: number | null
          physical_percent_complete?: number | null
          physical_progress_method?: string | null
          profit_forecast?: number | null
          project_manager_id?: string | null
          revised_contract?: number | null
          start_date?: string
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          superintendent_id?: string | null
          updated_at?: string
          variance_at_completion?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_superintendent_id_fkey"
            columns: ["superintendent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          approved_by: string | null
          approved_date: string | null
          bb_date: string | null
          budget_category: string | null
          committed_amount: number | null
          contract_extra_type: string | null
          cost_center: string | null
          cost_code_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_delivery_date: string | null
          forecast_amount: number | null
          forecast_date: string | null
          forecast_notes: string | null
          forecasted_final_cost: number | null
          forecasted_overrun: number | null
          fto_return_date: string | null
          fto_sent_date: string | null
          generation_date: string | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          invoice_percentage: number | null
          invoiced_amount: number | null
          last_invoice_date: string | null
          legacy_po_number: string | null
          order_date: string | null
          po_number: string
          po_value: number | null
          project_id: string
          requestor: string | null
          risk_status: Database["public"]["Enums"]["po_risk_status"] | null
          scope: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          sub_cc: string | null
          sub_cost_code: string | null
          subsub_cc: string | null
          total_amount: number
          updated_at: string
          vendor: string | null
          vendor_name: string
          wo_pmo: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          bb_date?: string | null
          budget_category?: string | null
          committed_amount?: number | null
          contract_extra_type?: string | null
          cost_center?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          forecast_amount?: number | null
          forecast_date?: string | null
          forecast_notes?: string | null
          forecasted_final_cost?: number | null
          forecasted_overrun?: number | null
          fto_return_date?: string | null
          fto_sent_date?: string | null
          generation_date?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          invoice_percentage?: number | null
          invoiced_amount?: number | null
          last_invoice_date?: string | null
          legacy_po_number?: string | null
          order_date?: string | null
          po_number: string
          po_value?: number | null
          project_id: string
          requestor?: string | null
          risk_status?: Database["public"]["Enums"]["po_risk_status"] | null
          scope?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          sub_cc?: string | null
          sub_cost_code?: string | null
          subsub_cc?: string | null
          total_amount?: number
          updated_at?: string
          vendor?: string | null
          vendor_name: string
          wo_pmo?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          bb_date?: string | null
          budget_category?: string | null
          committed_amount?: number | null
          contract_extra_type?: string | null
          cost_center?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery_date?: string | null
          forecast_amount?: number | null
          forecast_date?: string | null
          forecast_notes?: string | null
          forecasted_final_cost?: number | null
          forecasted_overrun?: number | null
          fto_return_date?: string | null
          fto_sent_date?: string | null
          generation_date?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          invoice_percentage?: number | null
          invoiced_amount?: number | null
          last_invoice_date?: string | null
          legacy_po_number?: string | null
          order_date?: string | null
          po_number?: string
          po_value?: number | null
          project_id?: string
          requestor?: string | null
          risk_status?: Database["public"]["Enums"]["po_risk_status"] | null
          scope?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          sub_cc?: string | null
          sub_cost_code?: string | null
          subsub_cc?: string | null
          total_amount?: number
          updated_at?: string
          vendor?: string | null
          vendor_name?: string
          wo_pmo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          version: string
        }
        Insert: {
          applied_at?: string
          version: string
        }
        Update: {
          applied_at?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_budget_breakdown_summary: {
        Row: {
          discipline: string | null
          discipline_total: number | null
          equipment_total: number | null
          job_number: string | null
          labor_total: number | null
          materials_total: number | null
          other_total: number | null
          project_id: string | null
          project_name: string | null
          subcontract_total: number | null
          total_manhours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financial_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_breakdowns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_financial_summary: {
        Row: {
          actual_cost_to_date: number | null
          actual_revenue_to_date: number | null
          approved_change_orders: number | null
          cost_to_complete: number | null
          estimated_final_cost: number | null
          id: string | null
          job_number: string | null
          margin_percent: number | null
          name: string | null
          original_contract: number | null
          percent_complete: number | null
          profit_forecast: number | null
          revised_contract: number | null
          status: Database["public"]["Enums"]["project_status"] | null
          total_committed: number | null
          total_forecasted_cost: number | null
          variance_at_completion: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_physical_progress_from_labor: {
        Args: { p_project_id: string }
        Returns: number
      }
      calculate_project_budget_from_breakdowns: {
        Args: { p_project_id: string }
        Returns: {
          total_budget: number
          total_labor: number
          total_materials: number
          total_equipment: number
          total_subcontract: number
          total_other: number
          total_manhours: number
          discipline_count: number
          last_updated: string
        }[]
      }
      calculate_project_profitability: {
        Args: { p_project_id: string }
        Returns: {
          estimated_gross_profit: number
          estimated_profit_margin: number
          budget_vs_contract_variance: number
        }[]
      }
      check_notification_triggers: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_project_budget_by_discipline: {
        Args: { p_project_id: string }
        Returns: {
          discipline: string
          total_value: number
          labor_value: number
          materials_value: number
          equipment_value: number
          subcontract_value: number
          other_value: number
          total_manhours: number
          percentage_of_total: number
        }[]
      }
      log_auth_event: {
        Args: {
          p_user_id: string
          p_event_type: string
          p_event_details?: Json
          p_ip_address?: unknown
          p_user_agent?: string
          p_success?: boolean
          p_error_message?: string
        }
        Returns: string
      }
      update_project_data_health: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      change_order_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      po_risk_status: "normal" | "at-risk" | "over-budget"
      po_status: "draft" | "submitted" | "approved" | "cancelled" | "completed"
      project_status:
        | "planning"
        | "active"
        | "completed"
        | "on_hold"
        | "cancelled"
      user_role:
        | "controller"
        | "executive"
        | "ops_manager"
        | "project_manager"
        | "accounting"
        | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      change_order_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      po_risk_status: ["normal", "at-risk", "over-budget"],
      po_status: ["draft", "submitted", "approved", "cancelled", "completed"],
      project_status: [
        "planning",
        "active",
        "completed",
        "on_hold",
        "cancelled",
      ],
      user_role: [
        "controller",
        "executive",
        "ops_manager",
        "project_manager",
        "accounting",
        "viewer",
      ],
    },
  },
} as const
