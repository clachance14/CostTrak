#!/usr/bin/env tsx

import { getTuesdayWeekStartingDate } from '../lib/utils/forecast-date-helpers'

console.log('Testing query date format')
console.log('=' .repeat(60))

// Simulate what the API does
const startDate = new Date('2025-03-16T00:00:00.000Z')
const weeks = []

for (let i = 0; i < 78; i++) {
  const weekDate = new Date(startDate)
  weekDate.setDate(startDate.getDate() + i * 7)
  const weekStarting = getTuesdayWeekStartingDate(weekDate)
  weeks.push(weekStarting)
}

console.log('First week for query:')
console.log('- toISOString():', weeks[0].toISOString())
console.log('- Date only:', weeks[0].toISOString().split('T')[0])

console.log('\nLast week for query:')
console.log('- toISOString():', weeks[weeks.length - 1].toISOString())
console.log('- Date only:', weeks[weeks.length - 1].toISOString().split('T')[0])

// Check week 20 (where our data is)
console.log('\nWeek 20 (where forecast data exists):')
console.log('- toISOString():', weeks[20].toISOString())
console.log('- Date only:', weeks[20].toISOString().split('T')[0])

console.log('\nDatabase comparison:')
console.log('DB has: 2025-07-29T00:00:00+00')
console.log('Query gte:', weeks[0].toISOString())
console.log('Query lte:', weeks[weeks.length - 1].toISOString())
console.log('Should match? DB date is between query dates')