#!/usr/bin/env tsx
/**
 * Verify the current state of the database
 */

import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createAdminClient } from '../lib/supabase/admin'

async function verifyDatabaseState() {
  console.log('🔍 Verifying CostTrak Database State')
  console.log('=====================================\n')

  try {
    const supabase = createAdminClient()

    // Test connection
    const { error: testError } = await supabase
      .from('projects')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('❌ Could not connect to database:', testError.message)
      process.exit(1)
    }

    console.log('✅ Connected to database\n')

    // List all tables
    console.log('📊 Current Tables:')
    const tables = [
      'profiles', 'projects', 'employees', 'craft_types',
      'purchase_orders', 'po_line_items', 'change_orders',
      'labor_actuals', 'labor_employee_actuals', 'labor_headcount_forecasts',
      'budget_line_items', 'data_imports', 'audit_log',
      // Tables that should be dropped
      'divisions', 'notifications', 'wbs_structure', 'financial_snapshots',
      'invoices', 'clients', 'cost_codes', 'labor_categories'
    ]

    const coreTablesStatus: Record<string, boolean> = {}
    const droppedTablesStatus: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(0)

        const exists = !error
        
        if (table.includes('divisions') || table.includes('notifications') || 
            table.includes('wbs_structure') || table.includes('financial_snapshots') ||
            table.includes('invoices') || table.includes('clients') || 
            table.includes('cost_codes') || table.includes('labor_categories')) {
          droppedTablesStatus[table] = exists
        } else {
          coreTablesStatus[table] = exists
        }
      } catch (err) {
        // Table doesn't exist
        if (table.includes('divisions') || table.includes('notifications')) {
          droppedTablesStatus[table] = false
        } else {
          coreTablesStatus[table] = false
        }
      }
    }

    console.log('\n✅ Core Tables (Should Exist):')
    Object.entries(coreTablesStatus).forEach(([table, exists]) => {
      console.log(`   ${exists ? '✅' : '❌'} ${table}`)
    })

    console.log('\n🗑️  Tables to Drop (Should NOT Exist):')
    Object.entries(droppedTablesStatus).forEach(([table, exists]) => {
      console.log(`   ${exists ? '❌' : '✅'} ${table} ${exists ? '(needs to be dropped)' : '(already dropped)'}`)
    })

    // Check for 2FA columns in profiles
    console.log('\n🔐 Checking profiles table simplification:')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)

      if (!error && data && data.length > 0) {
        const profile = data[0]
        const has2FA = 'two_factor_enabled' in profile || 
                      'two_factor_secret' in profile || 
                      'two_factor_backup_codes' in profile
        
        console.log(`   ${has2FA ? '❌' : '✅'} 2FA columns ${has2FA ? 'still exist (need removal)' : 'removed'}`)
      }
    } catch (err) {
      console.log('   ⚠️  Could not check profiles table')
    }

    // Check projects table columns
    console.log('\n📋 Checking projects table simplification:')
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .limit(1)

      if (!error && data && data.length > 0) {
        const project = data[0]
        const hasComplexColumns = 'division_id' in project || 
                                 'risk_factors' in project || 
                                 'action_items' in project ||
                                 'data_health_status' in project
        
        console.log(`   ${hasComplexColumns ? '❌' : '✅'} Complex columns ${hasComplexColumns ? 'still exist (need removal)' : 'removed'}`)
        
        const hasReminderColumn = 'last_import_reminder_sent' in project
        console.log(`   ${hasReminderColumn ? '✅' : '❌'} Import reminder column ${hasReminderColumn ? 'exists' : 'missing (needs to be added)'}`)
      }
    } catch (err) {
      console.log('   ⚠️  Could not check projects table')
    }

    // Count total tables
    const coreTableCount = Object.values(coreTablesStatus).filter(exists => exists).length
    const unnecessaryTableCount = Object.values(droppedTablesStatus).filter(exists => exists).length

    console.log('\n📈 Summary:')
    console.log(`   Core tables present: ${coreTableCount}/13`)
    console.log(`   Tables to be dropped: ${unnecessaryTableCount}`)
    
    if (coreTableCount === 13 && unnecessaryTableCount === 0) {
      console.log('\n✨ Database is fully simplified!')
    } else {
      console.log('\n⚠️  Database needs simplification')
      console.log('   Run the migration steps in manual-migration-steps.sql')
    }

    // Test imports functionality
    console.log('\n🧪 Testing Import Functionality:')
    
    // Check if we can query data_imports
    const { data: imports, error: importsError } = await supabase
      .from('data_imports')
      .select('import_type, import_status')
      .limit(5)
      .order('imported_at', { ascending: false })

    if (!importsError) {
      console.log('   ✅ data_imports table is accessible')
      if (imports && imports.length > 0) {
        console.log(`   📋 Recent imports: ${imports.map(i => i.import_type).join(', ')}`)
      }
    } else {
      console.log('   ❌ data_imports table error:', importsError.message)
    }

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

// Run verification
verifyDatabaseState().catch(console.error)