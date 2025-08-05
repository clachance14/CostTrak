/**
 * Directs Parser Implementation Example
 * 
 * This parser handles the DIRECTS sheet which contains manhours for
 * 39 direct labor categories across multiple disciplines.
 */

import * as XLSX from 'xlsx'
import { 
  DirectLaborCategory,
  DirectLaborAllocation,
  DirectsSheetData 
} from '../data-models'

export class DirectsParser {
  // All 39 Direct Labor Categories in order
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

  // Standard hourly rates by category (can be overridden by sheet data)
  private readonly STANDARD_RATES: Record<string, number> = {
    'Boiler Maker - Class A': 85,
    'Boiler Maker - Class B': 75,
    'Carpenter - Class A': 70,
    'Carpenter - Class B': 60,
    'Crane Operator A': 90,
    'Crane Operator B': 80,
    'Electrician - Class A': 85,
    'Electrician - Class B': 75,
    'Electrician - Class C': 65,
    'Equipment Operator - Class A': 75,
    'Equipment Operator - Class B': 65,
    'Equipment Operator - Class C': 55,
    'Field Engineer A': 95,
    'Field Engineer B': 85,
    'Fitter - Class A': 80,
    'Fitter - Class B': 70,
    'General Foreman': 100,
    'Helper': 45,
    'Instrument Tech - Class A': 85,
    'Instrument Tech - Class B': 75,
    'Instrument Tech - Class C': 65,
    'Ironworker - Class A': 80,
    'Ironworker - Class B': 70,
    'Laborer - Class A': 50,
    'Laborer - Class B': 40,
    'Millwright A': 85,
    'Millwright B': 75,
    'Operating Engineer A': 85,
    'Operating Engineer B': 75,
    'Operator A': 70,
    'Operator B': 60,
    'Painter': 65,
    'Piping Foreman': 95,
    'Supervisor': 110,
    'Surveyor A': 80,
    'Surveyor B': 70,
    'Warehouse': 55,
    'Welder - Class A': 90,
    'Welder - Class B': 80
  }

  /**
   * Parse DIRECTS sheet and extract labor allocations
   */
  async parse(worksheet: XLSX.WorkSheet): Promise<DirectsSheetData> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    const allocations: DirectLaborAllocation[] = []
    
    console.log('Parsing DIRECTS sheet with', data.length, 'rows')
    
    // Extract disciplines from header row
    const disciplines = this.extractDisciplines(data[0])
    console.log('Found disciplines:', disciplines)
    
    // Validate sheet structure
    if (!this.validateSheetStructure(data, disciplines)) {
      throw new Error('Invalid DIRECTS sheet structure')
    }
    
    // Process each labor category (rows 2-40)
    for (let categoryIndex = 0; categoryIndex < this.DIRECT_LABOR_CATEGORIES.length; categoryIndex++) {
      const rowIndex = categoryIndex + 2 // Start from row 3
      const categoryName = this.DIRECT_LABOR_CATEGORIES[categoryIndex]
      
      if (rowIndex >= data.length) {
        console.warn(`Missing data for category: ${categoryName}`)
        continue
      }
      
      const row = data[rowIndex]
      
      // Extract manhours for each discipline
      disciplines.forEach((discipline, disciplineIndex) => {
        // Discipline columns start at index 2 (column C)
        const columnIndex = disciplineIndex * 2 + 2 // Each discipline has 2 columns (manhours, cost)
        const manhours = this.parseNumericValue(row[columnIndex])
        
        if (manhours > 0) {
          const allocation = this.createDirectLaborAllocation(
            categoryName as DirectLaborCategory,
            discipline,
            manhours,
            row,
            columnIndex
          )
          allocations.push(allocation)
        }
      })
    }
    
    // Calculate totals
    const totals = this.calculateTotals(allocations)
    
