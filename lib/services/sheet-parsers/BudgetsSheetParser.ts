import * as XLSX from 'xlsx'

export interface BudgetDiscipline {
  disciplineNumber: string
  disciplineName: string
  categories: {
    DIRECT_LABOR: { manhours: number; value: number }
    INDIRECT_LABOR: { manhours: number; value: number }
    ALL_LABOR: { manhours: number; value: number }
    TAXES_INSURANCE: { manhours: number; value: number }
    PERDIEM: { manhours: number; value: number }
    ADD_ONS: { manhours: number; value: number }
    SMALL_TOOLS_CONSUMABLES: { manhours: number; value: number }
    MATERIALS: { manhours: number; value: number }
    EQUIPMENT: { manhours: number; value: number }
    SUBCONTRACTS: { manhours: number; value: number }
    RISK: { manhours: number; value: number }
    DISCIPLINE_TOTALS: { manhours: number; value: number }
  }
}

export interface BudgetsParseResult {
  disciplines: BudgetDiscipline[]
  totals: {
    laborTotal: number
    materialsTotal: number
    equipmentTotal: number
    subcontractorsTotal: number
    grandTotal: number
    directLaborManhours: number
    indirectLaborManhours: number
    totalManhours: number
  }
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class BudgetsSheetParser {
  private readonly CATEGORY_NAMES = [
    'DIRECT LABOR',
    'INDIRECT LABOR',
    'ALL LABOR',
    'TAXES & INSURANCE',
    'PERDIEM',
    'ADD ONS',
    'SMALL TOOLS & CONSUMABLES',
    'MATERIALS',
    'EQUIPMENT',
    'SUBCONTRACTS',
    'RISK',
    'DISCIPLINE TOTALS'
  ]

  private readonly CATEGORY_KEYS = [
    'DIRECT_LABOR',
    'INDIRECT_LABOR',
    'ALL_LABOR',
    'TAXES_INSURANCE',
    'PERDIEM',
    'ADD_ONS',
    'SMALL_TOOLS_CONSUMABLES',
    'MATERIALS',
    'EQUIPMENT',
    'SUBCONTRACTS',
    'RISK',
    'DISCIPLINE_TOTALS'
  ] as const

  parse(worksheet: XLSX.WorkSheet): BudgetsParseResult {
    const result: BudgetsParseResult = {
      disciplines: [],
      totals: {
        laborTotal: 0,
        materialsTotal: 0,
        equipmentTotal: 0,
        subcontractorsTotal: 0,
        grandTotal: 0,
        directLaborManhours: 0,
        indirectLaborManhours: 0,
        totalManhours: 0
      },
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length === 0) {
      result.validation.errors.push('BUDGETS sheet is empty')
      return result
    }

    // Find discipline blocks
    let currentRow = 0
    while (currentRow < data.length) {
      const row = data[currentRow]
      
      if (this.isDisciplineStart(row, currentRow, data)) {
        const discipline = this.parseDisciplineBlock(data, currentRow)
        if (discipline) {
          result.disciplines.push(discipline)
          
          // Update totals - safely access categories that might be missing
          const disciplineTotal = discipline.categories.DISCIPLINE_TOTALS?.value || 0
          const materials = discipline.categories.MATERIALS?.value || 0
          const equipment = discipline.categories.EQUIPMENT?.value || 0
          const subcontractors = discipline.categories.SUBCONTRACTS?.value || 0
          
          // Labor categories include: DIRECT LABOR, INDIRECT LABOR, TAXES & INSURANCE, PERDIEM, ADD ONS
          const directLabor = discipline.categories.DIRECT_LABOR?.value || 0
          const indirectLabor = discipline.categories.INDIRECT_LABOR?.value || 0
          const taxesInsurance = discipline.categories.TAXES_INSURANCE?.value || 0
          const perDiem = discipline.categories.PERDIEM?.value || 0
          const addOns = discipline.categories.ADD_ONS?.value || 0
          
          // Other costs include: SMALL TOOLS & CONSUMABLES, RISK
          const smallTools = discipline.categories.SMALL_TOOLS_CONSUMABLES?.value || 0
          const risk = discipline.categories.RISK?.value || 0
          
          // Calculate labor total correctly
          const laborTotal = directLabor + indirectLabor + taxesInsurance + perDiem + addOns
          
          // Get manhours
          const directLaborManhours = discipline.categories.DIRECT_LABOR?.manhours || 0
          const indirectLaborManhours = discipline.categories.INDIRECT_LABOR?.manhours || 0
          
          result.totals.materialsTotal += materials
          result.totals.equipmentTotal += equipment
          result.totals.subcontractorsTotal += subcontractors
          result.totals.laborTotal += laborTotal
          result.totals.grandTotal += disciplineTotal
          result.totals.directLaborManhours += directLaborManhours
          result.totals.indirectLaborManhours += indirectLaborManhours
          result.totals.totalManhours += directLaborManhours + indirectLaborManhours
          
          // Skip the 12 rows of this discipline block
          currentRow += 12
        } else {
          currentRow++
        }
      } else {
        currentRow++
      }
    }

    // Validate that we found disciplines
    if (result.disciplines.length === 0) {
      result.validation.errors.push('No discipline blocks found in BUDGETS sheet')
    }

    return result
  }

  private isDisciplineStart(row: unknown[], rowIndex: number, allData: unknown[][]): boolean {
    if (!row || rowIndex + 11 >= allData.length) return false
    
    const colA = row[0] // Discipline number
    const colB = row[1] // Discipline name
    const colD = row[3] // Should be "DIRECT LABOR"
    
    // Check if this is a discipline header
    const hasNumber = colA !== undefined && colA !== null && !isNaN(Number(colA))
    const hasName = colB !== undefined && colB !== null && String(colB).trim().length > 0
    const hasDirectLabor = colD !== undefined && String(colD).toUpperCase() === 'DIRECT LABOR'
    
    return hasNumber && hasName && hasDirectLabor
  }

  private parseDisciplineBlock(data: unknown[][], startRow: number): BudgetDiscipline | null {
    try {
      const disciplineNumber = String(data[startRow][0]).trim()
      const disciplineName = String(data[startRow][1]).trim()
      
      // Initialize all categories with default zero values
      const categories: BudgetDiscipline['categories'] = {} as BudgetDiscipline['categories']
      this.CATEGORY_KEYS.forEach(key => {
        categories[key] = { manhours: 0, value: 0 }
      })
      
      // Parse all 12 rows
      for (let i = 0; i < 12; i++) {
        const rowIndex = startRow + i
        if (rowIndex >= data.length) break
        
        const row = data[rowIndex]
        const categoryName = String(row[3] || '').trim().toUpperCase()
        const manhours = this.parseNumericValue(row[4])
        const value = this.parseNumericValue(row[5])
        
        // Map to our category keys
        const categoryIndex = this.CATEGORY_NAMES.findIndex(name => 
          name.toUpperCase() === categoryName
        )
        
        if (categoryIndex !== -1) {
          const categoryKey = this.CATEGORY_KEYS[categoryIndex]
          categories[categoryKey] = { manhours, value }
        }
      }
      
      // Log which categories were found (for debugging)
      const foundCategories = this.CATEGORY_KEYS.filter(key => 
        categories[key].value !== 0 || categories[key].manhours !== 0
      )
      if (foundCategories.length < this.CATEGORY_KEYS.length) {
        console.log(`${disciplineName}: Found ${foundCategories.length} of ${this.CATEGORY_KEYS.length} categories`)
      }
      
      return {
        disciplineNumber,
        disciplineName,
        categories
      }
    } catch (error) {
      console.error('Error parsing discipline block at row', startRow, error)
      return null
    }
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
   * Get validation targets for other sheets
   */
  getValidationTargets(disciplines: BudgetDiscipline[]): Record<string, {
    directLaborHours: number
    indirectLaborValue: number
    materialsValue: number
    equipmentValue: number
    subcontractorsValue: number
  }> {
    const targets: Record<string, {
      directLaborHours: number
      indirectLaborValue: number
      materialsValue: number
      equipmentValue: number
      subcontractorsValue: number
    }> = {}

    disciplines.forEach(disc => {
      targets[disc.disciplineName] = {
        directLaborHours: disc.categories.DIRECT_LABOR.manhours,
        indirectLaborValue: disc.categories.INDIRECT_LABOR.value,
        materialsValue: disc.categories.MATERIALS.value,
        equipmentValue: disc.categories.EQUIPMENT.value,
        subcontractorsValue: disc.categories.SUBCONTRACTS.value
      }
    })

    return targets
  }

  /**
   * Get ADD ONS values by discipline
   */
  getAddOnsByDiscipline(disciplines: BudgetDiscipline[]): Record<string, number> {
    const addOns: Record<string, number> = {}
    
    disciplines.forEach(disc => {
      addOns[disc.disciplineName] = disc.categories.ADD_ONS.value
    })
    
    return addOns
  }
}