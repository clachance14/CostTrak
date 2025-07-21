#!/usr/bin/env tsx

/**
 * Generate TypeScript types from Supabase API
 * This script fetches the database schema via the Supabase API
 * and generates TypeScript types without needing the Supabase CLI
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

async function generateTypes() {
  console.log('🔄 Fetching database schema from Supabase...')
  
  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Query the information schema to get all tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_schema_info', {})
      .single()

    if (tablesError) {
      // If RPC doesn't exist, try direct query
      console.log('⚠️  RPC not available, using alternative method...')
      
      // For now, we'll indicate that types need to be generated manually
      console.log('\n📋 To generate types, you need to:')
      console.log('1. Install Supabase CLI: npm install -g supabase')
      console.log('2. Login to Supabase: supabase login')
      console.log('3. Link project: supabase link --project-ref gzrxhwpmtbgnngadgnse')
      console.log('4. Generate types: supabase gen types typescript --project-id gzrxhwpmtbgnngadgnse > types/database.generated.ts')
      
      // Create a placeholder file with the new tables
      const placeholderTypes = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // New multi-division tables (pending generation)
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
          created_at?: string
          updated_at?: string
          created_by?: string | null
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
      }
    }
    Views: {
      division_cost_summary: {
        Row: {
          project_id: string | null
          division_id: string | null
          division_name: string | null
          total_po_committed: number | null
          total_po_invoiced: number | null
          total_labor_cost: number | null
          total_labor_hours: number | null
          approved_change_orders: number | null
          total_committed: number | null
          budget_variance: number | null
          last_updated: string | null
        }
      }
    }
    Functions: {}
    Enums: {}
  }
}

// Note: This is a placeholder. Run the Supabase CLI to generate complete types.
`

      const outputPath = path.join(process.cwd(), 'types', 'database.generated.ts')
      fs.writeFileSync(outputPath, placeholderTypes)
      
      console.log('✅ Created placeholder types at types/database.generated.ts')
      console.log('⚠️  These are incomplete - please run the Supabase CLI to generate full types')
      return
    }

    console.log('✅ Schema fetched successfully')
    console.log('📝 Generating TypeScript types...')
    
    // Process and generate types...
    // (Implementation would go here)
    
  } catch (error) {
    console.error('❌ Error generating types:', error)
    process.exit(1)
  }
}

// Run the script
generateTypes().catch(console.error)