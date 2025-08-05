import * as XLSX from 'xlsx'

export interface ConstructabilityCategory {
  categoryName: string
  wbsMappedName?: string // e.g., PRE-JOB maps to TEMPORARY FACILITIES
  items: ConstructabilityItem[]
  totalCost: number
}

export interface ConstructabilityItem {
  description: string
  cost: number
  sourceRow: number
}

export interface ConstructabilityParseResult {
  categories: ConstructabilityCategory[]
  totalCost: number
  validation: {
    warnings: string[]
    errors: string[]
  }
  disciplineMapping: string // Usually "CONSTRUCTABILITY"
}

export class ConstructabilitySheetParser {
  // 7 main constructability categories
  private readonly CATEGORY_MAPPINGS: Record<string, string> = {
    'NEW HIRES': 'NEW HIRES',
    'SAFETY': 'SAFETY',
    'PRE-JOB': 'TEMPORARY FACILITIES', // Special mapping
    'PROJECT': 'PROJECT',
    'RESTROOMS': 'RESTROOMS',
    'WELDING': 'WELDING',
    'MISC': 'MISC',
    'MISC.': 'MISC' // Handle variations
  }

  // Known sub-items for each category
  private readonly CATEGORY_ITEMS: Record<string, string[]> = {
    'NEW HIRES': [
      'Safety Supplies',
      'Background Checks',
      'Fit Test',
      'Initial Drug Tests',
      'Initial Safety Council Training'
    ],
    'SAFETY': [
      'First Aid Kit',
      'Water Mist Fan - Per Month',
      'Cooling Fan',
      'Evaporative Cooler',
      'Fire Extinguishers'
    ],
    'PRE-JOB': [
      'Office Trailer - Set Up',
      'Office Trailer - Removal',
      'Office Trailer Rent',
      'Office Supplies',
      'Office Furniture'
    ],
    'PROJECT': [
      // Various project execution items
    ],
    'RESTROOMS': [
      'Restroom - Per Month',
      'Hand Washing Station',
      'Sanitation Service'
    ],
    'WELDING': [
      'Welder Certifications - Existing Procedures',
      'Welder Certifications - New Procedures'
    ],
    'MISC': [
      'Office Trailer - Set Up',
      'Office Trailer - Removal',
      'Office Trailer Rent',
      'Office Supplies',
      'Office Furniture'
    ]
  }

  parse(worksheet: XLSX.WorkSheet): ConstructabilityParseResult {
    const result: ConstructabilityParseResult = {
      categories: [],
      totalCost: 0,
      validation: {
        warnings: [],
        errors: []
      },
      disciplineMapping: 'CONSTRUCTABILITY'
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push('CONSTRUCTABILITY sheet is empty or has insufficient data')
      return result
    }

    // Map to store categories
    const categoryMap = new Map<string, ConstructabilityCategory>()
    let currentCategory: string | null = null

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Check columns for category headers or item descriptions
      // Assuming category headers are in early columns and costs in later columns
      const textCol1 = String(row[0] || '').trim()
      const textCol2 = String(row[1] || '').trim()
      const textCol3 = String(row[2] || '').trim()
      const textCol4 = String(row[3] || '').trim()
      
      // Look for cost values in various columns (adjust based on actual structure)
      let cost = 0
      for (let col = 4; col < row.length; col++) {
        const value = this.parseNumericValue(row[col])
        if (value > 0) {
          cost = value
          break // Take first non-zero value
        }
      }

      // Check if this is a category header
      const possibleCategories = [textCol1, textCol2, textCol3, textCol4]
      for (const text of possibleCategories) {
        const upperText = text.toUpperCase()
        if (this.isCategoryHeader(upperText)) {
          currentCategory = this.normalizeCategory(upperText)
          if (!categoryMap.has(currentCategory)) {
            categoryMap.set(currentCategory, {
              categoryName: currentCategory,
              wbsMappedName: this.CATEGORY_MAPPINGS[currentCategory] || currentCategory,
              items: [],
              totalCost: 0
            })
          }
          break
        }
      }

      // If we have a current category and this looks like an item, add it
      if (currentCategory && cost > 0) {
        const description = textCol4 || textCol3 || textCol2 || textCol1
        if (description && !this.isCategoryHeader(description.toUpperCase())) {
          const category = categoryMap.get(currentCategory)!
          const item: ConstructabilityItem = {
            description,
            cost,
            sourceRow: i + 1
          }
          category.items.push(item)
          category.totalCost += cost
          result.totalCost += cost
        }
      }
    }

