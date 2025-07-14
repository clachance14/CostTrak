'use client'

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { ExcelFilterDropdown } from './excel-filter-dropdown'
import type { SortDirection } from './excel-filter-dropdown'

export type { SortDirection }

interface ColumnFilter {
  column: string
  values: string[]
}

interface SortableTableHeaderProps {
  children: React.ReactNode
  sortKey: string
  currentSort: { field: string | null; direction: SortDirection }
  onSort: (field: string) => void
  // Filter props
  filterable?: boolean
  currentFilters: ColumnFilter[]
  onFilterChange: (column: string, values: string[]) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function SortableTableHeader({
  children,
  sortKey,
  currentSort,
  onSort,
  filterable = false,
  currentFilters,
  onFilterChange,
  className,
  align = 'left'
}: SortableTableHeaderProps) {
  const isActive = currentSort.field === sortKey
  const direction = isActive ? currentSort.direction : null

  // Get current filter for this column
  const currentFilter = currentFilters.find(f => f.column === sortKey)
  const selectedValues = currentFilter?.values || []

  // Fetch distinct values for this column when filterable
  const { data: distinctValuesData, isLoading: isLoadingValues } = useQuery({
    queryKey: ['distinct-values', sortKey],
    queryFn: async () => {
      // Determine which API to call based on the current page
      const isPurchaseOrdersPage = window.location.pathname.includes('purchase-orders')
      const apiPath = isPurchaseOrdersPage 
        ? `/api/purchase-orders/distinct-values?column=${sortKey}`
        : `/api/projects/distinct-values?column=${sortKey}`
      
      const response = await fetch(apiPath)
      if (!response.ok) {
        throw new Error('Failed to fetch distinct values')
      }
      return response.json()
    },
    enabled: filterable
  })

  const getSortIcon = () => {
    if (!isActive || direction === null) {
      return <ArrowUpDown className="h-4 w-4 text-foreground" />
    }
    if (direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />
  }

  const getTextAlignment = () => {
    switch (align) {
      case 'center':
        return 'text-center'
      case 'right':
        return 'text-right'
      default:
        return 'text-left'
    }
  }

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Don't trigger sort when clicking on filter dropdown
    if (filterable && e.target !== e.currentTarget) {
      return
    }
    onSort(sortKey)
  }

  const handleFilterChange = (values: string[]) => {
    onFilterChange(sortKey, values)
  }

  const handleSortChange = (newDirection: SortDirection) => {
    if (newDirection !== direction) {
      onSort(sortKey)
    }
  }

  return (
    <th
      className={cn(
        'px-6 py-3 text-xs font-medium text-foreground uppercase tracking-wider select-none transition-colors relative',
        !filterable && 'cursor-pointer hover:bg-foreground/5',
        getTextAlignment(),
        className
      )}
      onClick={handleHeaderClick}
    >
      <div className={cn(
        'flex items-center gap-2',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}>
        <span className={filterable ? 'cursor-pointer' : ''} onClick={() => !filterable && onSort(sortKey)}>
          {children}
        </span>
        
        <div className="flex items-center gap-1">
          {!filterable && getSortIcon()}
          
          {filterable && (
            <ExcelFilterDropdown
              columnKey={sortKey}
              title={children as string}
              values={distinctValuesData?.values || []}
              selectedValues={selectedValues}
              onFilterChange={handleFilterChange}
              sortDirection={direction}
              onSortChange={handleSortChange}
              isLoading={isLoadingValues}
            />
          )}
        </div>
      </div>
    </th>
  )
}