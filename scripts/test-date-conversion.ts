#!/usr/bin/env tsx
/**
 * Test date conversion between week_starting and week_ending
 */

import { endOfWeek, startOfWeek, format } from 'date-fns'

// From the codebase
const getWeekEndingDate = (date: Date): Date => {
  return endOfWeek(date, { weekStartsOn: 1 }) // Monday start = Sunday end
}

const getWeekStartingDate = (date: Date): Date => {
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekEnd.getDate() - 6) // 6 days before Sunday is Monday
  return weekStart
}

function testDateConversions() {
  console.log('🔍 Testing Date Conversions')
  console.log('=' .repeat(60))
  
  // Test with the actual database dates
  const databaseDates = [
    '2025-07-29', // Tuesday
    '2025-08-05', // Tuesday
    '2025-08-12', // Tuesday
    '2025-08-19'  // Tuesday
  ]
  
  console.log('\n📊 Database week_starting (Tuesday) → week_ending (Sunday):')
  databaseDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const weekEnding = getWeekEndingDate(date)
    
    console.log(`\n${dateStr} (${format(date, 'EEEE')}) → ${format(weekEnding, 'yyyy-MM-dd')} (${format(weekEnding, 'EEEE')})`)
    
    // What the UI expects
    const expectedSunday = new Date(date)
    expectedSunday.setDate(date.getDate() + (7 - date.getDay())) // Next Sunday
    console.log(`Expected Sunday: ${format(expectedSunday, 'yyyy-MM-dd')}`)
    
    // Check if they match
    const match = weekEnding.toISOString().split('T')[0] === expectedSunday.toISOString().split('T')[0]
    console.log(`Match: ${match ? '✅' : '❌'}`)
  })
  
  // Test reverse conversion
  console.log('\n\n📊 UI week_ending (Sunday) → week_starting (for database query):')
  const uiDates = [
    '2025-08-03', // Sunday (Aug 03 from UI)
    '2025-08-10', // Sunday
    '2025-08-17', // Sunday
    '2025-08-24'  // Sunday
  ]
  
  uiDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    const weekStarting = getWeekStartingDate(date)
    
    console.log(`\n${dateStr} (${format(date, 'EEEE')}) → ${format(weekStarting, 'yyyy-MM-dd')} (${format(weekStarting, 'EEEE')})`)
    
    // What we need for database query (Tuesday)
    const expectedTuesday = new Date(date)
    expectedTuesday.setDate(date.getDate() - 5) // 5 days before Sunday is Tuesday
    console.log(`Expected Tuesday: ${format(expectedTuesday, 'yyyy-MM-dd')}`)
    
    // Check if they match
    const match = weekStarting.toISOString().split('T')[0] === expectedTuesday.toISOString().split('T')[0]
    console.log(`Match to DB: ${match ? '✅' : '❌'}`)
  })
  
  // Test what happens with different week configurations
  console.log('\n\n📊 Different week start configurations:')
  const testDate = new Date('2025-07-29T00:00:00') // Tuesday
  
  // Standard JS week (Sunday = 0)
  const sundayEnd = endOfWeek(testDate) // Default Sunday to Saturday
  console.log(`\nDefault endOfWeek: ${format(sundayEnd, 'yyyy-MM-dd EEEE')}`)
  
  // Monday start week (Monday = 1)
  const sundayEndMondayStart = endOfWeek(testDate, { weekStartsOn: 1 })
  console.log(`Monday start endOfWeek: ${format(sundayEndMondayStart, 'yyyy-MM-dd EEEE')}`)
  
  // Tuesday start week (Tuesday = 2)
  const mondayEndTuesdayStart = endOfWeek(testDate, { weekStartsOn: 2 })
  console.log(`Tuesday start endOfWeek: ${format(mondayEndTuesdayStart, 'yyyy-MM-dd EEEE')}`)
}

testDateConversions()