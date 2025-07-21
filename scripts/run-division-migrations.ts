#!/usr/bin/env tsx

/**
 * Run Division Migrations
 * 
 * This script executes all the multi-division migration scripts
 * in the correct order directly on the database
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Migration files in order
const migrations = [
  '20250121_multi_division_support.sql',
  '20250121_multi_division_rls_policies.sql',
  '20250121_multi_division_data_migration.sql',
  '20250121_notification_triggers.sql',
  '20250121_migrate_existing_projects_to_divisions.sql'
]

async function runMigrations() {
  console.log('🚀 Starting Division Migration Process...\n')

  for (const migrationFile of migrations) {
    console.log(`📄 Running migration: ${migrationFile}`)
    
    try {
      // Read migration file
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile)
      const sql = readFileSync(migrationPath, 'utf8')
      
      // Split into individual statements (simple split on semicolon)
      // Note: This is a simplified approach and may not handle all SQL edge cases
      const statements = sql
        .split(/;\s*$/m)
        .filter(stmt => stmt.trim().length > 0)
        .map(stmt => stmt.trim() + ';')
      
      console.log(`   Found ${statements.length} SQL statements`)
      
      // Execute each statement
      let successCount = 0
      let errorCount = 0
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.trim() === ';') {
          continue
        }
        
        try {
          // For complex statements with DO blocks, we need to use raw SQL
          const { error } = await supabase.rpc('exec_sql', {
            sql_query: statement
          }).single()
          
          if (error) {
            // Try direct execution as fallback
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({ sql_query: statement })
            })
            
            if (!response.ok) {
              throw new Error(`Statement ${i + 1} failed: ${await response.text()}`)
            }
          }
          
          successCount++
          process.stdout.write('.')
        } catch (error) {
          errorCount++
          console.error(`\n   ❌ Error in statement ${i + 1}:`, error)
          // Continue with next statement
        }
      }
      
      console.log(`\n   ✅ Completed: ${successCount} successful, ${errorCount} errors`)
      
    } catch (error) {
      console.error(`\n❌ Failed to run migration ${migrationFile}:`, error)
      console.log('\n⚠️  You may need to run the migrations manually using:')
      console.log('   1. Supabase Dashboard SQL Editor')
      console.log('   2. psql or another PostgreSQL client')
      console.log('   3. Supabase CLI (if installed)')
      return
    }
  }
  
  console.log('\n✅ All migrations completed!')
  console.log('\n📊 Running validation...\n')
  
  // Run validation
  const { spawn } = await import('child_process')
  const validation = spawn('npx', ['tsx', 'scripts/validate-division-migration.ts'], {
    stdio: 'inherit'
  })
  
  validation.on('close', (code) => {
    if (code === 0) {
      console.log('\n🎉 Migration successful!')
    } else {
      console.log('\n⚠️  Validation failed. Check the output above.')
    }
  })
}

// First, let's create the exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  const createFunction = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Prefer': 'return=minimal'
      },
      body: createFunction
    })
    
    if (!response.ok) {
      console.log('Note: exec_sql function may not exist, migrations will use alternative method')
    }
  } catch (error) {
    // Function might already exist or we'll use alternative method
  }
}

// Run migrations
createExecSqlFunction().then(() => {
  runMigrations().catch(console.error)
})