#!/usr/bin/env tsx

import { getTuesdayWeekEndingDate, getTuesdayWeekStartingDate, getSundayWeekStartingDate } from '../lib/utils/forecast-date-helpers'
import { getWeekEndingDate } from '../lib/validations/labor-forecast-v2'

console.log('🔍 Testing Complete Date Flow')
console.log('=' .repeat(60))

// Simulate what happens in the database
const dbTuesday = '2025-07-29' // Tuesday from database
console.log('\n📊 Database has Tuesday:', dbTuesday)

// What the API does
const dbDate = new Date(dbTuesday + 'T00:00:00.000Z')
const apiSunday = getTuesdayWeekEndingDate(dbDate)
console.log('API converts to Sunday:', apiSunday.toISOString())
console.log('API returns date:', apiSunday.toISOString().split('T')[0])

// What the frontend does
const today = new Date('2025-03-16')
const frontendSunday = getWeekEndingDate(today)
console.log('\n📊 Frontend generates Sunday from today:', frontendSunday.toISOString())

// The real issue: frontend is generating dates differently
console.log('\n🔍 Testing frontend week generation for July/August:')
// Frontend would generate these Sundays
const testDate = new Date('2025-07-28') // A Monday
for (let i = 0; i < 5; i++) {
  const weekDate = new Date(testDate)
  weekDate.setDate(testDate.getDate() + i * 7)
  const sunday = getWeekEndingDate(weekDate)
  console.log(`Week ${i}: Input ${weekDate.toISOString().split('T')[0]} → Sunday ${sunday.toISOString().split('T')[0]}`)
}

// The fix: we need to ensure the API returns the same Sunday the frontend expects
console.log('\n💡 Solution: Adjust the date conversion to account for timezone')
const fixedDbDate = new Date(dbTuesday) // This creates in local timezone
const fixedSunday = new Date(fixedDbDate)
fixedSunday.setDate(fixedDbDate.getDate() + 5) // Add 5 days to get to Sunday
console.log('Fixed conversion:', fixedSunday.toISOString().split('T')[0])

// Test the actual helper function with proper timezone handling
console.log('\n📊 Testing fixed getTuesdayWeekEndingDate:')
const testTuesday = new Date(dbTuesday + 'T00:00:00') // Parse in local time
const resultSunday = getTuesdayWeekEndingDate(testTuesday)
console.log('Input Tuesday (local):', testTuesday.toString())
console.log('Output Sunday (UTC):', resultSunday.toISOString())
console.log('Output Sunday (date only):', resultSunday.toISOString().split('T')[0])