#!/usr/bin/env tsx

/**
 * Run SQL Migration
 * 
 * This script provides a simple way to run the migration files
 */

import { createClient } from '@supabase/supabase-js'

// Database connection
const supabaseUrl = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDEwNDYsImV4cCI6MjA2NzkxNzA0Nn0.QCx6Ocl-egsZFqgNMGwc_1ML6_olzj2CVub4f6z3n-s'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('📋 Division Migration Instructions\n')

console.log('The migration files need to be run directly in the Supabase Dashboard.\n')

console.log('1. Go to the SQL Editor:')
console.log('   https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new\n')

console.log('2. Run each migration file in this order:\n')

const migrations = [
  {
    file: '20250121_multi_division_support.sql',
    description: 'Creates division support tables and structure'
  },
  {
    file: '20250121_multi_division_rls_policies.sql',
    description: 'Sets up Row Level Security policies'
  },
  {
    file: '20250121_multi_division_data_migration.sql',
    description: 'Migrates existing data to division structure'
  },
  {
    file: '20250121_notification_triggers.sql',
    description: 'Creates notification trigger system'
  },
  {
    file: '20250121_migrate_existing_projects_to_divisions.sql',
    description: 'Final migration for existing projects'
  }
]

migrations.forEach((m, i) => {
  console.log(`   ${i + 1}. ${m.file}`)
  console.log(`      ${m.description}`)
  console.log(`      Path: supabase/migrations/${m.file}\n`)
})

console.log('3. Copy the entire contents of each file and paste into the SQL editor')
console.log('4. Click "Run" for each file\n')

console.log('Alternative: Use a database client like pgAdmin or DBeaver:')
console.log('   Connection string:')
console.log('   postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres\n')

console.log('After running all migrations, validate with:')
console.log('   npx tsx scripts/validate-division-migration.ts\n')

// Quick check of current state
async function checkCurrentState() {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .limit(1)

    if (!error && projects) {
      console.log('✅ Database connection successful')
      
      // Try to check if project_divisions exists
      const { error: divError } = await supabase
        .from('project_divisions')
        .select('id')
        .limit(1)
      
      if (divError && divError.message.includes('relation')) {
        console.log('❌ Division tables not yet created - migrations need to be run')
      } else if (!divError) {
        console.log('✅ Division tables exist - you may proceed with data migration')
      }
    }
  } catch (error) {
    console.error('Error checking database:', error)
  }
}

checkCurrentState()