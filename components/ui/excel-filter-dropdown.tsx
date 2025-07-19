'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown, ArrowUp, ArrowDown, RefreshCcw as RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc' | null

export interface FilterValue {
  value: string
  label: string
  count?: number
}

interface ExcelFilterDropdownProps {
  columnKey: string
  title: string
  values: FilterValue[]
  selectedValues: string[]
  onFilterChange: (values: string[]) => void
  sortDirection: SortDirection
  onSortChange: (direction: SortDirection) => void
  isLoading?: boolean
  className?: string
}

export function ExcelFilterDropdown({
  values,
  selectedValues,
  onFilterChange,
  sortDirection,
  onSortChange,
  isLoading = false,
  className
}: ExcelFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle SSR - ensure we only render portal after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dropdown position for fixed positioning
  const calculateDropdownPosition = (button: HTMLElement): { top: number; left: number } => {
    const buttonRect = button.getBoundingClientRect()
    const dropdownWidth = 256 // w-64 = 16rem = 256px
    const dropdownHeight = 400 // Approximate max height
    const viewportPadding = 8 // Minimum distance from viewport edge
    
    // Calculate vertical position
    const spaceBelow = window.innerHeight - buttonRect.bottom - viewportPadding
    const spaceAbove = buttonRect.top - viewportPadding
    
    let top = buttonRect.bottom + 4 // Default: below button with small gap
    
    // If not enough space below and more space above, position above
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      top = buttonRect.top - dropdownHeight - 4
    }
    
    // Calculate horizontal position
    let left = buttonRect.left
    
    // Check if dropdown would overflow right edge
    if (left + dropdownWidth > window.innerWidth - viewportPadding) {
      // Align to right edge of button or viewport
      left = Math.max(
        viewportPadding,
        Math.min(
          buttonRect.right - dropdownWidth,
          window.innerWidth - dropdownWidth - viewportPadding
        )
      )
    }
    
    // Check if dropdown would overflow left edge
    if (left < viewportPadding) {
      left = viewportPadding
    }
    
    return { top, left }
  }

  // Close dropdown when clicking outside or on scroll
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      // Check if click is outside both the button container and the dropdown
      const isOutsideButton = containerRef.current && !containerRef.current.contains(event.target as Node)
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      
      if (isOutsideButton && isOutsideDropdown) {
        setIsOpen(false)
        setSearchTerm('')
        setDropdownPosition(null)
      }
    }

    function handleScroll(event: Event) {
      // Check if scroll is from within the dropdown
      if (dropdownRef.current && event.target && dropdownRef.current.contains(event.target as Node)) {
        return // Don't close on internal scroll
      }
      
      // Only close on external scroll (table, page, etc.)
      setIsOpen(false)
      setSearchTerm('')
      setDropdownPosition(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true) // Capture phase to catch all scroll events
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  // Handle dropdown toggle
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      // Calculate position before opening
      const position = calculateDropdownPosition(buttonRef.current)
      setDropdownPosition(position)
      setIsOpen(true)
    } else {
      setIsOpen(false)
      setSearchTerm('')
      setDropdownPosition(null)
    }
  }

  // Filter values based on search term
  const filteredValues = useMemo(() => {
    if (!searchTerm) return values
    return values.filter(item => 
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [values, searchTerm])

  // Check if all filtered values are selected
  const isAllSelected = filteredValues.length > 0 && 
    filteredValues.every(item => selectedValues.includes(item.value))
  
  const isPartiallySelected = filteredValues.some(item => selectedValues.includes(item.value)) && !isAllSelected

  const handleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all filtered values
      const valuesToRemove = new Set(filteredValues.map(item => item.value))
      onFilterChange(selectedValues.filter(value => !valuesToRemove.has(value)))
    } else {
      // Select all filtered values
      const allFilteredValues = filteredValues.map(item => item.value)
      const newSelectedValues = [...new Set([...selectedValues, ...allFilteredValues])]
      onFilterChange(newSelectedValues)
    }
  }

  const handleValueToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onFilterChange(selectedValues.filter(v => v !== value))
    } else {
      onFilterChange([...selectedValues, value])
    }
  }

  const handleSort = (direction: SortDirection) => {
    onSortChange(direction)
  }

  const clearFilters = () => {
    onFilterChange([])
    onSortChange(null)
  }

  const hasActiveFilters = selectedValues.length > 0 && selectedValues.length < values.length
  const hasActiveSort = sortDirection !== null

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 w-6 p-0 hover:bg-foreground/10",
          (hasActiveFilters || hasActiveSort) ? "text-blue-600" : "text-foreground"
        )}
        onClick={handleToggle}
      >
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          isOpen ? "rotate-180" : "",
          (hasActiveFilters || hasActiveSort) ? "text-blue-600" : "text-foreground"
        )} />
      </Button>

      {mounted && isOpen && dropdownPosition && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] w-64 bg-white border border-foreground/30 rounded-md shadow-xl transition-opacity duration-150 ease-in-out"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          {/* Sort Section */}
          <div className="p-2 border-b border-foreground/20">
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs hover:bg-foreground/5"
                onClick={() => handleSort('asc')}
              >
                <ArrowUp className="h-3 w-3 mr-2" />
                Sort A to Z
                {sortDirection === 'asc' && <Check className="h-3 w-3 ml-auto" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs hover:bg-foreground/5"
                onClick={() => handleSort('desc')}
              >
                <ArrowDown className="h-3 w-3 mr-2" />
                Sort Z to A
                {sortDirection === 'desc' && <Check className="h-3 w-3 ml-auto" />}
              </Button>
              {(hasActiveSort || hasActiveFilters) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs hover:bg-foreground/5 text-orange-600"
                  onClick={clearFilters}
                >
                  <RotateCcw className="h-3 w-3 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Search Section */}
          <div className="p-2 border-b border-foreground/20">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
              <Input
                type="text"
                placeholder="Search (All)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>

          {/* Values Section */}
          <div className="max-h-60 overflow-y-auto">
            {/* Select All */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-background p-1 rounded"
                onClick={handleSelectAll}
              >
                <div className={cn(
                  "h-4 w-4 border rounded flex items-center justify-center",
                  isAllSelected 
                    ? "bg-blue-600 border-blue-600" 
                    : isPartiallySelected
                    ? "bg-blue-200 border-blue-400"
                    : "border-foreground/30"
                )}>
                  {isAllSelected && <Check className="h-3 w-3 text-white" />}
                  {isPartiallySelected && !isAllSelected && (
                    <div className="h-2 w-2 bg-blue-600 rounded-sm" />
                  )}
                </div>
                <span className="text-xs font-medium text-foreground/80">
                  (Select All)
                </span>
              </div>
            </div>

            {/* Value List */}
            <div className="py-1">
              {isLoading ? (
                <div className="px-3 py-2 text-xs text-foreground/60">Loading...</div>
              ) : filteredValues.length === 0 ? (
                <div className="px-3 py-2 text-xs text-foreground/60">No items found</div>
              ) : (
                filteredValues.map((item) => (
                  <div
                    key={item.value}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-background cursor-pointer"
                    onClick={() => handleValueToggle(item.value)}
                  >
                    <div className={cn(
                      "h-4 w-4 border rounded flex items-center justify-center",
                      selectedValues.includes(item.value)
                        ? "bg-blue-600 border-blue-600"
                        : "border-foreground/30"
                    )}>
                      {selectedValues.includes(item.value) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xs text-foreground/80 flex-1">
                      {item.label || "(Blank)"}
                    </span>
                    {item.count !== undefined && (
                      <span className="text-xs text-foreground">
                        ({item.count})
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 p-2 border-t border-foreground/20">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => {
                setIsOpen(false)
                setSearchTerm('')
                setDropdownPosition(null)
              }}
            >
              OK
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => {
                setIsOpen(false)
                setSearchTerm('')
                setDropdownPosition(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}