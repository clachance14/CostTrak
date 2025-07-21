#!/usr/bin/env tsx

/**
 * Run Division Migrations - Simple Version
 * 
 * This script provides instructions and a simple way to verify
 * if migrations have been applied
 */

import { createClient } from '@supabase/supabase-js'

// Database connection
const supabaseUrl = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🔍 Checking Migration Status...\n')

async function checkMigrationStatus() {
  try {
    // Check if new tables exist
    const tables = [
      'project_divisions',
      'division_budgets',
      'division_forecasts',
      'division_discipline_mapping',
      'craft_type_divisions',
      'notification_triggers'
    ]
    
    console.log('📊 Checking for new tables:')
    
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        
        console.log(`   ✅ ${table} exists (${count || 0} rows)`)
      } catch (error) {
        console.log(`   ❌ ${table} does not exist`)
      }
    }
    
    console.log('\n📋 To run the migrations:')
    console.log('\n1. Using Supabase Dashboard (Recommended):')
    console.log('   - Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql')
    console.log('   - Open each migration file in order:')
    console.log('     • supabase/migrations/20250121_multi_division_support.sql')
    console.log('     • supabase/migrations/20250121_multi_division_rls_policies.sql')
    console.log('     • supabase/migrations/20250121_multi_division_data_migration.sql')
    console.log('     • supabase/migrations/20250121_notification_triggers.sql')
    console.log('     • supabase/migrations/20250121_migrate_existing_projects_to_divisions.sql')
    console.log('   - Copy and paste each file\'s contents into the SQL editor')
    console.log('   - Click "Run" for each file')
    
    console.log('\n2. Using psql or database client:')
    console.log('   psql "postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"')
    console.log('   Then run: \\i supabase/migrations/[filename].sql')
    
    console.log('\n3. Using Supabase CLI (if installed):')
    console.log('   supabase link --project-ref gzrxhwpmtbgnngadgnse')
    console.log('   supabase db push')
    
  } catch (error) {
    console.error('Error checking migration status:', error)
  }
}

checkMigrationStatus()