#!/usr/bin/env tsx
/**
 * Test why forecast headcount is showing 0
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

async function testForecastData() {
  console.log('🔍 Testing Forecast Data Display')
  console.log('=' .repeat(60))
  
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  
  // Get the actual forecast data
  console.log('\n📊 Checking actual forecast data in database:')
  const { data: forecasts } = await supabase
    .from('labor_headcount_forecasts')
    .select(`
      *,
      craft_types!inner(name, category)
    `)
    .eq('project_id', projectId)
    .order('week_starting')
    
  console.log(`Found ${forecasts?.length || 0} forecast records`)
  
  if (forecasts && forecasts.length > 0) {
    // Group by week
    const byWeek = new Map<string, any[]>()
    forecasts.forEach(f => {
      const week = f.week_starting.split('T')[0]
      if (!byWeek.has(week)) {
        byWeek.set(week, [])
      }
      byWeek.get(week)!.push(f)
    })
    
    console.log('\n📅 Forecast data by week:')
    Array.from(byWeek.entries()).forEach(([week, records]) => {
      console.log(`\nWeek starting ${week}:`)
      records.forEach(r => {
        console.log(`  ${r.craft_types.name} (${r.craft_types.category}): ${r.headcount}`)
      })
    })
  }
  
  // Now test what the API returns for the weeks with data
  console.log('\n📊 Testing headcount API for weeks with data:')
  const startDate = '2025-07-28' // Start from a week we know has data
  
  const response = await fetch(`http://localhost:3000/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=6&start_date=${startDate}`, {
    headers: {
      'Content-Type': 'application/json',
      // Add auth headers if needed
    }
  })
  
  if (response.ok) {
    const data = await response.json()
    console.log('\n✅ API Response:')
    console.log(`Weeks returned: ${data.weeks?.length || 0}`)
    
    if (data.weeks) {
      data.weeks.forEach((week: any) => {
        const hasData = week.entries?.some((e: any) => e.headcount > 0)
        if (hasData) {
          console.log(`\nWeek ${week.weekEnding}:`)
          week.entries.forEach((e: any) => {
            if (e.headcount > 0) {
              console.log(`  ${e.categoryName}: ${e.headcount}`)
            }
          })
        }
      })
    }
  }
  
  // The issue is likely that the frontend is requesting data starting from March 2025
  // but the forecast data starts from July 2025
  console.log('\n⚠️  Issue identified:')
  console.log('The frontend is requesting forecast data starting from March 2025')
  console.log('But the actual forecast data starts from July 29, 2025')
  console.log('The API returns 0 for weeks without data')
}

async function main() {
  await testForecastData()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)