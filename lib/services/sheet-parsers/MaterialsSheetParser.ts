import * as XLSX from 'xlsx'

export interface MaterialsDisciplineData {
  disciplineName: string
  materials: {
    taxed: number
    taxes: number
    nonTaxed: number
    total: number
  }
  lineItems: MaterialLineItem[]
}

export interface MaterialLineItem {
  description: string
  type: 'TAXED' | 'TAXES' | 'NON_TAXED'
  amount: number
}

export interface MaterialsParseResult {
  disciplines: MaterialsDisciplineData[]
  totals: {
    taxed: number
    taxes: number
    nonTaxed: number
    grandTotal: number
  }
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class MaterialsSheetParser {
  private readonly MATERIAL_TYPES = {
    TAXED: 'MATERIALS FROM TAKE OFF SHEET - TAXED',
    TAXES: 'TAXES ON MATERIALS LISTED ABOVE',
    NON_TAXED: 'MATERIALS FROM TAKE OFF SHEET - NON-TAXED'
  }

  parse(worksheet: XLSX.WorkSheet): MaterialsParseResult {
    const result: MaterialsParseResult = {
      disciplines: [],
      totals: {
        taxed: 0,
        taxes: 0,
        nonTaxed: 0,
        grandTotal: 0
      },
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push('MATERIALS sheet is empty or has insufficient data')
      return result
    }

    let currentDiscipline: MaterialsDisciplineData | null = null
    let expectingType: 'TAXED' | 'TAXES' | 'NON_TAXED' | null = null

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Check column B for discipline name or column D for material type
      const colB = String(row[1] || '').trim()
      const colD = String(row[3] || '').trim()
      const amount = this.parseNumericValue(row[6]) // Column G for amount

      // Check if this is a new discipline section
      if (colB && this.isDisciplineName(colB, i, data)) {
        // Save previous discipline if exists
        if (currentDiscipline) {
          result.disciplines.push(currentDiscipline)
        }

        currentDiscipline = {
          disciplineName: colB,
          materials: {
            taxed: 0,
            taxes: 0,
            nonTaxed: 0,
            total: 0
          },
          lineItems: []
        }
        expectingType = 'TAXED' // First item in discipline should be taxed
      }
      // Check if this is a material type row
      else if (colD && currentDiscipline) {
        const upperD = colD.toUpperCase()
        
        if (upperD === this.MATERIAL_TYPES.TAXED) {
          const lineItem: MaterialLineItem = {
            description: colD,
            type: 'TAXED',
            amount
          }
          currentDiscipline.lineItems.push(lineItem)
          currentDiscipline.materials.taxed += amount
          result.totals.taxed += amount
          expectingType = 'TAXES' // Next should be taxes
        } else if (upperD === this.MATERIAL_TYPES.TAXES) {
          const lineItem: MaterialLineItem = {
            description: colD,
            type: 'TAXES',
            amount
          }
          currentDiscipline.lineItems.push(lineItem)
          currentDiscipline.materials.taxes += amount
          result.totals.taxes += amount
          expectingType = 'NON_TAXED' // Next should be non-taxed
        } else if (upperD === this.MATERIAL_TYPES.NON_TAXED) {
          const lineItem: MaterialLineItem = {
            description: colD,
            type: 'NON_TAXED',
            amount
          }
          currentDiscipline.lineItems.push(lineItem)
          currentDiscipline.materials.nonTaxed += amount
          result.totals.nonTaxed += amount
          expectingType = null // Complete cycle
        }
      }
    }

    // Don't forget the last discipline
    if (currentDiscipline) {
      result.disciplines.push(currentDiscipline)
    }

    // Calculate totals
    result.disciplines.forEach(disc => {
      disc.materials.total = disc.materials.taxed + disc.materials.taxes + disc.materials.nonTaxed
    })
    result.totals.grandTotal = result.totals.taxed + result.totals.taxes + result.totals.nonTaxed

    // Validation
    if (result.disciplines.length === 0) {
      result.validation.errors.push('No disciplines found in MATERIALS sheet')
    }

    // Check if each discipline has all three types
    result.disciplines.forEach(disc => {
      if (disc.materials.taxed === 0 && disc.materials.nonTaxed === 0) {
        result.validation.warnings.push(`${disc.disciplineName} has no materials`)
      }
    })

    return result
  }

  private isDisciplineName(text: string, rowIndex: number, data: unknown[][]): boolean {
    // Disciplines appear at rows 2, 10, 18, etc. (every 8 rows)
    // In 0-based indexing: rows 1, 9, 17, etc.
    // Extend the range to check up to row 200 to catch ELECTRICAL at row 50
    const expectedRows: number[] = []
    for (let i = 1; i < 200; i += 8) {
      expectedRows.push(i)
    }
    
    // Check if current row is a discipline row
    if (!expectedRows.includes(rowIndex)) {
      return false
    }
    
    const upperText = text.toUpperCase()
    
    // Skip if it's one of our material types
    if (Object.values(this.MATERIAL_TYPES).some(type => upperText === type)) {
      return false
    }
    
    // Additional validation: discipline names should not be empty
    // and should be actual discipline names (not numbers or special characters only)
    if (text.length === 0 || /^\d+$/.test(text) || /^[^a-zA-Z]+$/.test(text)) {
      return false
    }
    
    return true
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
   * Validate against BUDGETS materials values
   */
  validateAgainstBudget(
    parseResult: MaterialsParseResult,
    budgetTargets: Record<string, { materialsValue: number }>
  ): { isValid: boolean; disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> } {
    const disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> = []
    let allValid = true
    
    parseResult.disciplines.forEach(disc => {
      const target = budgetTargets[disc.disciplineName]
      if (!target) {
        disciplineValidation.push({
          discipline: disc.disciplineName,
          isValid: false,
          difference: disc.materials.total
        })
        allValid = false
      } else {
        const difference = Math.abs(disc.materials.total - target.materialsValue)
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
   * Convert to budget line items for database storage
   */
  toBudgetLineItems(
    parseResult: MaterialsParseResult,
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
    material_cost: number
    import_batch_id: string
  }> {
    const items: Array<any> = []
    let rowCounter = 1
    
    parseResult.disciplines.forEach(disc => {
      disc.lineItems.forEach(lineItem => {
        if (lineItem.amount > 0) {
          let costType = ''
          switch (lineItem.type) {
            case 'TAXED':
              costType = 'Materials - Taxed'
              break
            case 'TAXES':
              costType = 'Materials - Taxes'
              break
            case 'NON_TAXED':
              costType = 'Materials - Non-Taxed'
              break
          }
          
          items.push({
            project_id: projectId,
            source_sheet: 'MATERIALS',
            source_row: rowCounter++,
            discipline: disc.disciplineName,
            category: 'MATERIAL',
            cost_type: costType,
            description: `${disc.disciplineName} - ${lineItem.description}`,
            total_cost: lineItem.amount,
            material_cost: lineItem.amount,
            import_batch_id: importBatchId,
            labor_cost: 0,
            equipment_cost: 0,
            subcontract_cost: 0,
            other_cost: 0
          })
        }
      })
    })
    
    return items
  }
}