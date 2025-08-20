import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// First, let's check if we need to apply the cost_type migration
async function checkAndApplyCostType() {
  console.log('Checking cost_type column...')
  
  try {
    // Try to select the column
    const { data, error } = await supabase
      .from('budget_line_items')
      .select('cost_type')
      .limit(1)
    
    if (error && error.message.includes('column "cost_type" does not exist')) {
      console.log('Cost type column does not exist, creating it...')
      
      // Apply the migration using raw SQL through a stored procedure
      // Since we can't execute arbitrary SQL, we'll need to use the Supabase Dashboard
      console.log('\n⚠️  Please apply the following migrations manually through Supabase Dashboard:')
      console.log('1. Navigate to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
      console.log('2. Copy and run the SQL from:')
      console.log('   - supabase/migrations/20250729_add_cost_type_to_budget_line_items.sql')
      console.log('   - supabase/migrations/20250730023946_add_5_level_wbs_support.sql')
      console.log('\nAlternatively, you can use the Supabase CLI with a working connection.')
      
      return false
    } else if (!error) {
      console.log('✓ cost_type column already exists')
      return true
    }
  } catch (err) {
    console.error('Error checking cost_type:', err)
    return false
  }
}

// Check new tables
async function checkNewTables() {
  const tables = [
    'labor_categories',
    'phase_allocations', 
    'discipline_registry',
    'direct_labor_allocations'
  ]
  
  console.log('\nChecking new tables...')
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1)
      
      if (error) {
        console.log(`✗ ${table} - does not exist`)
      } else {
        console.log(`✓ ${table} - exists`)
        
        // Count records if table exists
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        
        if (count && count > 0) {
          console.log(`  └─ Contains ${count} records`)
        }
      }
    } catch (err) {
      console.log(`✗ ${table} - error checking`)
    }
  }
}

async function main() {
  console.log('Migration Status Check')
  console.log('=====================\n')
  
  const costTypeExists = await checkAndApplyCostType()
  await checkNewTables()
  
  console.log('\n' + '='.repeat(50))
  console.log('Next Steps:')
  console.log('1. Apply migrations through Supabase Dashboard')
  console.log('2. Run "pnpm generate-types:remote" after migration')
  console.log('3. Run this script again to verify')
}

main().catch(console.error)