import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, formatDate, formatDateTime, formatPercentage } from '../utils'

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'p-3')).toBe('p-3')
    })

    it('should handle conditional classes', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active')
    })

    it('should handle arrays of classes', () => {
      expect(cn(['base', 'text-sm'], 'font-bold')).toBe('base text-sm font-bold')
    })

    it('should handle undefined and null values', () => {
      expect(cn('base', undefined, null, 'end')).toBe('base end')
    })

    it('should merge tailwind classes properly', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })
  })

  describe('formatCurrency', () => {
    it('should format positive numbers as USD currency', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(1500000)).toBe('$1,500,000')
    })

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000')
    })

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0')
    })

    it('should round decimal values', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235')
      expect(formatCurrency(1234.49)).toBe('$1,234')
    })
  })

  describe('formatDate', () => {
    it('should format date strings correctly', () => {
      // Use UTC to avoid timezone issues
      const date1 = new Date('2025-01-15T00:00:00Z')
      const date2 = new Date('2025-12-25T00:00:00Z')
      expect(formatDate(date1.toISOString())).toMatch(/Jan 1[45], 2025/)
      expect(formatDate(date2.toISOString())).toMatch(/Dec 2[45], 2025/)
    })

    it('should format Date objects correctly', () => {
      const date = new Date('2025-06-30T12:00:00Z')
      const result = formatDate(date)
      // Allow for timezone differences
      expect(result).toMatch(/Jun (29|30), 2025/)
    })

    it('should handle ISO date strings', () => {
      const result = formatDate('2025-03-15T10:30:00Z')
      expect(result).toMatch(/Mar 1[45], 2025/)
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const dateStr = '2025-01-15T14:30:00'
      const result = formatDateTime(dateStr)
      expect(result).toContain('Jan 15, 2025')
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/)
    })

    it('should handle Date objects with time', () => {
      const date = new Date('2025-06-30T09:15:00')
      const result = formatDateTime(date)
      expect(result).toContain('Jun 30, 2025')
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/)
    })
  })

  describe('formatPercentage', () => {
    it('should format percentages with one decimal place', () => {
      expect(formatPercentage(10)).toBe('10.0%')
      expect(formatPercentage(85.5)).toBe('85.5%')
      expect(formatPercentage(99.99)).toBe('100.0%')
    })

    it('should handle negative percentages', () => {
      expect(formatPercentage(-15.5)).toBe('-15.5%')
    })

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0.0%')
    })

    it('should round to one decimal place', () => {
      expect(formatPercentage(33.333)).toBe('33.3%')
      expect(formatPercentage(66.666)).toBe('66.7%')
    })
  })
})