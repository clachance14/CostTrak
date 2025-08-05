#!/usr/bin/env tsx

import { getTuesdayWeekStartingDate } from '../lib/utils/forecast-date-helpers'

console.log('Testing date range generation for headcount query')
console.log('=' .repeat(60))

// Start date from logs
const startDate = new Date('2025-03-16T00:00:00.000Z')
const weeks: string[] = []

// Generate 78 weeks as shown in logs
for (let i = 0; i < 78; i++) {
  const weekDate = new Date(startDate)
  weekDate.setDate(startDate.getDate() + i * 7)
  const tuesday = getTuesdayWeekStartingDate(weekDate)
  weeks.push(tuesday.toISOString().split('T')[0])
}

console.log('First week:', weeks[0])
console.log('Last week:', weeks[weeks.length - 1])
console.log('Total weeks:', weeks.length)

// Check if the database dates fall within this range
const dbDates = ['2025-07-29', '2025-08-05', '2025-08-12', '2025-08-19']
console.log('\nChecking if DB dates are in range:')
dbDates.forEach(date => {
  const inRange = weeks.includes(date)
  console.log(`${date}: ${inRange ? '✅ In range' : '❌ Not in range'}`)
})

// Find which week numbers they would be
console.log('\nWeek positions:')
dbDates.forEach(date => {
  const index = weeks.indexOf(date)
  if (index >= 0) {
    console.log(`${date} is week ${index}`)
  }
})

// Show weeks around the expected dates
console.log('\nWeeks around July/August 2025:')
weeks.forEach((week, i) => {
  if (week.startsWith('2025-07') || week.startsWith('2025-08')) {
    console.log(`Week ${i}: ${week}`)
  }
})