import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkExistingSchema() {
  console.log('Checking existing schema...')
  
  // Check if cost_type column exists
  const { data: costTypeExists } = await supabase
    .from('budget_line_items')
    .select('cost_type')
    .limit(1)
  
  if (costTypeExists !== null) {
    console.log('✓ cost_type column already exists in budget_line_items')
  } else {
    console.log('✗ cost_type column does not exist in budget_line_items')
  }
  
  // Check if labor_categories table exists
  const { data: laborCategories, error: lcError } = await supabase
    .from('labor_categories')
    .select('count')
    .limit(1)
  
  if (!lcError) {
    console.log('✓ labor_categories table already exists')
    
    // Count existing records
    const { count } = await supabase
      .from('labor_categories')
      .select('*', { count: 'exact', head: true })
    
    console.log(`  - Contains ${count} records`)
  } else {
    console.log('✗ labor_categories table does not exist')
  }
  
  // Check other new tables
  const tables = ['phase_allocations', 'discipline_registry', 'direct_labor_allocations']
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('count')
      .limit(1)
    
    if (!error) {
      console.log(`✓ ${table} table already exists`)
    } else {
      console.log(`✗ ${table} table does not exist`)
    }
  }
}

async function applyMigration() {
  console.log('\nReading migration file...')
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250730023946_add_5_level_wbs_support.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('Applying migration to remote database...')
  
  try {
    // Execute the migration using RPC call
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSql })
    
    if (error) {
      console.error('Migration failed:', error)
      
      // If exec_sql doesn't exist, we'll need to apply the migration manually
      if (error.message.includes('function public.exec_sql')) {
        console.log('\nThe exec_sql function is not available. Please apply the migration using Supabase Dashboard or CLI.')
        console.log('Migration file location:', migrationPath)
      }
    } else {
      console.log('✓ Migration applied successfully!')
    }
  } catch (err) {
    console.error('Error applying migration:', err)
  }
}

async function verifyMigration() {
  console.log('\nVerifying migration results...')
  
  // Check labor categories count
  const { count: directCount } = await supabase
    .from('labor_categories')
    .select('*', { count: 'exact', head: true })
    .eq('category_type', 'DIRECT')
  
  const { count: indirectCount } = await supabase
    .from('labor_categories')
    .select('*', { count: 'exact', head: true })
    .eq('category_type', 'INDIRECT')
  
  console.log(`✓ Direct labor categories: ${directCount} (expected: 39)`)
  console.log(`✓ Indirect labor categories: ${indirectCount} (expected: 23)`)
  
  // Check discipline registry
  const { count: disciplineCount } = await supabase
    .from('discipline_registry')
    .select('*', { count: 'exact', head: true })
  
  console.log(`✓ Discipline registry entries: ${disciplineCount}`)
  
  // Check WBS structure level constraint
  const { data: wbsConstraint } = await supabase
    .rpc('get_check_constraints', { 
      table_name: 'wbs_structure',
      constraint_name: 'check_level'
    })
    .single()
  
  if (wbsConstraint) {
    console.log('✓ WBS structure level constraint updated')
  }
}

async function main() {
  console.log('5-Level WBS Migration Script')
  console.log('===========================')
  
  await checkExistingSchema()
  
  // Ask user to confirm
  console.log('\nDo you want to apply the migration? (Check the schema status above)')
  console.log('Note: The migration is idempotent and safe to run multiple times.')
  
  // For now, we'll just check the schema
  // await applyMigration()
  // await verifyMigration()
}

main().catch(console.error)