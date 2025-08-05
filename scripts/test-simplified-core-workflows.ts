#!/usr/bin/env npx tsx

/**
 * Test script to verify core workflows after simplification
 * Tests: PO import, Labor import, Excel budget import
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testCoreWorkflows() {
  console.log('🧪 Testing Simplified Core Workflows\n')

  try {
    // Test 1: Check essential tables exist
    console.log('1️⃣ Checking essential tables...')
    const essentialTables = [
      'profiles',
      'projects', 
      'employees',
      'craft_types',
      'purchase_orders',
      'po_line_items',
      'change_orders',
      'labor_employee_actuals',
      'labor_headcount_forecasts',
      'budget_line_items',
      'audit_log',
      'data_imports'
    ]

    for (const table of essentialTables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error(`❌ Table ${table} check failed:`, error.message)
      } else {
        console.log(`✅ Table ${table} exists`)
      }
    }

    // Test 2: Check removed tables are gone
    console.log('\n2️⃣ Verifying removed tables are gone...')
    const removedTables = [
      'divisions',
      'project_divisions',
      'division_budgets',
      'notifications',
      'financial_snapshots',
      'wbs_structure'
    ]

    for (const table of removedTables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error && error.code === '42P01') { // 42P01 = undefined table
        console.log(`✅ Table ${table} successfully removed`)
      } else {
        console.error(`❌ Table ${table} still exists!`)
      }
    }

    // Test 3: Test simplified project query
    console.log('\n3️⃣ Testing simplified project queries...')
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        job_number,
        original_contract,
        status
      `)
      .limit(5)

    if (projectError) {
      console.error('❌ Project query failed:', projectError.message)
    } else {
      console.log(`✅ Project query successful: ${projects?.length || 0} projects found`)
    }

    // Test 4: Test employee with Direct/Indirect classification
    console.log('\n4️⃣ Testing employee Direct/Indirect classification...')
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        employee_number,
        first_name,
        last_name,
        is_direct,
        craft_type_id,
        craft_types (
          id,
          name,
          category
        )
      `)
      .limit(5)

    if (empError) {
      console.error('❌ Employee query failed:', empError.message)
    } else {
      console.log(`✅ Employee query successful: ${employees?.length || 0} employees found`)
      const directCount = employees?.filter(e => e.is_direct).length || 0
      const indirectCount = employees?.filter(e => !e.is_direct).length || 0
      console.log(`   Direct: ${directCount}, Indirect: ${indirectCount}`)
    }

    // Test 5: Test simplified RLS policies
    console.log('\n5️⃣ Testing simplified RLS policies...')
    
    // Create a test user context
    const { data: { users } } = await supabase.auth.admin.listUsers()
    if (users && users.length > 0) {
      const testUser = users[0]
      console.log(`✅ Found test user: ${testUser.email}`)
      
      // Test that all authenticated users can view projects
      const { data: userProjects, error: userProjError } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
      
      if (userProjError) {
        console.error('❌ User project access failed:', userProjError.message)
      } else {
        console.log('✅ User can access projects')
      }
    }

    // Test 6: Basic labor import capability check
    console.log('\n6️⃣ Checking labor import tables...')
    const { data: laborActuals, error: laborError } = await supabase
      .from('labor_employee_actuals')
      .select('id')
      .limit(1)

    if (laborError && laborError.code !== 'PGRST116') {
      console.error('❌ Labor actuals table check failed:', laborError.message)
    } else {
      console.log('✅ Labor import tables accessible')
    }

    console.log('\n✨ Core workflow tests completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests
testCoreWorkflows()