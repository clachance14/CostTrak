// Test helper utilities for scripts

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function parseWeekString(weekString: string): Date {
  // Parse week string like "2024-W01" 
  const [year, week] = weekString.split('-W')
  const date = new Date(parseInt(year), 0, 1)
  const dayOfWeek = date.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setDate(date.getDate() + daysToMonday + (parseInt(week) - 1) * 7)
  return date
}

export function getWeekEndingDate(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? 0 : 7 - day // Days until Sunday
  const weekEnding = new Date(date)
  weekEnding.setDate(date.getDate() + diff)
  return weekEnding
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function generateTestData(count: number): any[] {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      name: `Test Item ${i + 1}`,
      value: Math.random() * 10000,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    })
  }
  return data
}