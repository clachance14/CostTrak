import * as XLSX from 'xlsx'

export interface IndirectsRoleData {
  classification: string // Role name from Column A
  quantity: number // Column C
  weeks: number // Column D
  stLabor: number // Column S (S.T. LABOR)
  otLabor: number // Column T (O.T. LABOR)
  perDiem: number // Column W
  totalLabor: number // Column Y
  sourceRow: number
}

export interface IndirectsParseResult {
  roles: IndirectsRoleData[]
  totalSupervisionLabor: number // Supervision costs that contribute to INDIRECT LABOR
  totalPerDiem: number
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class IndirectsSheetParser {
  /**
   * Parse INDIRECTS sheet for supervision costs (rows 2-42)
   * These costs contribute to the BUDGETS INDIRECT LABOR total
   */
  parse(worksheet: XLSX.WorkSheet): IndirectsParseResult {
    const result: IndirectsParseResult = {
      roles: [],
      totalSupervisionLabor: 0,
      totalPerDiem: 0,
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push('INDIRECTS sheet is empty or has insufficient data')
      return result
    }

    // Parse rows 2-42 for supervision roles
    const startRow = 1 // 0-based index for row 2
    const endRow = Math.min(41, data.length - 1) // 0-based index for row 42

    for (let i = startRow; i <= endRow; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const classification = String(row[0] || '').trim() // Column A
      if (!classification) continue

      // Skip header rows or summary rows
      if (classification.toUpperCase().includes('TOTAL') || 
          classification.toUpperCase().includes('CLASSIFICATION')) {
        continue
      }

      const quantity = this.parseNumericValue(row[2]) // Column C
      const weeks = this.parseNumericValue(row[3]) // Column D
      const stLabor = this.parseNumericValue(row[18]) // Column S (0-based index 18)
      const otLabor = this.parseNumericValue(row[19]) // Column T (0-based index 19)
      const perDiem = this.parseNumericValue(row[22]) // Column W (0-based index 22)
      const totalLabor = this.parseNumericValue(row[24]) // Column Y (0-based index 24)

      // Only process if we have valid data
      if (quantity > 0 || weeks > 0 || totalLabor > 0) {
        const roleData: IndirectsRoleData = {
          classification,
          quantity,
          weeks,
          stLabor,
          otLabor,
          perDiem,
          totalLabor,
          sourceRow: i + 1 // Excel rows are 1-based
        }

        result.roles.push(roleData)
        result.totalSupervisionLabor += totalLabor
        result.totalPerDiem += perDiem
      }
    }

    // Validation
    if (result.roles.length === 0) {
      result.validation.errors.push('No supervision roles found in INDIRECTS sheet (rows 2-42)')
    }

    // Log summary
    console.log(`Indirects Parser Summary:`)
    console.log(`  Supervision roles found: ${result.roles.length}`)
    console.log(`  Total supervision labor: $${result.totalSupervisionLabor.toFixed(2)}`)
    console.log(`  Total per diem: $${result.totalPerDiem.toFixed(2)}`)

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
}