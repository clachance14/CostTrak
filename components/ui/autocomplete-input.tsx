"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Input } from './input'

interface AutocompleteOption {
  id: string
  label: string
  value: string
}

interface AutocompleteInputProps {
  value: string
  onChange: (value: string, option?: AutocompleteOption) => void
  options: AutocompleteOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  onCreateNew?: (value: string) => Promise<AutocompleteOption>
  isLoading?: boolean
  noOptionsText?: string
  createNewText?: string
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
  required,
  onCreateNew,
  isLoading = false,
  noOptionsText = "No options found",
  createNewText = "Create new",
  ...props
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>(options)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Filter options based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        option.value.toLowerCase().includes(inputValue.toLowerCase())
      )
      setFilteredOptions(filtered)
    }
    setHighlightedIndex(-1)
  }, [inputValue, options])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  const handleInputBlur = async () => {
    // Auto-create if user typed a value that doesn't exist
    if (onCreateNew && inputValue.trim() && 
        !filteredOptions.some(option => 
          option.label.toLowerCase() === inputValue.toLowerCase()
        )) {
      try {
        const newOption = await onCreateNew(inputValue.trim())
        setInputValue(newOption.label)
        onChange(newOption.label, newOption)
      } catch (error) {
        console.error('Error auto-creating option:', error)
      }
    }
    // Delay closing to allow option selection
    setTimeout(() => setIsOpen(false), 150)
  }

  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.label)
    onChange(option.label, option)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleCreateNew = async () => {
    if (onCreateNew && inputValue.trim()) {
      try {
        const newOption = await onCreateNew(inputValue.trim())
        setInputValue(newOption.label)
        onChange(newOption.label, newOption)
        setIsOpen(false)
        inputRef.current?.focus()
      } catch (error) {
        console.error('Error creating new option:', error)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        return
      }
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'ArrowDown':
        e.preventDefault()
        const maxIndex = filteredOptions.length + (onCreateNew && inputValue.trim() ? 0 : -1)
        setHighlightedIndex(prev => 
          prev < maxIndex ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionSelect(filteredOptions[highlightedIndex])
        } else if (highlightedIndex === filteredOptions.length && onCreateNew && inputValue.trim()) {
          handleCreateNew()
        }
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  const showCreateOption = onCreateNew && inputValue.trim() && 
    !filteredOptions.some(option => 
      option.label.toLowerCase() === inputValue.toLowerCase()
    )

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={cn("pr-8", className)}
          disabled={disabled}
          required={required}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground/80"
          disabled={disabled}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-foreground/20 bg-white py-1 shadow-lg">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-foreground/60">Loading...</div>
          ) : (
            <ul ref={listRef} className="divide-y divide-gray-100">
              {filteredOptions.length === 0 && !showCreateOption ? (
                <li className="px-3 py-2 text-sm text-foreground/60">{noOptionsText}</li>
              ) : (
                <>
                  {filteredOptions.map((option, index) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => handleOptionSelect(option)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-foreground/5 focus:bg-foreground/5 focus:outline-none",
                          index === highlightedIndex && "bg-foreground/5"
                        )}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                  {showCreateOption && (
                    <li>
                      <button
                        type="button"
                        onClick={handleCreateNew}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none font-medium",
                          filteredOptions.length === highlightedIndex && "bg-blue-50"
                        )}
                      >
                        {createNewText}: &quot;{inputValue}&quot;
                      </button>
                    </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}