    return {
      categories: this.DIRECT_LABOR_CATEGORIES as DirectLaborCategory[],
      disciplines,
      allocations,
      totals
    }
  }

  /**
   * Extract discipline names from header row
   */
  private extractDisciplines(headerRow: unknown[]): string[] {
    const disciplines: string[] = []
    
    if (!headerRow) return disciplines
    
    // Disciplines start at column C (index 2) and appear every 2 columns
    for (let i = 2; i < headerRow.length; i += 2) {
      const disciplineName = String(headerRow[i] || '').trim()
      
      if (disciplineName && disciplineName !== '') {
        // Normalize discipline name
        const normalized = disciplineName
          .toUpperCase()
          .replace(/\s+/g, ' ')
          .trim()
        
        if (!disciplines.includes(normalized)) {
          disciplines.push(normalized)
        }
      }
    }
    
    return disciplines
  }

  /**
   * Validate sheet has expected structure
   */
  private validateSheetStructure(data: unknown[][], disciplines: string[]): boolean {
    if (data.length < 41) { // Need at least 41 rows (header + 39 categories + total)
      console.error('DIRECTS sheet has insufficient rows')
      return false
    }
    
    if (disciplines.length === 0) {
      console.error('No disciplines found in DIRECTS sheet')
      return false
    }
    
    // Verify labor category names in column A
    for (let i = 0; i < this.DIRECT_LABOR_CATEGORIES.length; i++) {
      const row = data[i + 2]
      const categoryInSheet = String(row?.[0] || '').trim()
      const expectedCategory = this.DIRECT_LABOR_CATEGORIES[i]
      
      if (categoryInSheet !== expectedCategory) {
        // Try fuzzy match (case-insensitive)
        if (categoryInSheet.toLowerCase() !== expectedCategory.toLowerCase()) {
          console.error(`Expected category "${expectedCategory}" at row ${i + 3}, found "${categoryInSheet}"`)
          return false
        }
      }
    }
    
    return true
  }

  /**
   * Create direct labor allocation
   */
  private createDirectLaborAllocation(
    category: DirectLaborCategory,
    discipline: string,
    manhours: number,
    row: unknown[],
    columnIndex: number
  ): DirectLaborAllocation {
    // Get rate from the next column or use standard rate
    const rate = this.parseNumericValue(row[columnIndex + 1]) || this.STANDARD_RATES[category] || 75
    
    // Calculate crew size and duration based on typical project patterns
    const { crewSize, durationDays } = this.estimateCrewAndDuration(category, manhours)
    
    return {
      id: crypto.randomUUID(),
      project_id: '', // Will be set during import
      wbs_code: this.generateWBSCode(discipline, category),
      discipline,
      category,
      manhours,
      crew_size: crewSize,
      duration_days: durationDays,
      rate,
      total_cost: manhours * rate,
      source_sheet: 'DIRECTS',
      source_row: row.length
    }
  }

  /**
   * Generate WBS code for direct labor
   */
  private generateWBSCode(discipline: string, category: DirectLaborCategory): string {
    // Map discipline to WBS Level 3 group
    const disciplineGroupMap: Record<string, string> = {
      'PIPING': '1.1.9',      // Mechanical
      'STEEL': '1.1.9',       // Mechanical
      'EQUIPMENT': '1.1.9',   // Mechanical
      'INSTRUMENTATION': '1.1.10', // I&E
      'ELECTRICAL': '1.1.10', // I&E
      'CIVIL': '1.1.8',       // Civil
      'CONCRETE': '1.1.8',    // Civil
      'FABRICATION': '1.1.4', // Fabrication
      'MILLWRIGHT': '1.1.12'  // Millwright
    }
    
    const groupCode = disciplineGroupMap[discipline] || '1.1.9' // Default to Mechanical
    
    // Get sub-discipline code (Level 4)
    const subDisciplineIndex = this.getSubDisciplineIndex(discipline)
    const level4Code = `${groupCode}.${subDisciplineIndex}`
    
    // Direct Labor is always .1 at Level 5
    const level5Base = `${level4Code}.1`
    
    // Get labor category index
    const categoryIndex = this.DIRECT_LABOR_CATEGORIES.indexOf(category) + 1
    const categoryCode = categoryIndex.toString().padStart(2, '0')
    
    return `${level5Base}.${categoryCode}`
  }

  /**
   * Get sub-discipline index for Level 4
   */
  private getSubDisciplineIndex(discipline: string): number {
    const subDisciplineMap: Record<string, number> = {
      'STEEL': 1,
      'GROUTING': 2,
      'EQUIPMENT': 3,
      'PIPING': 4,
      'HYDRO-TESTING': 5,
      'INSTRUMENTATION': 6,
      'ELECTRICAL': 7,
      'CIVIL': 1,
      'CONCRETE': 2,
      'FABRICATION': 1,
      'MILLWRIGHT': 1
    }
    
    return subDisciplineMap[discipline] || 1
  }

  /**
   * Estimate crew size and duration based on manhours and labor category
   */
  private estimateCrewAndDuration(
    category: DirectLaborCategory,
    manhours: number
  ): { crewSize: number; durationDays: number } {
    // Standard crew sizes by category type
    const crewSizes: Record<string, number> = {
      'General Foreman': 1,
      'Supervisor': 1,
      'Piping Foreman': 1,
      'Crane Operator A': 1,
      'Crane Operator B': 1,
      'Field Engineer A': 1,
      'Field Engineer B': 1,
      'Warehouse': 2,
      'Helper': 4
    }
    
    // Default crew sizes by skill level
    const defaultCrewSize = category.includes('Class A') ? 4 :
                           category.includes('Class B') ? 6 :
                           category.includes('Class C') ? 8 : 5
    
    const crewSize = crewSizes[category] || defaultCrewSize
    
    // Calculate duration assuming 10-hour days
    const hoursPerDay = 10
    const totalManDays = manhours / hoursPerDay
    const durationDays = Math.ceil(totalManDays / crewSize)
    
    return { crewSize, durationDays }
  }

  /**
   * Parse numeric value from Excel cell
   */
  private parseNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    
    const cleaned = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-')
      .replace(/-+$/, '0')
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Calculate totals
   */
  private calculateTotals(allocations: DirectLaborAllocation[]) {
    const byCategory: Record<string, number> = {}
    const byDiscipline: Record<string, number> = {}
    let totalManhours = 0
    let totalCost = 0
    
    for (const allocation of allocations) {
      // By category
      byCategory[allocation.category] = (byCategory[allocation.category] || 0) + allocation.manhours
      
      // By discipline
      byDiscipline[allocation.discipline] = (byDiscipline[allocation.discipline] || 0) + allocation.manhours
      
      // Totals
      totalManhours += allocation.manhours
      totalCost += allocation.total_cost
    }
    
    return {
      by_category: byCategory,
      by_discipline: byDiscipline,
      total_manhours: totalManhours,
      total_cost: totalCost
    }
  }
}

