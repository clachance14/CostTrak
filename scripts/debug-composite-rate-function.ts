#!/usr/bin/env tsx
/**
 * Debug the composite rate function step by step
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

async function debugCompositeRate() {
  console.log('🔍 Debugging Composite Rate Function')
  console.log('=' .repeat(60))
  
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  const weeksBack = 16
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - weeksBack * 7)
  
  console.log(`Project ID: ${projectId}`)
  console.log(`Start date: ${startDate.toISOString().split('T')[0]}`)
  
  // Step 1: Check if we have labor data in the date range
  console.log('\n📊 Step 1: Check labor data in date range')
  const { data: laborInRange, count } = await supabase
    .from('labor_employee_actuals')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .gte('week_ending', startDate.toISOString())
    
  console.log(`Found ${count || 0} labor records in date range`)
  
  // Step 2: Check labor data with employee joins
  console.log('\n📊 Step 2: Check labor data with employee category')
  const { data: laborWithEmployees } = await supabase
    .from('labor_employee_actuals')
    .select(`
      st_hours,
      ot_hours,
      st_wages,
      ot_wages,
      week_ending,
      employees!inner(
        id,
        category
      )
    `)
    .eq('project_id', projectId)
    .gte('week_ending', startDate.toISOString())
    .limit(5)
    
  console.log('Sample records with employee data:')
  laborWithEmployees?.forEach((record, i) => {
    console.log(`Record ${i + 1}:`)
    console.log(`- Week: ${record.week_ending}`)
    console.log(`- Category: ${record.employees?.category}`)
    console.log(`- Hours: ST=${record.st_hours}, OT=${record.ot_hours}`)
    console.log(`- Wages: ST=$${record.st_wages}, OT=$${record.ot_wages}`)
  })
  
  // Step 3: Test the exact query the function should be using
  console.log('\n📊 Step 3: Test exact function query logic')
  const { data: categoryTotals } = await supabase
    .from('labor_employee_actuals')
    .select(`
      employees!inner(category),
      st_hours,
      ot_hours,
      st_wages,
      ot_wages
    `)
    .eq('project_id', projectId)
    .gte('week_ending', startDate.toISOString())
    .gt('st_hours', 0) // Only records with hours
    
  // Aggregate manually
  const totals: Record<string, { hours: number; cost: number }> = {}
  
  categoryTotals?.forEach(record => {
    const category = record.employees?.category
    if (category && ['Direct', 'Indirect', 'Staff'].includes(category)) {
      if (!totals[category]) {
        totals[category] = { hours: 0, cost: 0 }
      }
      
      const hours = (record.st_hours || 0) + (record.ot_hours || 0)
      const wages = (record.st_wages || 0) + (record.ot_wages || 0)
      const burden = (record.st_wages || 0) * 0.28
      
      totals[category].hours += hours
      totals[category].cost += wages + burden
    }
  })
  
  console.log('\nManual aggregation results:')
  Object.entries(totals).forEach(([category, data]) => {
    const rate = data.hours > 0 ? data.cost / data.hours : 0
    console.log(`${category}: ${data.hours} hours, $${data.cost.toFixed(2)} cost, $${rate.toFixed(2)}/hr`)
  })
  
  // Step 4: Check if the function exists and its definition
  console.log('\n📊 Step 4: Check function existence')
  try {
    // Try calling with a dummy project ID to see if function exists
    const { error } = await supabase.rpc('get_composite_labor_rate', {
      p_project_id: '00000000-0000-0000-0000-000000000000',
      p_weeks_back: 1
    })
    
    if (error && error.code === '42883') {
      console.log('❌ Function does not exist!')
    } else {
      console.log('✅ Function exists')
    }
  } catch (e) {
    console.error('Function check error:', e)
  }
}

async function main() {
  await debugCompositeRate()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)