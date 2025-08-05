#!/usr/bin/env tsx
/**
 * Check if labor forecast database functions exist
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

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

// Database functions to check
const functionsToCheck = [
  'get_composite_labor_rate',
  'get_labor_category_rates',
  'get_weekly_actuals_by_category',
  'get_headcount_category_rates'
]

async function checkFunctionExists(functionName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(functionName, {
      p_project_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      p_weeks_back: 1
    })
    
    // If we get an error about the project not existing, the function exists
    if (error && error.message.includes('Project not found')) {
      return true
    }
    
    // If no error or other error, check if function exists
    return !error || error.code !== '42883' // 42883 is function does not exist
  } catch (e: any) {
    // If error code is 42883, function doesn't exist
    return e.code !== '42883'
  }
}

async function testFunctionWithRealData() {
  console.log('\n🧪 Testing functions with real project data...')
  
  // Get a real project
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, job_number, name')
    .limit(1)
    .single()
    
  if (projectError || !projects) {
    console.log('❌ No projects found to test with')
    return
  }
  
  console.log(`\n📁 Using project: ${projects.job_number} - ${projects.name}`)
  
  // Test each function
  for (const funcName of functionsToCheck) {
    console.log(`\n📊 Testing ${funcName}...`)
    
    try {
      const params: any = {
        p_project_id: projects.id,
        p_weeks_back: 16
      }
      
      if (funcName === 'get_composite_labor_rate') {
        params.p_categories = ['direct', 'indirect', 'staff']
      }
      
      const { data, error } = await supabase.rpc(funcName, params)
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`)
      } else {
        console.log(`   ✅ Function returned data:`)
        
        if (funcName === 'get_composite_labor_rate' && data) {
          console.log(`      - Overall rate: $${data.overall_rate || 0}/hr`)
          console.log(`      - Total hours: ${data.total_hours || 0}`)
          console.log(`      - Total cost: $${data.total_cost || 0}`)
          console.log(`      - Categories: ${Object.keys(data.category_breakdown || {}).length}`)
        } else if (Array.isArray(data)) {
          console.log(`      - Records returned: ${data.length}`)
          if (data.length > 0) {
            console.log(`      - Sample record:`, data[0])
          }
        } else if (data) {
          console.log(`      - Data:`, data)
        }
      }
    } catch (e: any) {
      console.error(`   ❌ Exception: ${e.message}`)
    }
  }
}

async function checkIndexes() {
  console.log('\n🔍 Checking database indexes...')
  
  const indexes = [
    'idx_labor_employee_actuals_project_week',
    'idx_employees_id_category',
    'idx_labor_headcount_forecasts_project_week',
    'idx_craft_types_id_category'
  ]
  
  for (const indexName of indexes) {
    const { data, error } = await supabase.rpc('to_regclass', { indexName })
    
    if (data) {
      console.log(`✅ Index ${indexName} exists`)
    } else {
      console.log(`❌ Index ${indexName} is missing`)
    }
  }
}

async function main() {
  console.log('🔍 Labor Forecast Database Functions Check')
  console.log('=' .repeat(60))
  console.log(`📅 Date: ${new Date().toISOString()}`)
  console.log(`🌐 Database: ${SUPABASE_URL}`)
  
  console.log('\n📋 Checking function existence...')
  let allFunctionsExist = true
  
  for (const funcName of functionsToCheck) {
    const exists = await checkFunctionExists(funcName)
    console.log(`${exists ? '✅' : '❌'} ${funcName}`)
    if (!exists) allFunctionsExist = false
  }
  
  if (!allFunctionsExist) {
    console.log('\n⚠️  Some functions are missing!')
    console.log('\n📝 To fix this, apply the following migrations:')
    console.log('1. supabase/migrations/20250805_optimize_labor_forecast_performance.sql')
    console.log('2. supabase/migrations/20250805_fix_ambiguous_columns.sql')
    console.log('\nRun these in the Supabase SQL editor:')
    console.log('https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
  } else {
    console.log('\n✅ All functions exist!')
    await testFunctionWithRealData()
  }
  
  // Check indexes regardless
  await checkIndexes()
  
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)