// Example usage
async function exampleUsage() {
  const parser = new DirectsParser()
  const workbook = XLSX.readFile('budget.xlsx')
  const directsSheet = workbook.Sheets['DIRECTS']
  
  if (!directsSheet) {
    console.error('DIRECTS sheet not found')
    return
  }
  
  try {
    const result = await parser.parse(directsSheet)
    
    console.log('\n=== DIRECTS Sheet Parse Results ===')
    console.log(`Total allocations: ${result.allocations.length}`)
    console.log(`Total manhours: ${result.totals.total_manhours.toLocaleString()}`)
    console.log(`Total cost: $${result.totals.total_cost.toLocaleString()}`)
    
    console.log('\nBy Discipline:')
    for (const [discipline, hours] of Object.entries(result.totals.by_discipline)) {
      console.log(`  ${discipline}: ${hours.toLocaleString()} hours`)
    }
    
    console.log('\nTop 5 Categories by Hours:')
    const sortedCategories = Object.entries(result.totals.by_category)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    
    for (const [category, hours] of sortedCategories) {
      console.log(`  ${category}: ${hours.toLocaleString()} hours`)
    }
    
    // Example: Find all welders
    console.log('\nWelder Allocations:')
    const welders = result.allocations.filter(a => 
      a.category.includes('Welder')
    )
    for (const welder of welders) {
      console.log(`  ${welder.discipline}: ${welder.category} - ${welder.manhours} hours`)
    }
    
  } catch (error) {
    console.error('Failed to parse DIRECTS sheet:', error)
  }
}

// Export for use in other modules
export { exampleUsage }