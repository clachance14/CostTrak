'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Calendar, DollarSign, Funnel, X, Check, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TextFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TextFilter({ value, onChange, placeholder = "Funnel...", className }: TextFilterProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pl-7 h-9 text-xs", className)}
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          onClick={() => onChange('')}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

interface DateRangeFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  className?: string
}

export function DateRangeFilter({ 
  dateFrom, 
  dateTo, 
  onDateFromChange, 
  onDateToChange, 
  className 
}: DateRangeFilterProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="pl-7 h-9 text-xs"
          placeholder="From date"
        />
      </div>
      <div className="relative">
        <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="pl-7 h-9 text-xs"
          placeholder="To date"
        />
      </div>
    </div>
  )
}

interface CurrencyRangeFilterProps {
  minAmount: string
  maxAmount: string
  onMinAmountChange: (value: string) => void
  onMaxAmountChange: (value: string) => void
  className?: string
}

export function CurrencyRangeFilter({
  minAmount,
  maxAmount,
  onMinAmountChange,
  onMaxAmountChange,
  className
}: CurrencyRangeFilterProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
        <Input
          type="number"
          placeholder="Min amount"
          value={minAmount}
          onChange={(e) => onMinAmountChange(e.target.value)}
          className="pl-7 h-9 text-xs"
        />
      </div>
      <div className="relative">
        <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
        <Input
          type="number"
          placeholder="Max amount"
          value={maxAmount}
          onChange={(e) => onMaxAmountChange(e.target.value)}
          className="pl-7 h-9 text-xs"
        />
      </div>
    </div>
  )
}

interface MultiSelectFilterProps {
  options: { value: string; label: string }[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelectFilter({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
  className
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleOption = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]
    onChange(newValues)
  }

  const clearAll = () => onChange([])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant="outline"
        className={cn(
          "h-9 w-full justify-between text-xs min-w-[140px] bg-white hover:bg-background",
          selectedValues.length > 0 ? "border-blue-300 bg-blue-50" : "border-foreground/30"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Funnel className={cn(
            "h-3 w-3",
            selectedValues.length > 0 ? "text-blue-600" : "text-foreground"
          )} />
          <span className={cn(
            selectedValues.length > 0 ? "text-blue-900 font-medium" : "text-foreground/70"
          )}>
            {selectedValues.length === 0 
              ? placeholder 
              : `${selectedValues.length} selected`
            }
          </span>
        </div>
        <div className="flex items-center gap-1">
          {selectedValues.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-blue-200 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                clearAll()
              }}
            >
              <X className="h-3 w-3 text-blue-600" />
            </Button>
          )}
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            isOpen ? "rotate-180" : "",
            selectedValues.length > 0 ? "text-blue-600" : "text-foreground"
          )} />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full min-w-[140px] bg-white border border-foreground/30 rounded-md shadow-xl max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs hover:bg-foreground/5 text-foreground/80"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          </div>
          <div className="py-1">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => handleToggleOption(option.value)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center flex-shrink-0",
                    selectedValues.includes(option.value)
                      ? "bg-blue-600 border-blue-600"
                      : "border-foreground/30 hover:border-blue-400"
                  )}>
                    {selectedValues.includes(option.value) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm select-none",
                    selectedValues.includes(option.value) 
                      ? "text-blue-900 font-medium" 
                      : "text-foreground/80"
                  )}>
                    {option.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}