#!/usr/bin/env tsx
/**
 * Test Tuesday week generation
 */

import { getTuesdayWeekStartingDate } from '../lib/utils/forecast-date-helpers'

function testTuesdayWeekGeneration() {
  console.log('🔍 Testing Tuesday Week Generation')
  console.log('=' .repeat(60))
  
  // Test various dates to ensure they map to correct Tuesday
  const testDates = [
    '2025-07-27', // Sunday → should go to July 29 (Tuesday)
    '2025-07-28', // Monday → should go to July 29 (Tuesday)
    '2025-07-29', // Tuesday → should stay July 29
    '2025-07-30', // Wednesday → should go to July 29
    '2025-08-01', // Friday → should go to July 29
    '2025-08-03', // Sunday → should go to July 29
    '2025-08-04', // Monday → should go to Aug 5 (Tuesday)
    '2025-08-05', // Tuesday → should stay Aug 5
  ]
  
  console.log('\n📊 Date → Tuesday mapping:')
  testDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const tuesday = getTuesdayWeekStartingDate(date)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    const tuesdayName = tuesday.toLocaleDateString('en-US', { weekday: 'long' })
    
    console.log(`${dateStr} (${dayName}) → ${tuesday.toISOString().split('T')[0]} (${tuesdayName})`)
  })
  
  // Test the weeks that would be generated for a forecast starting March 16
  console.log('\n📊 Weeks generated from March 16, 2025:')
  const startDate = new Date('2025-03-16T00:00:00')
  
  for (let i = 0; i < 8; i++) {
    const weekDate = new Date(startDate)
    weekDate.setDate(startDate.getDate() + i * 7)
    const tuesday = getTuesdayWeekStartingDate(weekDate)
    
    console.log(`Week ${i}: ${tuesday.toISOString().split('T')[0]} (${tuesday.toLocaleDateString('en-US', { weekday: 'long' })})`)
  }
  
  // Check if the forecast weeks would include the database dates
  console.log('\n📊 Checking if generated weeks include database dates:')
  const dbDates = ['2025-07-29', '2025-08-05', '2025-08-12', '2025-08-19']
  const generatedWeeks = []
  
  // Generate many weeks to see when we hit the database dates
  for (let i = 0; i < 80; i++) {
    const weekDate = new Date(startDate)
    weekDate.setDate(startDate.getDate() + i * 7)
    const tuesday = getTuesdayWeekStartingDate(weekDate)
    generatedWeeks.push(tuesday.toISOString().split('T')[0])
  }
  
  dbDates.forEach(dbDate => {
    const weekIndex = generatedWeeks.indexOf(dbDate)
    if (weekIndex >= 0) {
      console.log(`✅ ${dbDate} found at week ${weekIndex}`)
    } else {
      console.log(`❌ ${dbDate} NOT FOUND in generated weeks`)
    }
  })
}

testTuesdayWeekGeneration()