    // Convert map to array
    result.categories = Array.from(categoryMap.values())

    // Validation
    if (result.categories.length === 0) {
      result.validation.errors.push('No categories found in CONSTRUCTABILITY sheet')
    } else if (result.categories.length !== 7) {
      result.validation.warnings.push(`Expected 7 categories, found ${result.categories.length}`)
    }

    // Log summary
    console.log(`Constructability Parser Summary:`)
    console.log(`  Categories found: ${result.categories.length}`)
    result.categories.forEach(cat => {
      console.log(`  ${cat.categoryName}: ${cat.items.length} items, Total: $${cat.totalCost.toFixed(2)}`)
    })
    console.log(`  Grand Total: $${result.totalCost.toFixed(2)}`)

    return result
  }

  private isCategoryHeader(text: string): boolean {
    const upperText = text.toUpperCase()
    return Object.keys(this.CATEGORY_MAPPINGS).some(cat => 
      upperText === cat || upperText.includes(cat)
    )
  }

  private normalizeCategory(text: string): string {
    const upperText = text.toUpperCase()
    for (const [key, value] of Object.entries(this.CATEGORY_MAPPINGS)) {
      if (upperText === key || upperText.includes(key)) {
        return key
      }
    }
    return upperText
  }

  private parseNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    
    // Remove formatting
    const cleaned = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-') // Handle negative values in parentheses
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Validate against BUDGETS constructability value
   */
  validateAgainstBudget(
    parseResult: ConstructabilityParseResult,
    budgetConstructabilityValue: number
  ): { isValid: boolean; difference: number; message: string } {
    const difference = Math.abs(parseResult.totalCost - budgetConstructabilityValue)
    const threshold = 0.01 // Allow $0.01 difference for rounding
    
    const isValid = difference <= threshold
    
    let message = ''
    if (isValid) {
      message = `CONSTRUCTABILITY total ($${parseResult.totalCost.toFixed(2)}) matches BUDGETS ($${budgetConstructabilityValue.toFixed(2)})`
    } else {
      message = `CONSTRUCTABILITY total ($${parseResult.totalCost.toFixed(2)}) does not match BUDGETS ($${budgetConstructabilityValue.toFixed(2)}). Difference: $${difference.toFixed(2)}`
    }
    
    return { isValid, difference, message }
  }

  /**
   * Convert to budget line items for database storage
   */
  toBudgetLineItems(
    parseResult: ConstructabilityParseResult,
    projectId: string,
    importBatchId: string
  ): Array<{
    project_id: string
    source_sheet: string
    source_row: number
    wbs_code?: string
    discipline?: string
    category: string
    cost_type: string
    description: string
    total_cost: number
    other_cost: number
    import_batch_id: string
  }> {
    const items: Array<any> = []
    
    parseResult.categories.forEach(category => {
      category.items.forEach(item => {
        items.push({
          project_id: projectId,
          source_sheet: 'CONSTRUCTABILITY',
          source_row: item.sourceRow,
          discipline: parseResult.disciplineMapping,
          category: 'OTHER',
          cost_type: `Constructability - ${category.wbsMappedName || category.categoryName}`,
          description: `${category.categoryName} - ${item.description}`,
          total_cost: item.cost,
          other_cost: item.cost,
          import_batch_id: importBatchId,
          labor_cost: 0,
          material_cost: 0,
          equipment_cost: 0,
          subcontract_cost: 0
        })
      })
    })
    
    return items
  }
}