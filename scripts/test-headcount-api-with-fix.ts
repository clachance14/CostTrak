#!/usr/bin/env tsx
/**
 * Test the headcount API with the date conversion fix
 */

import { getTuesdayWeekEndingDate } from '../lib/utils/forecast-date-helpers'

async function testHeadcountAPI() {
  console.log('🔍 Testing Headcount API with Date Fix')
  console.log('=' .repeat(60))
  
  // Test the date conversion first
  console.log('\n📊 Testing date conversion:')
  const testDates = [
    '2025-07-29', // Tuesday
    '2025-08-05', // Tuesday
    '2025-08-12', // Tuesday
    '2025-08-19'  // Tuesday
  ]
  
  testDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const weekEnding = getTuesdayWeekEndingDate(date)
    console.log(`${dateStr} (Tuesday) → ${weekEnding.toISOString().split('T')[0]} (Sunday)`)
  })
  
  // Now test the API
  const API_BASE = 'http://localhost:3000/api'
  const PROJECT_ID = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
  
  if (!AUTH_TOKEN) {
    console.log('\n⚠️  Note: No AUTH_TOKEN set, API test will be skipped')
    console.log('To test the API, set: AUTH_TOKEN=<your-token> npx tsx scripts/test-headcount-api-with-fix.ts')
    return
  }
  
  console.log('\n📊 Testing API response:')
  const startDate = '2025-07-20' // Start before the first forecast week
  
  try {
    const response = await fetch(
      `${API_BASE}/labor-forecasts/headcount?project_id=${PROJECT_ID}&weeks_ahead=8&start_date=${startDate}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      console.error(`❌ API failed (${response.status})`)
      return
    }
    
    const data = await response.json()
    console.log(`✅ API returned ${data.weeks?.length || 0} weeks`)
    
    // Check weeks with headcount data
    if (data.weeks) {
      data.weeks.forEach((week: any) => {
        const hasData = week.entries?.some((e: any) => e.headcount > 0)
        if (hasData) {
          const weekDate = new Date(week.weekEnding)
          console.log(`\nWeek ending ${weekDate.toISOString().split('T')[0]}:`)
          week.entries.forEach((e: any) => {
            if (e.headcount > 0) {
              console.log(`  ${e.categoryName}: ${e.headcount} headcount`)
            }
          })
        }
      })
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function main() {
  await testHeadcountAPI()
  console.log('\n' + '='.repeat(60))
  console.log('✅ The date conversion fix should now show forecast data in the correct weeks')
}

main().catch(console.error)