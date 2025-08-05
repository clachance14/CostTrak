import { format, endOfMonth, startOfMonth, parseISO, startOfWeek, parse } from 'date-fns'

/**
 * Get month key from a date in YYYY-MM format
 */
export function getMonthFromDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, 'yyyy-MM')
}

/**
 * Get month key from a week ending date (Sunday)
 * Uses the week's starting date (Monday) to determine the month
 * This ensures weeks are grouped by the month they primarily belong to
 */
export function getMonthFromWeekEnding(weekEndingDate: Date | string): string {
  const dateObj = typeof weekEndingDate === 'string' ? parseISO(weekEndingDate) : weekEndingDate
  // Get the Monday of this week (week starts on Monday, ends on Sunday)
  const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 })
  return format(weekStart, 'yyyy-MM')
}

/**
 * Format a month key (YYYY-MM) to display format (e.g., "March 2025")
 */
export function formatMonth(monthKey: string): string {
  // Handle null/undefined values
  if (!monthKey) {
    return 'Unknown Month'
  }
  
  // Handle both YYYY-MM format and full date strings
  const parts = monthKey.split('-')
  if (parts.length >= 2) {
    // Use parse to avoid timezone issues with month parsing
    const date = parse(`${parts[0]}-${parts[1]}`, 'yyyy-MM', new Date())
    return format(date, 'MMMM yyyy')
  }
  return monthKey
}

/**
 * Get the start and end dates for a month
 */
export function getMonthRange(monthKey: string): { start: Date; end: Date } {
  // Handle null/undefined values
  if (!monthKey) {
    const now = new Date()
    return {
      start: startOfMonth(now),
      end: endOfMonth(now)
    }
  }
  
  const parts = monthKey.split('-')
  if (parts.length >= 2) {
    const date = new Date(`${parts[0]}-${parts[1]}-01`)
    return {
      start: startOfMonth(date),
      end: endOfMonth(date)
    }
  }
  // Fallback for invalid format
  const now = new Date()
  return {
    start: startOfMonth(now),
    end: endOfMonth(now)
  }
}

/**
 * Sort month keys chronologically
 */
export function sortMonthKeys(monthKeys: string[]): string[] {
  return monthKeys.sort((a, b) => {
    const dateA = new Date(`${a}-01`)
    const dateB = new Date(`${b}-01`)
    return dateA.getTime() - dateB.getTime()
  })
}

/**
 * Get a display string for month with item count
 */
export function formatMonthWithCount(monthKey: string, count: number): string {
  const monthDisplay = formatMonth(monthKey)
  const weekText = count === 1 ? 'week' : 'weeks'
  return `${monthDisplay} (${count} ${weekText})`
}