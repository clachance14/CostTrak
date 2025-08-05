'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { Input, InputProps } from './input'
import { measureFormatters } from '@/lib/utils/pivot-helpers'

export interface CurrencyInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange'> {
  value?: number | null
  onChange?: (value: number | null) => void
  allowNegative?: boolean
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, allowNegative = true, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [localValue, setLocalValue] = React.useState('')

    // Update local value when prop value changes
    React.useEffect(() => {
      if (!isFocused) {
        setLocalValue(value !== null && value !== undefined ? String(value) : '')
      }
    }, [value, isFocused])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      // Set raw number value for editing
      setLocalValue(value !== null && value !== undefined ? String(value) : '')
      // Select all text for easy replacement
      setTimeout(() => e.target.select(), 0)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setLocalValue(inputValue)

      // Allow empty input
      if (inputValue === '') {
        onChange?.(null)
        return
      }

      // Parse the number
      const parsed = parseFloat(inputValue)
      
      // Check if it's a valid number
      if (!isNaN(parsed)) {
        // Check negative constraint
        if (!allowNegative && parsed < 0) {
          return
        }
        onChange?.(parsed)
      }
    }

    // Display value - formatted when not focused, raw when focused
    const displayValue = React.useMemo(() => {
      if (isFocused) {
        return localValue
      }
      
      if (value === null || value === undefined) {
        return ''
      }
      
      // Format as currency when not focused
      return measureFormatters.currency(value)
    }, [isFocused, localValue, value])

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn('text-right', className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

export { CurrencyInput }