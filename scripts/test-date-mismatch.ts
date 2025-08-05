#!/usr/bin/env tsx

import { getTuesdayWeekEndingDate } from '../lib/utils/forecast-date-helpers'

console.log('🔍 Testing Date Mismatch Issue')
console.log('=' .repeat(60))

// The issue: database has Tuesday dates, API converts to Sunday,
// but frontend expects a different Sunday

const dbTuesday = '2025-07-29' // Tuesday from database
const dbDate = new Date(dbTuesday + 'T00:00:00')
const sundayEnd = getTuesdayWeekEndingDate(dbDate)

console.log('\nDatabase Tuesday:', dbTuesday)
console.log('Converted to Sunday:', sundayEnd.toISOString())
console.log('Sunday date only:', sundayEnd.toISOString().split('T')[0])

// The frontend is looking for 2025-08-04, but we're getting 2025-08-03
console.log('\n❌ Frontend expects: 2025-08-04')
console.log('❌ API returns: 2025-08-03')

// The problem: timezone conversion
console.log('\n🕐 Timezone analysis:')
console.log('new Date("2025-07-29T00:00:00"):', new Date("2025-07-29T00:00:00"))
console.log('toISOString():', new Date("2025-07-29T00:00:00").toISOString())
console.log('Note: T00:00:00 in local time becomes T05:00:00.000Z in UTC')

// Solution: The frontend is generating weeks ending on Sunday Aug 4, Aug 11, etc.
// But the API is returning weeks ending on Sunday Aug 3, Aug 10, etc.
// This is a one-day offset issue

console.log('\n📊 Frontend week generation vs API response:')
const frontendWeeks = ['2025-08-04', '2025-08-11', '2025-08-18', '2025-08-25']
const apiWeeks = ['2025-08-03', '2025-08-10', '2025-08-17', '2025-08-24']

frontendWeeks.forEach((fw, i) => {
  console.log(`Frontend: ${fw} | API: ${apiWeeks[i]} | Match: ${fw === apiWeeks[i] ? '✅' : '❌'}`)
})

console.log('\n💡 Root cause: The frontend and API are using different timezone handling')
console.log('Frontend uses local timezone, API uses UTC, causing 1-day offset')