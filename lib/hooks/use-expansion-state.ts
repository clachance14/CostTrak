import { useState, useEffect, useCallback } from 'react'

interface UseExpansionStateOptions {
  storageKey: string
  defaultExpanded?: boolean
}

export function useExpansionState({ storageKey, defaultExpanded = false }: UseExpansionStateOptions) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set()
    }
    
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading expansion state:', error)
    }
    
    return new Set()
  })
  
  const [allExpanded, setAllExpanded] = useState(defaultExpanded)

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(expandedItems)))
    } catch (error) {
      console.error('Error saving expansion state:', error)
    }
  }, [expandedItems, storageKey])

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      setAllExpanded(false)
      return next
    })
  }, [])

  const expandAll = useCallback((allItemIds: string[]) => {
    setExpandedItems(new Set(allItemIds))
    setAllExpanded(true)
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedItems(new Set())
    setAllExpanded(false)
  }, [])

  const isExpanded = useCallback((itemId: string) => {
    return expandedItems.has(itemId)
  }, [expandedItems])

  return {
    expandedItems,
    allExpanded,
    toggleItem,
    expandAll,
    collapseAll,
    isExpanded
  }
}