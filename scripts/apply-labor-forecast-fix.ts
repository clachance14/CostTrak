#!/usr/bin/env tsx
/**
 * Apply labor forecast fix migration
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
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

async function applyMigration() {
  console.log('🔧 Applying Labor Forecast Fix Migration')
  console.log('=' .repeat(60))
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250805_fix_category_case_sensitivity.sql')
  
  try {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📝 Migration file loaded successfully')
    console.log('📤 Applying migration to database...')
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('❌ Migration failed:', error)
      console.log('\n📌 Alternative: Apply the migration manually in Supabase Dashboard:')
      console.log('   1. Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
      console.log('   2. Copy the contents of: supabase/migrations/20250805_fix_category_case_sensitivity.sql')
      console.log('   3. Paste and run in the SQL editor')
      return
    }
    
    console.log('✅ Migration applied successfully!')
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error)
    console.log('\n📌 Apply the migration manually in Supabase Dashboard:')
    console.log('   1. Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
    console.log('   2. Copy the contents of: supabase/migrations/20250805_fix_category_case_sensitivity.sql')
    console.log('   3. Paste and run in the SQL editor')
  }
}

async function testFix() {
  console.log('\n🧪 Testing the fix...')
  
  // Get a project with labor data
  const { data: project } = await supabase
    .from('projects')
    .select('id, job_number, name')
    .eq('job_number', '5772')
    .single()
    
  if (!project) {
    console.log('❌ Test project not found')
    return
  }
  
  console.log(`\n📁 Testing with project: ${project.job_number} - ${project.name}`)
  
  // Test composite rate
  console.log('\n📊 Testing composite rate function...')
  const { data: compositeData, error: compositeError } = await supabase.rpc('get_composite_labor_rate', {
    p_project_id: project.id,
    p_weeks_back: 16,
    p_categories: ['direct', 'indirect', 'staff']
  })
  
  if (compositeError) {
    console.error('❌ Composite rate error:', compositeError)
  } else if (compositeData) {
    console.log('✅ Composite rate result:')
    console.log(`   - Overall rate: $${compositeData.overall_rate || 0}/hr`)
    console.log(`   - Total hours: ${compositeData.total_hours || 0}`)
    console.log(`   - Total cost: $${compositeData.total_cost || 0}`)
    console.log(`   - Categories:`, Object.keys(compositeData.category_breakdown || {}))
  }
  
  // Test category rates
  console.log('\n📊 Testing category rates function...')
  const { data: categoryData, error: categoryError } = await supabase.rpc('get_labor_category_rates', {
    p_project_id: project.id,
    p_weeks_back: 16
  })
  
  if (categoryError) {
    console.error('❌ Category rates error:', categoryError)
  } else if (categoryData && categoryData.length > 0) {
    console.log('✅ Category rates result:')
    categoryData.forEach((cat: any) => {
      console.log(`   - ${cat.category}: $${cat.avg_rate}/hr (${cat.total_hours} hours, $${cat.total_cost} total)`)
    })
  } else {
    console.log('⚠️  No category data returned')
  }
}

async function main() {
  // First show the manual instructions
  console.log('📌 RECOMMENDED: Apply migration manually via Supabase Dashboard')
  console.log('=' .repeat(60))
  console.log('1. Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
  console.log('2. Copy the contents of: supabase/migrations/20250805_fix_category_case_sensitivity.sql')
  console.log('3. Paste the SQL into the editor')
  console.log('4. Click "Run" to execute the migration')
  console.log('\n' + '=' .repeat(60))
  
  // Test after manual application
  console.log('\n📌 After applying the migration, run this command to test:')
  console.log('   npx tsx scripts/apply-labor-forecast-fix.ts --test')
  
  if (process.argv.includes('--test')) {
    await testFix()
  }
  
  console.log('\n' + '=' .repeat(60))
}

main().catch(console.error)