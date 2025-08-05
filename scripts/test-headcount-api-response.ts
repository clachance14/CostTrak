#!/usr/bin/env tsx
/**
 * Test the headcount forecast API to see the response structure
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

async function testHeadcountData() {
  console.log('🔍 Testing Headcount Forecast Data')
  console.log('=' .repeat(60))
  
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  
  // Check if we have headcount forecast data
  console.log('\n📊 Checking labor_headcount_forecasts table:')
  const { data: headcounts, error } = await supabase
    .from('labor_headcount_forecasts')
    .select(`
      *,
      craft_types!inner(
        id,
        name,
        category
      )
    `)
    .eq('project_id', projectId)
    .order('week_starting', { ascending: true })
    .limit(10)
    
  if (error) {
    console.error('❌ Error:', error)
    return
  }
  
  console.log(`Found ${headcounts?.length || 0} headcount forecast records`)
  
  if (headcounts && headcounts.length > 0) {
    console.log('\n📋 Sample records:')
    headcounts.forEach(hc => {
      console.log(`\n- Week: ${hc.week_starting}`)
      console.log(`  Craft Type: ${hc.craft_types.name} (${hc.craft_types.category})`)
      console.log(`  Headcount: ${hc.headcount}`)
      console.log(`  Weekly Hours: ${hc.weekly_hours}`)
    })
    
    // Group by week to see distribution
    console.log('\n📅 Headcount by Week:')
    const byWeek = new Map<string, any[]>()
    headcounts.forEach(hc => {
      const week = hc.week_starting.split('T')[0]
      if (!byWeek.has(week)) {
        byWeek.set(week, [])
      }
      byWeek.get(week)!.push(hc)
    })
    
    Array.from(byWeek.entries()).sort().forEach(([week, records]) => {
      console.log(`\nWeek ${week}:`)
      const byCategory = { direct: 0, indirect: 0, staff: 0 }
      records.forEach(r => {
        const category = r.craft_types.category
        if (category in byCategory) {
          byCategory[category as keyof typeof byCategory] += r.headcount
        }
      })
      console.log(`  Direct: ${byCategory.direct}`)
      console.log(`  Indirect: ${byCategory.indirect}`)
      console.log(`  Staff: ${byCategory.staff}`)
    })
  }
  
  // Test the headcount API endpoint format
  console.log('\n📊 Testing get_headcount_category_rates function:')
  const { data: rates, error: ratesError } = await supabase.rpc('get_headcount_category_rates', {
    p_project_id: projectId,
    p_weeks_back: 8
  })
  
  if (ratesError) {
    console.error('❌ Rates error:', ratesError)
  } else {
    console.log('✅ Category rates:')
    rates?.forEach((r: any) => {
      console.log(`  ${r.category}: $${r.avg_rate}/hr`)
    })
  }
}

async function main() {
  await testHeadcountData()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)