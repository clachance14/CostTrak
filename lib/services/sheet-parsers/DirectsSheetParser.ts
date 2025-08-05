import * as XLSX from 'xlsx'

export interface DirectsDisciplineData {
  disciplineName: string
  disciplineNumber: string
  totalManhours: number
  laborCategories: DirectLaborCategory[]
}

export interface DirectLaborCategory {
  categoryName: string
  laborCategoryCode?: string // DL001-DL039
  quantity: number
  manhours: number
  rate?: number
  totalCost?: number
}

export interface DirectsParseResult {
  disciplines: DirectsDisciplineData[]
  totalManhours: number
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class DirectsSheetParser {
  // 39 direct labor categories in order
  private readonly DIRECT_LABOR_CATEGORIES = [
    'Boiler Maker - Class A',
    'Boiler Maker - Class B',
    'Carpenter - Class A',
    'Carpenter - Class B',
    'Crane Operator A',
    'Crane Operator B',
    'Electrician - Class A',
    'Electrician - Class B',
    'Electrician - Class C',
    'Equipment Operator - Class A',
    'Equipment Operator - Class B',
    'Equipment Operator - Class C',
    'Field Engineer A',
    'Field Engineer B',
    'Fitter - Class A',
    'Fitter - Class B',
    'General Foreman',
    'Helper',
    'Instrument Tech - Class A',
    'Instrument Tech - Class B',
    'Instrument Tech - Class C',
    'Ironworker - Class A',
    'Ironworker - Class B',
    'Laborer - Class A',
    'Laborer - Class B',
    'Millwright A',
    'Millwright B',
    'Operating Engineer A',
    'Operating Engineer B',
    'Operator A',
    'Operator B',
    'Painter',
    'Piping Foreman',
    'Supervisor',
    'Surveyor A',
    'Surveyor B',
    'Warehouse',
    'Welder - Class A',
    'Welder - Class B'
  ]

  // Map category names to DL codes
  private getCategoryCode(categoryName: string): string | undefined {
    const normalizedCategory = categoryName.trim().toUpperCase()
    const index = this.DIRECT_LABOR_CATEGORIES.findIndex(cat => 
      cat.toUpperCase() === normalizedCategory
    )
    
    if (index !== -1) {
      return `DL${String(index + 1).padStart(3, '0')}`
    }
    
    // Try partial matches for common variations
    const partialMatch = this.DIRECT_LABOR_CATEGORIES.findIndex(cat => {
      const catUpper = cat.toUpperCase()
      return catUpper.includes(normalizedCategory) || normalizedCategory.includes(catUpper)
    })
    
    if (partialMatch !== -1) {
      return `DL${String(partialMatch + 1).padStart(3, '0')}`
    }
    
    return undefined
  }

  parse(worksheet: XLSX.WorkSheet): DirectsParseResult {
    const result: DirectsParseResult = {
      disciplines: [],
      totalManhours: 0,
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 6) {
      result.validation.errors.push('DIRECTS sheet is empty or has insufficient data')
      return result
    }

    // Find discipline sections
    // Row 1 contains discipline info in sections every 10 columns
    // Format: "Discipline 1,FABRICATION" in cells A1-B1, then L1-M1, etc.
    const headerRow = data[0]
    if (!headerRow) {
      result.validation.errors.push('No header row found in DIRECTS sheet')
      return result
    }

    // Parse disciplines at column positions: 0 (A), 11 (L), etc. (every 10 columns)
    for (let sectionStart = 0; sectionStart < headerRow.length; sectionStart += 10) {
      // Check if we have a discipline in this section
      const disciplineNumCell = headerRow[sectionStart] // Column A, L, etc.
      const disciplineNameCell = headerRow[sectionStart + 1] // Column B, M, etc.
      
      if (!disciplineNumCell && !disciplineNameCell) continue
      
      // Extract discipline number and name
      let disciplineNumber = ''
      let disciplineName = ''
      
      // Handle various formats
      const numText = String(disciplineNumCell || '').trim()
      const nameText = String(disciplineNameCell || '').trim()
      
      // Check if it's "Discipline X" format or just the number
      const numMatch = numText.match(/Discipline\s*(\d+)/i)
      if (numMatch) {
        disciplineNumber = numMatch[1]
      } else if (/^\d+$/.test(numText)) {
        disciplineNumber = numText
      }
      
      // Get discipline name
      if (nameText && !nameText.match(/^Discipline/i)) {
        disciplineName = nameText
      } else if (numText.includes(',')) {
        // Handle "Discipline 1,FABRICATION" format
        const parts = numText.split(',')
        if (parts.length > 1) {
          disciplineName = parts[1].trim()
          if (!disciplineNumber) {
            const dMatch = parts[0].match(/Discipline\s*(\d+)/i)
            if (dMatch) disciplineNumber = dMatch[1]
          }
        }
      }
      
      if (disciplineName) {
        // Get manhours from row 2 at the appropriate column
        const manhours = this.parseNumericValue(data[1]?.[sectionStart + 1]) // Usually in column B, M, etc.
        
        const discipline: DirectsDisciplineData = {
          disciplineNumber: disciplineNumber || String(Math.floor(sectionStart / 10) + 1),
          disciplineName,
          totalManhours: manhours,
          laborCategories: []
        }

        // Parse labor categories starting from row 6 (row 5 in 0-based)
        for (let rowIndex = 5; rowIndex < data.length; rowIndex++) {
          const row = data[rowIndex]
          if (!row) continue

          // Column A contains the category names
          const categoryName = String(row[0] || '').trim()
          if (!categoryName) continue
          
          // Skip header-like rows
          if (categoryName.toUpperCase().includes('TOTAL') ||
              categoryName.toUpperCase() === 'MAN HOURS' ||
              categoryName.toUpperCase() === 'S.T. HOURS' ||
              categoryName.toUpperCase() === 'O.T. HOURS') {
            continue
          }

          // Get quantity/manhours for this discipline section
          // Values are in the same column as the discipline name (B for first discipline, M for second, etc.)
          const value = this.parseNumericValue(row[sectionStart + 1])
          
          if (value > 0) {
            const category: DirectLaborCategory = {
              categoryName,
              laborCategoryCode: this.getCategoryCode(categoryName),
              quantity: value, // Could be quantity or manhours depending on sheet structure
              manhours: value  // Assuming this is manhours
            }
            
            if (!category.laborCategoryCode) {
              result.validation.warnings.push(`Unknown labor category in ${disciplineName}: ${categoryName}`)
            }
            
            discipline.laborCategories.push(category)
          }
        }

        result.disciplines.push(discipline)
        result.totalManhours += manhours
      }
    }

    // Validation
    if (result.disciplines.length === 0) {
      result.validation.errors.push('No disciplines found in DIRECTS sheet')
    }

    return result
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
   * Validate against BUDGETS direct labor manhours
   */
  validateAgainstBudget(
    parseResult: DirectsParseResult,
    budgetTargets: Record<string, { directLaborHours: number }>
  ): { isValid: boolean; disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> } {
    const disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> = []
    let allValid = true
    
    parseResult.disciplines.forEach(disc => {
      const target = budgetTargets[disc.disciplineName]
      if (!target) {
        disciplineValidation.push({
          discipline: disc.disciplineName,
          isValid: false,
          difference: disc.totalManhours
        })
        allValid = false
      } else {
        const difference = Math.abs(disc.totalManhours - target.directLaborHours)
        const isValid = difference <= 0.01 // Allow small rounding differences
        
        disciplineValidation.push({
          discipline: disc.disciplineName,
          isValid,
          difference
        })
        
        if (!isValid) allValid = false
      }
    })
    
    return { isValid: allValid, disciplineValidation }
  }

  /**
   * Convert to direct labor allocations for database storage
   */
  toDirectLaborAllocations(
    parseResult: DirectsParseResult,
    projectId: string
  ): Array<{
    project_id: string
    wbs_code: string
    discipline: string
    category: string
    labor_category_id?: string
    manhours: number
    crew_size?: number
    duration_days?: number
    rate: number
    source_sheet: string
    source_row?: number
  }> {
    const allocations: Array<any> = []
    
    parseResult.disciplines.forEach(disc => {
      disc.laborCategories.forEach((category, index) => {
        if (category.manhours > 0) {
          allocations.push({
            project_id: projectId,
            wbs_code: `${disc.disciplineNumber}.01`, // Direct labor WBS code
            discipline: disc.disciplineName,
            category: category.categoryName,
            labor_category_id: category.laborCategoryCode,
            manhours: category.manhours,
            rate: category.rate || 0,
            source_sheet: 'DIRECTS',
            source_row: index + 6 // Starting from row 6
          })
        }
      })
    })
    
    return allocations
  }
}