#!/usr/bin/env tsx

import { getTuesdayWeekEndingDate } from '../lib/utils/forecast-date-helpers'

console.log('🔍 Testing API Date Fix')
console.log('=' .repeat(60))

// Simulate what the API does now
const dbDates = ['2025-07-29', '2025-08-05', '2025-08-12', '2025-08-19']

console.log('📊 Database Tuesday → API Sunday conversion (with +1 day adjustment):')
dbDates.forEach(dbDate => {
  const tuesday = new Date(dbDate + 'T00:00:00.000Z')
  const sunday = getTuesdayWeekEndingDate(tuesday)
  sunday.setDate(sunday.getDate() + 1) // The fix we applied
  
  console.log(`${dbDate} (Tuesday) → ${sunday.toISOString().split('T')[0]} (Sunday adjusted)`)
})

console.log('\n✅ These should now match the frontend expectations:')
console.log('Frontend expects: 2025-08-04, 2025-08-11, 2025-08-18, 2025-08-25')