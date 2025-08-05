#!/usr/bin/env tsx
/**
 * Debug why forecast dates aren't matching
 */

import { getTuesdayWeekEndingDate } from '../lib/utils/forecast-date-helpers'

function debugDateMatching() {
  console.log('🔍 Debugging Forecast Date Matching')
  console.log('=' .repeat(60))
  
  // From the console logs, the API returns dates like this:
  const apiWeekEnding = '2025-08-04T04:59:59.999Z'
  
  // The frontend generates dates like this:
  const frontendWeekDate = new Date('2025-08-04') // Sunday
  
  console.log('\n📊 API vs Frontend date comparison:')
  console.log('API weekEnding:', apiWeekEnding)
  console.log('Frontend week date:', frontendWeekDate.toISOString())
  
  // How the frontend compares them:
  const apiDateOnly = new Date(apiWeekEnding).toISOString().split('T')[0]
  const frontendDateOnly = frontendWeekDate.toISOString().split('T')[0]
  
  console.log('\nDate-only comparison:')
  console.log('API date-only:', apiDateOnly)
  console.log('Frontend date-only:', frontendDateOnly)
  console.log('Match:', apiDateOnly === frontendDateOnly ? '✅' : '❌')
  
  // The issue: API returns 2025-08-04T04:59:59.999Z which is actually Aug 3 in some timezones!
  console.log('\n⚠️  Timezone issue:')
  const apiDate = new Date(apiWeekEnding)
  console.log('API date in UTC:', apiDate.toUTCString())
  console.log('API date in local time:', apiDate.toString())
  console.log('Date only from API date:', apiDate.toISOString().split('T')[0])
  
  // Test with the actual database dates
  console.log('\n📊 Testing with actual forecast dates:')
  const dbDates = [
    '2025-07-29', // Tuesday
    '2025-08-05', // Tuesday
    '2025-08-12', // Tuesday
    '2025-08-19'  // Tuesday
  ]
  
  dbDates.forEach(dateStr => {
    const tuesdayDate = new Date(dateStr + 'T00:00:00')
    const sundayEnd = getTuesdayWeekEndingDate(tuesdayDate)
    
    // What the API would return
    const apiFormat = sundayEnd.toISOString()
    
    // What the frontend expects (Sunday date-only)
    const expectedSunday = new Date(sundayEnd)
    expectedSunday.setUTCHours(0, 0, 0, 0)
    
    console.log(`\n${dateStr} (Tuesday):`)
    console.log(`  API would return: ${apiFormat}`)
    console.log(`  Date-only: ${apiFormat.split('T')[0]}`)
    console.log(`  Frontend expects: ${expectedSunday.toISOString().split('T')[0]}`)
    console.log(`  Match: ${apiFormat.split('T')[0] === expectedSunday.toISOString().split('T')[0] ? '✅' : '❌'}`)
  })
}

debugDateMatching()