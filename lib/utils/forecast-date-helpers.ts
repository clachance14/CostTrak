/**
 * Date helpers specifically for forecast data which uses Tuesday as week start
 */

import { endOfWeek, startOfWeek } from 'date-fns'

/**
 * Convert a Tuesday week_starting date to Sunday week_ending date
 * Database stores week_starting as Tuesday, UI shows week_ending as Sunday
 */
export function getTuesdayWeekEndingDate(date: Date): Date {
  // For a Tuesday, the week ending Sunday is 5 days later
  const sundayEnd = new Date(date)
  sundayEnd.setDate(date.getDate() + 5)
  // Normalize to midnight in UTC to ensure consistent date comparisons
  sundayEnd.setUTCHours(0, 0, 0, 0)
  
  return sundayEnd
}

/**
 * Convert a Sunday week_ending date to Tuesday week_starting date
 * Used when querying database from UI Sunday dates
 */
export function getSundayWeekStartingDate(sundayDate: Date): Date {
  // Sunday's corresponding Tuesday is 5 days before
  const tuesday = new Date(sundayDate)
  tuesday.setDate(sundayDate.getDate() - 5)
  // Normalize to midnight in UTC
  tuesday.setUTCHours(0, 0, 0, 0)
  
  return tuesday
}

/**
 * Get the Tuesday week starting date for any given date
 * Database stores all forecast data with Tuesday as week start
 */
export function getTuesdayWeekStartingDate(date: Date): Date {
  // Get the day of week (0 = Sunday, 2 = Tuesday)
  const dayOfWeek = date.getDay()
  
  // Calculate days to subtract to get to previous Tuesday
  let daysToSubtract = dayOfWeek - 2 // 2 is Tuesday
  if (daysToSubtract < 0) {
    daysToSubtract += 7 // Go to previous week's Tuesday
  }
  
  const tuesday = new Date(date)
  tuesday.setDate(date.getDate() - daysToSubtract)
  tuesday.setHours(0, 0, 0, 0)
  
  return tuesday
}

/**
 * Check if a week_starting date has a corresponding week_ending date
 */
export function doWeeksMatch(weekStarting: Date, weekEnding: Date): boolean {
  const expectedEnding = getTuesdayWeekEndingDate(weekStarting)
  return expectedEnding.toISOString().split('T')[0] === weekEnding.toISOString().split('T')[0]
}

/**
 * Normalize a date string to ensure consistent date comparisons
 * Handles timezone issues by parsing date as UTC midnight
 */
export function normalizeDateString(dateStr: string): string {
  // If already in ISO format with time, extract just the date part
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0]
  }
  
  // Create date at UTC midnight to avoid timezone shifts
  const date = new Date(dateStr + 'T00:00:00.000Z')
  return date.toISOString().split('T')[0]
}