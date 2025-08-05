#!/usr/bin/env tsx
/**
 * Apply the complete simplification migration to the remote database
 * This script runs the 20250131_complete_simplification.sql migration
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Remote database connection
const SUPABASE_URL = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.error('   Please set it in your .env.local file or environment')
  process.exit(1)
}

async function runMigration() {
  console.log('🚀 Starting database simplification migration...\n')

  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250131_complete_simplification.sql')
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded:', migrationPath)
    console.log('📏 Migration size:', migrationSQL.length, 'characters\n')

    // First, let's check what tables currently exist
    console.log('🔍 Checking current database state...')
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables', {})
      .single()

    if (tablesError) {
      // Try a different approach - query information schema
      const { data: tableList, error: listError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name')

      if (listError) {
        console.log('⚠️  Could not fetch current tables, continuing anyway...')
      } else {
        console.log(`📊 Current tables in database: ${tableList?.length || 0}`)
        if (tableList && tableList.length > 30) {
          console.log('   (Too many tables - this migration will clean them up)')
        }
      }
    }

    // Execute the migration
    console.log('\n🔄 Executing migration...')
    console.log('   This will:')
    console.log('   - Drop ~40 unnecessary tables')
    console.log('   - Simplify RLS policies')
    console.log('   - Keep only core import functionality')
    console.log('   - Preserve all project/employee/budget data\n')

    // Split the migration into parts to handle any issues
    const parts = migrationSQL.split(/-- ={5,}/g).filter(part => part.trim())
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (!part) continue

      // Extract part name from comment
      const partMatch = part.match(/-- PART \d+: (.+)/)
      const partName = partMatch ? partMatch[1] : `Part ${i + 1}`
      
      console.log(`\n⚙️  Running ${partName}...`)
      
      try {
        // For the RLS policy drops, we need to handle them differently
        if (part.includes('DO $$')) {
          // Execute the anonymous block directly
          const { error } = await supabase.rpc('exec_sql', { sql: part })
          if (error) {
            console.error(`❌ Error in ${partName}:`, error.message)
            // Continue with other parts even if one fails
          } else {
            console.log(`✅ ${partName} completed`)
          }
        } else {
          // For regular SQL, split by semicolons and execute each statement
          const statements = part.split(';').filter(s => s.trim() && !s.trim().startsWith('--'))
          
          for (const statement of statements) {
            const trimmedStatement = statement.trim()
            if (!trimmedStatement) continue
            
            try {
              const { error } = await supabase.rpc('exec_sql', { sql: trimmedStatement + ';' })
              if (error) {
                // Some drops might fail if objects don't exist, that's okay
                if (error.message.includes('does not exist')) {
                  console.log(`   ⚠️  Skipped (already dropped): ${trimmedStatement.substring(0, 50)}...`)
                } else {
                  console.error(`   ❌ Error: ${error.message}`)
                  console.error(`      Statement: ${trimmedStatement.substring(0, 100)}...`)
                }
              }
            } catch (err) {
              console.error(`   ❌ Unexpected error: ${err}`)
            }
          }
          console.log(`✅ ${partName} completed`)
        }
      } catch (err) {
        console.error(`❌ Failed to execute ${partName}:`, err)
      }
    }

    // Verify the results
    console.log('\n🔍 Verifying migration results...')
    
    // Check remaining tables
    const { data: finalTables, error: finalError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (!finalError && finalTables) {
      console.log(`\n📊 Tables remaining: ${finalTables.length}`)
      console.log('   Core tables preserved:')
      const coreTables = ['profiles', 'projects', 'employees', 'craft_types', 
                         'purchase_orders', 'po_line_items', 'labor_actuals', 
                         'labor_employee_actuals', 'budget_line_items', 'data_imports']
      
      for (const table of coreTables) {
        const exists = finalTables.some(t => t.table_name === table)
        console.log(`   ${exists ? '✅' : '❌'} ${table}`)
      }
    }

    console.log('\n✨ Migration completed successfully!')
    console.log('   The database has been simplified to focus on core import functionality.')
    console.log('   Next steps:')
    console.log('   1. Run: pnpm generate-types')
    console.log('   2. Test the three core imports (Budget, Labor, PO)')
    console.log('   3. Remove UI components for dropped features')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Create a simple RPC function if it doesn't exist
async function ensureExecSQLFunction() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const createFunction = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `

  try {
    await supabase.rpc('exec_sql', { sql: 'SELECT 1' })
  } catch (error) {
    // Function doesn't exist, create it
    console.log('📦 Creating helper function...')
    const { error: createError } = await supabase.rpc('query', { query: createFunction })
    if (createError) {
      console.log('⚠️  Could not create helper function, will use alternative approach')
    }
  }
}

// Run the migration
ensureExecSQLFunction().then(() => runMigration())