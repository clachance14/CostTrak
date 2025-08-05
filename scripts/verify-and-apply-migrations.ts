import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Migration files to check
const migrations = [
  {
    file: '20250729_add_cost_type_to_budget_line_items.sql',
    checkColumn: 'cost_type',
    checkTable: 'budget_line_items'
  },
  {
    file: '20250730023946_add_5_level_wbs_support.sql',
    checkTable: 'labor_categories',
    checkColumn: null
  }
]

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .limit(1)
    
    return !error
  } catch {
    return false
  }
}

async function checkTableExists(table: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(1)
    
    return !error
  } catch {
    return false
  }
}

async function getTableStats() {
  const tables = [
    { name: 'wbs_structure', description: 'WBS hierarchy' },
    { name: 'budget_line_items', description: 'Budget line items' },
    { name: 'labor_categories', description: 'Labor categories (39 direct + 23 indirect)' },
    { name: 'phase_allocations', description: 'Phase allocations' },
    { name: 'discipline_registry', description: 'Discipline mappings' },
    { name: 'direct_labor_allocations', description: 'Direct labor allocations' }
  ]
  
  console.log('\n📊 Current Database Schema Status:')
  console.log('=' .repeat(60))
  
  for (const table of tables) {
    const exists = await checkTableExists(table.name)
    
    if (exists) {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
      
      console.log(`✅ ${table.name.padEnd(30)} ${String(count || 0).padStart(6)} records  ${table.description}`)
      
      // Check specific details
      if (table.name === 'labor_categories' && count) {
        const { count: directCount } = await supabase
          .from('labor_categories')
          .select('*', { count: 'exact', head: true })
          .eq('category_type', 'DIRECT')
        
        const { count: indirectCount } = await supabase
          .from('labor_categories')
          .select('*', { count: 'exact', head: true })
          .eq('category_type', 'INDIRECT')
        
        console.log(`   └─ Direct: ${directCount || 0}, Indirect: ${indirectCount || 0}`)
      }
    } else {
      console.log(`❌ ${table.name.padEnd(30)} MISSING`)
    }
  }
  
  // Check specific columns
  console.log('\n📋 Column Status:')
  const costTypeExists = await checkColumnExists('budget_line_items', 'cost_type')
  console.log(`${costTypeExists ? '✅' : '❌'} budget_line_items.cost_type column`)
  
  const wbsColumnsToCheck = ['phase', 'cost_type', 'labor_category_id', 'path', 'sort_order']
  for (const col of wbsColumnsToCheck) {
    const exists = await checkColumnExists('wbs_structure', col)
    console.log(`${exists ? '✅' : '❌'} wbs_structure.${col} column`)
  }
}

async function generateMigrationInstructions() {
  console.log('\n' + '='.repeat(60))
  console.log('📝 MIGRATION INSTRUCTIONS')
  console.log('=' .repeat(60))
  
  // Check which migrations need to be applied
  const costTypeExists = await checkColumnExists('budget_line_items', 'cost_type')
  const laborCategoriesExists = await checkTableExists('labor_categories')
  
  const migrationsNeeded = []
  if (!costTypeExists) {
    migrationsNeeded.push('20250729_add_cost_type_to_budget_line_items.sql')
  }
  if (!laborCategoriesExists) {
    migrationsNeeded.push('20250730023946_add_5_level_wbs_support.sql')
  }
  
  if (migrationsNeeded.length === 0) {
    console.log('✅ All migrations appear to be applied!')
    return
  }
  
  console.log('\n⚠️  The following migrations need to be applied:')
  migrationsNeeded.forEach(m => console.log(`   - ${m}`))
  
  console.log('\n📌 Method 1: Supabase Dashboard (Recommended)')
  console.log('1. Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
  console.log('2. For each migration file listed above:')
  console.log('   a. Open the file: supabase/migrations/[filename]')
  console.log('   b. Copy the entire SQL content')
  console.log('   c. Paste into the SQL editor')
  console.log('   d. Click "Run" to execute')
  console.log('\n📌 Method 2: Supabase CLI (if connection issues are resolved)')
  console.log('1. Run: pnpm supabase db push --db-url postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
  console.log('\n📌 Method 3: psql Direct Connection')
  console.log('1. Install PostgreSQL client if not available')
  console.log('2. Run: psql postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
  console.log('3. Execute: \\i supabase/migrations/[filename]')
  
  console.log('\n' + '='.repeat(60))
  console.log('🔄 After applying migrations:')
  console.log('1. Run: pnpm generate-types:remote')
  console.log('2. Run this script again to verify: npx tsx scripts/verify-and-apply-migrations.ts')
}

async function main() {
  console.log('🔍 CostTrak Migration Verification Tool')
  console.log('=' .repeat(60))
  console.log(`📅 Date: ${new Date().toISOString()}`)
  console.log(`🌐 Database: ${SUPABASE_URL}`)
  
  await getTableStats()
  await generateMigrationInstructions()
  
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)