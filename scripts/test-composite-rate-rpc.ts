#!/usr/bin/env tsx
/**
 * Test composite rate RPC function directly
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

async function testCompositeRate() {
  console.log('🔍 Testing Composite Rate RPC Function')
  console.log('=' .repeat(60))
  
  // Get project
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
  console.log(`Project ID: ${project.id}`)
  
  // Test with different parameter variations
  const testCases = [
    {
      name: 'Lowercase categories',
      params: {
        p_project_id: project.id,
        p_weeks_back: 16,
        p_categories: ['direct', 'indirect', 'staff']
      }
    },
    {
      name: 'Capitalized categories',
      params: {
        p_project_id: project.id,
        p_weeks_back: 16,
        p_categories: ['Direct', 'Indirect', 'Staff']
      }
    },
    {
      name: 'Without categories parameter',
      params: {
        p_project_id: project.id,
        p_weeks_back: 16
      }
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n📊 Test: ${testCase.name}`)
    console.log('Parameters:', JSON.stringify(testCase.params, null, 2))
    
    try {
      const { data, error } = await supabase.rpc('get_composite_labor_rate', testCase.params)
      
      if (error) {
        console.error('❌ Error:', error)
      } else {
        console.log('✅ Result:')
        console.log(`- Overall rate: $${data?.overall_rate || 0}/hr`)
        console.log(`- Total hours: ${data?.total_hours || 0}`)
        console.log(`- Total cost: $${data?.total_cost || 0}`)
        console.log(`- Category breakdown:`, JSON.stringify(data?.category_breakdown, null, 2))
      }
    } catch (e) {
      console.error('❌ Exception:', e)
    }
  }
  
  // Also test the raw SQL to see what's happening
  console.log('\n📊 Testing raw SQL query for categories:')
  const { data: categoryData, error: categoryError } = await supabase
    .from('employees')
    .select('category')
    .in('category', ['Direct', 'Indirect', 'Staff'])
    .limit(10)
    
  if (categoryError) {
    console.error('❌ Category query error:', categoryError)
  } else {
    console.log('✅ Sample employee categories:', categoryData?.map(e => e.category))
  }
}

async function main() {
  await testCompositeRate()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)