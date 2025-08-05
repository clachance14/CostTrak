import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { DisciplineMapper } from './discipline-mapper'

export interface SheetStructure {
  headerRow: number
  dataColumns: {
    wbs?: number
    description?: number
    quantity?: number
    unit?: number
    rate?: number
    hours?: number
    crew?: number
    duration?: number
    total?: number
    [key: string]: number | undefined
  }
  dataStartRow: number
  dataEndRow: number
}

export interface BudgetLineItem {
  // Source tracking
  source_sheet: string
  source_row: number
  
  // WBS and categorization
  wbs_code?: string  // Simple codes: L-001, L-002, L-003, N-001, N-002, N-003, N-004
  discipline?: string
  category: string
  subcategory?: string
  cost_type?: string  // Direct Labor, Indirect Labor, Materials, etc.
  
  // Item details
  line_number?: string
  description: string
  
  // Quantities and rates
  quantity?: number
  unit_of_measure?: string
  unit_rate?: number
  
  // Hours (for labor items)
  manhours?: number
  crew_size?: number
  duration_days?: number
  
  // Simplified cost breakdown aligned with PO categories
  labor_direct_cost: number
  labor_indirect_cost: number
  labor_staff_cost: number
  materials_cost: number
  equipment_cost: number
  subcontracts_cost: number
  small_tools_cost: number
  total_cost: number
  
  // Additional metadata
  notes?: string
  contractor_name?: string
  supplier_name?: string
  owned_or_rented?: 'OWNED' | 'RENTED'
}

export interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description?: string
  children: WBSNode[]
  budget_total: number
}

export interface EquipmentDetail {
  description: string
  quantity: number
  duration: number
  durationType: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | string
  fueled: 'YES' | 'NO' | string
  rateUsed: number
  equipmentCost: number
  fogCost: number  // Fuel, Oil, Grease
  maintenanceCost: number
  totalCost: number  // equipmentCost + fogCost + maintenanceCost
  sourceDiscipline?: string  // From GENERAL EQUIPMENT sheet
  sourceRow: number
}

export interface BudgetSheetDiscipline {
  discipline: string
  disciplineNumber?: string
  directLaborHours: number
  indirectLaborHours: number
  manhours: number  // Total of direct + indirect
  value: number
  costPerHour?: number
  categories: Record<string, { manhours: number; value: number; percentage: number }>
  equipmentDetails?: EquipmentDetail[]
  equipmentCostBreakdown?: {
    rentalCost: number
    fogCost: number
    maintenanceCost: number
    total: number
  }
}

export interface ExcelBudgetData {
  summary: Record<string, any>
  details: Record<string, BudgetLineItem[]>
  wbsStructure: WBSNode[]
  totals: {
    laborDirect: number
    laborIndirect: number
    laborStaff: number
    materials: number
    equipment: number
    subcontracts: number
    smallTools: number
    totalLabor: number
    totalNonLabor: number
    grandTotal: number
    // Manhours tracking
    directLaborManhours: number
    indirectLaborManhours: number
    totalManhours: number
  }
  disciplineBudgets?: BudgetSheetDiscipline[]  // From BUDGETS sheet
  validation: {
    warnings: string[]
    errors: string[]
  }
}

interface SheetMapping {
  sheet_name: string
  category: string
  subcategory?: string
  column_mappings: Record<string, number>
  parsing_rules?: Record<string, unknown>
}

export class ExcelBudgetAnalyzer {
  protected sheetMappings: Record<string, SheetMapping> = {}
  protected disciplineMapping: Record<string, string> = {}
  protected predefinedWBS: WBSNode[] = []
  
  // Mapping for GENERAL EQUIPMENT disciplines to BUDGETS disciplines
  protected readonly EQUIPMENT_DISCIPLINE_MAPPING: Record<string, string> = {
    'CIVIL': 'STEEL',
    'GENERAL': '',  // Project-wide equipment
    '': ''  // Empty discipline = project-wide
  }
  
  // Define the sheets we want to process
  protected readonly ALLOWED_SHEETS = [
    'CONSTRUCTABILITY',
    'DISC. EQUIPMENT',
    'GENERAL EQUIPMENT',
    'SCAFFOLDING',
    'SUBS',
    'MATERIALS',
    'STAFF',
    'INDIRECTS',
    'DIRECTS'
  ]
  
  // Cost categories in BUDGETS sheet (12-row blocks)
  protected readonly BUDGET_CATEGORIES = [
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
  
  constructor(disciplineMapping?: Record<string, string>, predefinedWBS?: WBSNode[]) {
    this.loadSheetMappings()
    if (disciplineMapping) {
      this.disciplineMapping = disciplineMapping
    }
    if (predefinedWBS) {
      this.predefinedWBS = predefinedWBS
    }
  }
  
  private async loadSheetMappings() {
    const adminSupabase = createAdminClient()
    const { data } = await adminSupabase
      .from('excel_sheet_mappings')
      .select('*')
      .eq('is_active', true)
    
    if (data) {
      data.forEach(mapping => {
        this.sheetMappings[mapping.sheet_name] = mapping
      })
    }
  }
  
  /**
   * Detect the structure of a worksheet by analyzing headers and data patterns
   */
  detectSheetStructure(worksheet: XLSX.WorkSheet): SheetStructure {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    // Common header keywords to look for
    const headerPatterns = {
      wbs: ['wbs', 'code', 'item'],
      description: ['description', 'desc', 'item', 'scope', 'work'],
      quantity: ['qty', 'quantity', 'quant', 'ea', 'count'],
      unit: ['unit', 'um', 'measure'],
      rate: ['rate', 'price', 'cost', 'unit cost', 'unit price'],
      hours: ['hours', 'hrs', 'manhours', 'mh'],
      crew: ['crew', 'crew size', 'men'],
      duration: ['duration', 'days', 'weeks', 'months'],
      total: ['total', 'amount', 'extended', 'cost']
    }
    
    let headerRow = -1
    const columnMap: SheetStructure['dataColumns'] = {}
    
    // Find header row by looking for multiple keywords
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i]
      if (!row || row.length === 0) continue
      
      let matchCount = 0
      
      row.forEach((cell, colIdx) => {
        if (!cell) return
        const cellStr = String(cell).toLowerCase().trim()
        
        // Check each header pattern
        Object.entries(headerPatterns).forEach(([field, patterns]) => {
          if (patterns.some(pattern => cellStr.includes(pattern))) {
            // Only assign if not already found (to prevent overwriting)
            if (columnMap[field] === undefined) {
              columnMap[field] = colIdx
              matchCount++
            }
          }
        })
      })
      
      // If we found at least 3 matches, this is likely our header row
      if (matchCount >= 3) {
        headerRow = i
        break
      }
    }
    
    // Find data start and end rows
    let dataStartRow = headerRow + 1
    let dataEndRow = data.length - 1
    
    // Skip empty rows after header
    while (dataStartRow < data.length && (!data[dataStartRow] || data[dataStartRow].every(cell => !cell))) {
      dataStartRow++
    }
    
    // Find last data row (before totals)
    for (let i = data.length - 1; i >= dataStartRow; i--) {
      const row = data[i]
      if (row && row.some(cell => {
        const cellStr = String(cell || '').toLowerCase()
        return cellStr.includes('total') || cellStr.includes('grand')
      })) {
        dataEndRow = i - 1
        break
      }
    }
    
    return {
      headerRow,
      dataColumns: columnMap,
      dataStartRow,
      dataEndRow
    }
  }
  
  /**
   * Extract WBS code from a cell value
   */
  extractWBSCode(value: unknown): string | undefined {
    if (!value) return undefined
    
    const str = String(value).trim()
    // Match patterns like 01-100, 02.200, 01-100-001
    const wbsMatch = str.match(/^\d{2,3}[-\.]\d{2,3}([-\.]\d{2,3})?/)
    
    return wbsMatch ? wbsMatch[0] : undefined
  }
  
  /**
   * Parse WBS code into hierarchical levels
   */
  parseWBSLevels(wbsCode: string): { level1?: string; level2?: string; level3?: string } {
    const parts = wbsCode.split(/[-.]/)
    return {
      level1: parts[0],
      level2: parts[1],
      level3: parts[2]
    }
  }
  
  /**
   * Extract discipline from item data
   */
  private extractDisciplineFromItem(
    item: BudgetLineItem,
    row: any[],
    mapping: SheetMapping
  ): string | undefined {
    // First check if there's a discipline column in the mapping
    if (mapping.column_mappings?.discipline !== undefined) {
      const disciplineValue = row[mapping.column_mappings.discipline]
      if (disciplineValue) {
        return String(disciplineValue).trim().toUpperCase()
      }
    }
    
    // Try to extract from description or WBS code
    const description = item.description.toUpperCase()
    const disciplineKeywords = Object.keys(this.disciplineMapping)
    
    for (const keyword of disciplineKeywords) {
      if (description.includes(keyword)) {
        return keyword
      }
    }
    
    // Check WBS code patterns
    if (item.wbs_code) {
      const wbsUpper = item.wbs_code.toUpperCase()
      for (const keyword of disciplineKeywords) {
        if (wbsUpper.includes(keyword)) {
          return keyword
        }
      }
    }
    
    return undefined
  }
  
  /**
   * Parse numeric value from various formats
   */
  parseNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    
    // Remove formatting
    const cleaned = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-') // Handle negative values in parentheses
      .replace(/-+$/, '0')   // Handle formats like " $-   "
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  
  /**
   * Extract budget data from a specific sheet
   */
  extractSheetData(
    worksheet: XLSX.WorkSheet,
    sheetName: string,
    structure: SheetStructure,
    mapping: SheetMapping
  ): BudgetLineItem[] {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    const items: BudgetLineItem[] = []
    
    for (let i = structure.dataStartRow; i <= structure.dataEndRow && i < data.length; i++) {
      const row = data[i]
      if (!row || row.every(cell => !cell)) continue
      
      // Skip total rows
      const descCell = row[structure.dataColumns.description !== undefined ? structure.dataColumns.description : 1]
      if (descCell && String(descCell).toLowerCase().includes('total')) continue
      
      // Extract data based on column mappings
      const totalCost = this.parseNumericValue(row[structure.dataColumns.total !== undefined ? structure.dataColumns.total : 0])
      
      // Skip zero or negative items
      if (totalCost <= 0) continue
      
      const item: BudgetLineItem = {
        source_sheet: sheetName,
        source_row: i + 1, // Excel rows are 1-based
        category: mapping.category,
        subcategory: mapping.subcategory,
        description: String(row[structure.dataColumns.description !== undefined ? structure.dataColumns.description : 1] || '').trim(),
        total_cost: totalCost,
        labor_cost: 0,
        material_cost: 0,
        equipment_cost: 0,
        subcontract_cost: 0,
        other_cost: 0
      }
      
      // Apply discipline mapping if available
      if (this.disciplineMapping && Object.keys(this.disciplineMapping).length > 0) {
        // Try to extract discipline from the data
        const discipline = this.extractDisciplineFromItem(item, row, mapping)
        if (discipline && this.disciplineMapping[discipline]) {
          item.discipline = this.disciplineMapping[discipline]
        }
      }
      
      // Extract WBS code
      if (structure.dataColumns.wbs !== undefined) {
        item.wbs_code = this.extractWBSCode(row[structure.dataColumns.wbs])
        if (item.wbs_code) {
          const levels = this.parseWBSLevels(item.wbs_code)
          item.wbs_level1 = levels.level1
          item.wbs_level2 = levels.level2
          item.wbs_level3 = levels.level3
        }
      }
      
      // Extract quantities and rates
      if (structure.dataColumns.quantity !== undefined) {
        item.quantity = this.parseNumericValue(row[structure.dataColumns.quantity])
      }
      if (structure.dataColumns.unit !== undefined) {
        item.unit_of_measure = String(row[structure.dataColumns.unit] || '').trim()
      }
      if (structure.dataColumns.rate !== undefined) {
        item.unit_rate = this.parseNumericValue(row[structure.dataColumns.rate])
      }
      
      // Extract labor-specific fields
      if (structure.dataColumns.hours !== undefined) {
        item.manhours = this.parseNumericValue(row[structure.dataColumns.hours])
      }
      if (structure.dataColumns.crew !== undefined) {
        item.crew_size = Math.round(this.parseNumericValue(row[structure.dataColumns.crew]))
      }
      if (structure.dataColumns.duration !== undefined) {
        item.duration_days = this.parseNumericValue(row[structure.dataColumns.duration])
      }
      
      // Allocate costs to appropriate category
      switch (mapping.category) {
        case 'LABOR':
          item.labor_cost = totalCost
          break
        case 'MATERIAL':
          item.material_cost = totalCost
          break
        case 'EQUIPMENT':
          item.equipment_cost = totalCost
          break
        case 'SUBCONTRACT':
          item.subcontract_cost = totalCost
          break
        default:
          item.other_cost = totalCost
      }
      
      items.push(item)
    }
    
    return items
  }
  
  /**
   * Extract detailed budget data from BUDGETS sheet with 12-row discipline blocks
   */
  extractBudgetSheetDisciplines(workbook: XLSX.WorkBook): BudgetSheetDiscipline[] {
    const disciplines: BudgetSheetDiscipline[] = []
    const budgetsSheet = workbook.Sheets['BUDGETS']
    
    if (!budgetsSheet) {
      console.log('BUDGETS sheet not found')
      return disciplines
    }
    
    const data = XLSX.utils.sheet_to_json(budgetsSheet, { header: 1 }) as unknown[][]
    console.log('BUDGETS sheet has', data.length, 'rows')
    
    // Expected category sequence for validation
    const EXPECTED_CATEGORIES = [
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
    
    // Helper function to check if this is a discipline header row
    const isDisciplineHeader = (row: unknown[], rowIndex: number): boolean => {
      if (!row || (rowIndex + 11) >= data.length) return false
      
      const cellA = row[0] ? String(row[0]).trim() : ''
      const cellB = row[1] ? String(row[1]).trim() : ''
      const cellC = row[2] ? String(row[2]).trim() : ''
      const cellD = row[3] ? String(row[3]).trim() : ''
      
      // A discipline header has:
      // - Column A: A number (discipline number)
      // - Column B: Discipline name (non-empty)
      // - Column C: Empty
      // - Column D: "DIRECT LABOR"
      const hasNumber = cellA !== '' && !isNaN(Number(cellA))
      const hasName = cellB.length > 0
      const hasEmptyC = cellC === ''
      const hasDirectLabor = cellD.toUpperCase() === 'DIRECT LABOR'
      
      return hasNumber && hasName && hasEmptyC && hasDirectLabor
    }
    
    // Start from row 2 (skip header row)
    let currentRow = 1  // 0-indexed, so 1 = row 2 in Excel
    
    while (currentRow < data.length) {
      const row = data[currentRow]
      
      if (isDisciplineHeader(row, currentRow)) {
        const disciplineNumber = String(row[0]).trim()
        const disciplineName = String(row[1]).trim()
        
        console.log(`\n=== Found discipline at row ${currentRow + 1} ===`)
        console.log(`Discipline #${disciplineNumber}: ${disciplineName}`)
        
        // Validate that the 12 rows match expected category sequence
        let isValidBlock = true
        for (let i = 0; i < 12; i++) {
          const catRow = data[currentRow + i]
          if (!catRow || !catRow[3]) {
            isValidBlock = false
            break
          }
          const category = String(catRow[3]).trim().toUpperCase()
          if (category !== EXPECTED_CATEGORIES[i]) {
            console.log(`  ✗ Category mismatch at row ${currentRow + i + 1}: expected "${EXPECTED_CATEGORIES[i]}", got "${category}"`)
            isValidBlock = false
            break
          }
        }
        
        if (isValidBlock) {
          console.log(`  ✓ Valid discipline block confirmed`)
          
          const discipline: BudgetSheetDiscipline = {
            discipline: disciplineName,
            disciplineNumber: disciplineNumber,
            directLaborHours: 0,
            indirectLaborHours: 0,
            manhours: 0,
            value: 0,
            categories: {}
          }
          
          // Process all 12 rows for this discipline
          for (let i = 0; i < 12; i++) {
            const catRow = data[currentRow + i]
            const category = String(catRow[3]).trim()
            const manhours = this.parseNumericValue(catRow[4])
            const value = this.parseNumericValue(catRow[5])
            const percentage = this.parseNumericValue(catRow[6])
            
            console.log(`  Row ${currentRow + i + 1}: ${category} - Value: ${value}, Hours: ${manhours}`)
            
            // Store all categories except subtotals
            if (!['ALL LABOR', 'DISCIPLINE TOTALS'].includes(category.toUpperCase())) {
              discipline.categories[category.toUpperCase()] = {
                manhours: manhours || 0,
                value: value || 0,
                percentage: percentage || 0
              }
            }
            
            // Extract specific values
            switch (category.toUpperCase()) {
              case 'DIRECT LABOR':
                discipline.directLaborHours = manhours || 0
                break
              case 'INDIRECT LABOR':
                discipline.indirectLaborHours = manhours || 0
                break
              case 'DISCIPLINE TOTALS':
                // Use the total from DISCIPLINE TOTALS row
                discipline.value = value || 0
                break
            }
          }
          
          // Calculate total manhours (direct + indirect)
          discipline.manhours = discipline.directLaborHours + discipline.indirectLaborHours
          
          // Calculate cost per hour if we have manhours
          if (discipline.manhours > 0) {
            const laborValue = (discipline.categories['DIRECT LABOR']?.value || 0) + 
                              (discipline.categories['INDIRECT LABOR']?.value || 0)
            discipline.costPerHour = laborValue / discipline.manhours
          }
          
          console.log(`  Summary: Direct=${discipline.directLaborHours}hrs, Indirect=${discipline.indirectLaborHours}hrs, Total Value=$${discipline.value}`)
          
          disciplines.push(discipline)
          
          // Move to the next discipline (skip exactly 12 rows)
          currentRow += 12
        } else {
          console.log(`  ✗ Invalid discipline block, skipping`)
          currentRow++
        }
      } else {
        currentRow++
      }
    }
    
    console.log(`\nExtracted ${disciplines.length} disciplines from BUDGETS sheet`)
    return disciplines
  }
  
  /**
   * Match equipment details to disciplines based on cost and discipline mapping
   */
  matchEquipmentToDisciplines(
    disciplines: BudgetSheetDiscipline[], 
    equipmentDetails: EquipmentDetail[]
  ): void {
    console.log('\n=== Matching Equipment to Disciplines ===')
    
    // Process each discipline
    disciplines.forEach(discipline => {
      const equipmentCategory = discipline.categories['EQUIPMENT']
      if (!equipmentCategory || equipmentCategory.value === 0) {
        console.log(`${discipline.discipline}: No equipment cost`)
        return
      }
      
      const targetCost = equipmentCategory.value
      console.log(`\n${discipline.discipline}: Target equipment cost = $${targetCost}`)
      
      // First, try to match equipment with exact discipline name
      let matchedDetails = equipmentDetails.filter(detail => {
        const mappedDiscipline = this.EQUIPMENT_DISCIPLINE_MAPPING[detail.sourceDiscipline || ''] || detail.sourceDiscipline
        return mappedDiscipline === discipline.discipline
      })
      
      // Calculate total of matched items
      let matchedTotal = matchedDetails.reduce((sum, d) => sum + d.totalCost, 0)
      
      // If no exact match or total doesn't match, include project-wide equipment
      if (matchedTotal === 0 || Math.abs(matchedTotal - targetCost) > 0.01) {
        console.log(`  Exact match total: $${matchedTotal} (target: $${targetCost})`)
        
        // Include project-wide equipment (empty or 'GENERAL' discipline)
        const projectWideDetails = equipmentDetails.filter(detail => 
          !detail.sourceDiscipline || 
          detail.sourceDiscipline === 'GENERAL' ||
          detail.sourceDiscipline === ''
        )
        
        // If still no match, include all equipment as fallback
        if (matchedDetails.length === 0 && projectWideDetails.length === 0) {
          console.log(`  No discipline-specific or project-wide equipment found, including all equipment`)
          matchedDetails = [...equipmentDetails]
        } else {
          matchedDetails = [...matchedDetails, ...projectWideDetails]
        }
        
        matchedTotal = matchedDetails.reduce((sum, d) => sum + d.totalCost, 0)
        console.log(`  Including project-wide equipment, new total: $${matchedTotal}`)
      }
      
      // Assign equipment details to discipline
      discipline.equipmentDetails = matchedDetails
      
      // Calculate breakdown
      const breakdown = {
        rentalCost: matchedDetails.reduce((sum, d) => sum + d.equipmentCost, 0),
        fogCost: matchedDetails.reduce((sum, d) => sum + d.fogCost, 0),
        maintenanceCost: matchedDetails.reduce((sum, d) => sum + d.maintenanceCost, 0),
        total: matchedTotal
      }
      discipline.equipmentCostBreakdown = breakdown
      
      console.log(`  Matched ${matchedDetails.length} equipment items:`)
      console.log(`    - Rental: $${breakdown.rentalCost}`)
      console.log(`    - FOG: $${breakdown.fogCost}`)
      console.log(`    - Maintenance: $${breakdown.maintenanceCost}`)
      console.log(`    - Total: $${breakdown.total}`)
      
      // Warn if totals don't match
      if (Math.abs(matchedTotal - targetCost) > 0.01) {
        console.log(`  ⚠️  WARNING: Total ($${matchedTotal}) doesn't match target ($${targetCost})`)
      }
    })
  }

  /**
   * Extract equipment details from GENERAL EQUIPMENT sheet
   */
  extractGeneralEquipmentData(workbook: XLSX.WorkBook): EquipmentDetail[] {
    const equipmentDetails: EquipmentDetail[] = []
    const sheet = workbook.Sheets['GENERAL EQUIPMENT']
    
    if (!sheet) {
      console.log('GENERAL EQUIPMENT sheet not found')
      return equipmentDetails
    }
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    console.log('GENERAL EQUIPMENT sheet has', data.length, 'rows')
    
    // Process rows starting from row 2 (skip header)
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      if (!row) continue
      
      // Extract values from columns
      const used = row[0] // Column A: USED
      const discipline = String(row[1] || '').trim() // Column B: DISCIPLINE
      const type = String(row[2] || '').trim() // Column C: TYPE
      const description = String(row[3] || '').trim() // Column D: DESCRIPTION
      const quantity = this.parseNumericValue(row[4]) // Column E: QUANTITY
      const duration = this.parseNumericValue(row[5]) // Column F: DURATION
      const durationType = String(row[6] || '').trim() // Column G: DURATION TYPE
      const fueled = String(row[7] || '').trim() // Column H: FUELDED
      
      // Rate columns (I-M)
      const eachRate = this.parseNumericValue(row[8])
      const hourlyRate = this.parseNumericValue(row[9])
      const dailyRate = this.parseNumericValue(row[10])
      const weeklyRate = this.parseNumericValue(row[11])
      const monthlyRate = this.parseNumericValue(row[12])
      
      // Multipliers and costs
      const fogMultiplier = this.parseNumericValue(row[13]) // Column N: F.O.G. X
      const maintMultiplier = this.parseNumericValue(row[14]) // Column O: MAINT. X
      const rateUsed = this.parseNumericValue(row[15]) // Column P: RATE USED
      const equipmentCost = this.parseNumericValue(row[16]) // Column Q: EQUIPMENT COST
      const fogCost = this.parseNumericValue(row[17]) // Column R: F.O.G. COST
      const maintenanceCost = this.parseNumericValue(row[18]) // Column S: MAINTENANCE
      
      // Only process rows with non-zero equipment cost
      if (equipmentCost > 0 || fogCost > 0 || maintenanceCost > 0) {
        const totalCost = equipmentCost + fogCost + maintenanceCost
        
        const detail: EquipmentDetail = {
          description,
          quantity,
          duration,
          durationType,
          fueled,
          rateUsed,
          equipmentCost,
          fogCost,
          maintenanceCost,
          totalCost,
          sourceDiscipline: discipline || undefined,
          sourceRow: rowIndex + 1 // Excel rows are 1-based
        }
        
        equipmentDetails.push(detail)
        
        console.log(`Row ${rowIndex + 1}: ${description} - Equipment: $${equipmentCost}, FOG: $${fogCost}, Maint: $${maintenanceCost}, Total: $${totalCost}`)
      }
    }
    
    // Log summary
    const totalEquipmentCost = equipmentDetails.reduce((sum, d) => sum + d.equipmentCost, 0)
    const totalFogCost = equipmentDetails.reduce((sum, d) => sum + d.fogCost, 0)
    const totalMaintCost = equipmentDetails.reduce((sum, d) => sum + d.maintenanceCost, 0)
    const grandTotal = equipmentDetails.reduce((sum, d) => sum + d.totalCost, 0)
    
    console.log(`\nGENERAL EQUIPMENT Summary:`)
    console.log(`  Equipment items: ${equipmentDetails.length}`)
    console.log(`  Total Equipment Cost: $${totalEquipmentCost}`)
    console.log(`  Total FOG Cost: $${totalFogCost}`)
    console.log(`  Total Maintenance: $${totalMaintCost}`)
    console.log(`  Grand Total: $${grandTotal}`)
    
    return equipmentDetails
  }

  /**
   * Convert BUDGETS sheet discipline data to BudgetLineItems with simplified allocation logic
   */
  convertDisciplinesToLineItems(disciplines: BudgetSheetDiscipline[]): BudgetLineItem[] {
    const items: BudgetLineItem[] = []
    let rowCounter = 1
    
    disciplines.forEach(disc => {
      // Calculate base amounts for proportional distributions
      const baseAmounts = {
        directLabor: disc.categories['DIRECT LABOR']?.value || 0,
        indirectLabor: disc.categories['INDIRECT LABOR']?.value || 0,
        materials: disc.categories['MATERIALS']?.value || 0,
        equipment: disc.categories['EQUIPMENT']?.value || 0,
        subcontracts: disc.categories['SUBCONTRACTS']?.value || 0,
        smallTools: disc.categories['SMALL TOOLS & CONSUMABLES']?.value || 0
      }
      
      // Calculate add-on amounts
      const addOns = {
        taxesInsurance: disc.categories['TAXES & INSURANCE']?.value || 0,
        perdiem: disc.categories['PERDIEM']?.value || 0,
        addOns: disc.categories['ADD ONS']?.value || 0,
        scaffolding: disc.categories['SCAFFOLDING']?.value || 0,
        risk: disc.categories['RISK']?.value || 0
      }
      
      // Calculate total base for proportional distributions
      const totalLaborBase = baseAmounts.directLabor + baseAmounts.indirectLabor
      const totalAllBase = Object.values(baseAmounts).reduce((sum, val) => sum + val, 0)
      
      // Calculate proportional distributions
      let directLaborAdditions = 0
      let indirectLaborAdditions = 0
      let staffLaborAdditions = 0
      let materialsAdditions = 0
      let equipmentAdditions = 0
      let subcontractsAdditions = 0
      let smallToolsAdditions = 0
      
      // Taxes & Insurance: Distribute across all labor proportionally
      if (addOns.taxesInsurance > 0 && totalLaborBase > 0) {
        directLaborAdditions += (baseAmounts.directLabor / totalLaborBase) * addOns.taxesInsurance
        indirectLaborAdditions += (baseAmounts.indirectLabor / totalLaborBase) * addOns.taxesInsurance
        // Staff gets remaining if any (in case we add staff logic later)
      }
      
      // Perdiem: Distribute between Direct + Indirect proportionally
      if (addOns.perdiem > 0 && totalLaborBase > 0) {
        directLaborAdditions += (baseAmounts.directLabor / totalLaborBase) * addOns.perdiem
        indirectLaborAdditions += (baseAmounts.indirectLabor / totalLaborBase) * addOns.perdiem
      }
      
      // Add Ons: Add entirely to Indirect
      indirectLaborAdditions += addOns.addOns
      
      // Scaffolding: Add entirely to Subcontracts
      subcontractsAdditions += addOns.scaffolding
      
      // Risk: Distribute proportionally across ALL categories
      if (addOns.risk > 0 && totalAllBase > 0) {
        directLaborAdditions += (baseAmounts.directLabor / totalAllBase) * addOns.risk
        indirectLaborAdditions += (baseAmounts.indirectLabor / totalAllBase) * addOns.risk
        materialsAdditions += (baseAmounts.materials / totalAllBase) * addOns.risk
        equipmentAdditions += (baseAmounts.equipment / totalAllBase) * addOns.risk
        subcontractsAdditions += (baseAmounts.subcontracts / totalAllBase) * addOns.risk
        smallToolsAdditions += (baseAmounts.smallTools / totalAllBase) * addOns.risk
      }
      
      // Create simplified line items (only for categories with values > 0)
      const finalAmounts = {
        laborDirect: baseAmounts.directLabor + directLaborAdditions,
        laborIndirect: baseAmounts.indirectLabor + indirectLaborAdditions,
        laborStaff: staffLaborAdditions, // Currently 0, but ready for future use
        materials: baseAmounts.materials + materialsAdditions,
        equipment: baseAmounts.equipment + equipmentAdditions,
        subcontracts: baseAmounts.subcontracts + subcontractsAdditions,
        smallTools: baseAmounts.smallTools + smallToolsAdditions
      }
      
      // Create line items for each category with positive amounts
      if (finalAmounts.laborDirect > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'LABOR',
          subcategory: 'DIRECT',
          wbs_code: 'L-001',
          cost_type: 'Direct Labor',
          description: `${disc.discipline} - Direct Labor (incl. proportional add-ons)`,
          total_cost: finalAmounts.laborDirect,
          labor_direct_cost: finalAmounts.laborDirect,
          labor_indirect_cost: 0,
          labor_staff_cost: 0,
          materials_cost: 0,
          equipment_cost: 0,
          subcontracts_cost: 0,
          small_tools_cost: 0,
          manhours: disc.categories['DIRECT LABOR']?.manhours || 0
        })
      }
      
      if (finalAmounts.laborIndirect > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'LABOR',
          subcategory: 'INDIRECT',
          wbs_code: 'L-002',
          cost_type: 'Indirect Labor',
          description: `${disc.discipline} - Indirect Labor (incl. add-ons, perdiem, proportional others)`,
          total_cost: finalAmounts.laborIndirect,
          labor_direct_cost: 0,
          labor_indirect_cost: finalAmounts.laborIndirect,
          labor_staff_cost: 0,
          materials_cost: 0,
          equipment_cost: 0,
          subcontracts_cost: 0,
          small_tools_cost: 0,
          manhours: disc.categories['INDIRECT LABOR']?.manhours || 0
        })
      }
      
      if (finalAmounts.laborStaff > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'LABOR',
          subcategory: 'STAFF',
          wbs_code: 'L-003',
          cost_type: 'Staff Labor',
          description: `${disc.discipline} - Staff Labor`,
          total_cost: finalAmounts.laborStaff,
          labor_direct_cost: 0,
          labor_indirect_cost: 0,
          labor_staff_cost: finalAmounts.laborStaff,
          materials_cost: 0,
          equipment_cost: 0,
          subcontracts_cost: 0,
          small_tools_cost: 0,
          manhours: 0
        })
      }
      
      if (finalAmounts.materials > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'NON_LABOR',
          subcategory: 'MATERIALS',
          wbs_code: 'N-001',
          cost_type: 'Materials',
          description: `${disc.discipline} - Materials (incl. proportional risk)`,
          total_cost: finalAmounts.materials,
          labor_direct_cost: 0,
          labor_indirect_cost: 0,
          labor_staff_cost: 0,
          materials_cost: finalAmounts.materials,
          equipment_cost: 0,
          subcontracts_cost: 0,
          small_tools_cost: 0,
          manhours: 0
        })
      }
      
      if (finalAmounts.equipment > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'NON_LABOR',
          subcategory: 'EQUIPMENT',
          wbs_code: 'N-002',
          cost_type: 'Equipment',
          description: `${disc.discipline} - Equipment (incl. proportional risk)`,
          total_cost: finalAmounts.equipment,
          labor_direct_cost: 0,
          labor_indirect_cost: 0,
          labor_staff_cost: 0,
          materials_cost: 0,
          equipment_cost: finalAmounts.equipment,
          subcontracts_cost: 0,
          small_tools_cost: 0,
          manhours: 0
        })
      }
      
      if (finalAmounts.subcontracts > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'NON_LABOR',
          subcategory: 'SUBCONTRACTS',
          wbs_code: 'N-003',
          cost_type: 'Subcontracts',
          description: `${disc.discipline} - Subcontracts (incl. scaffolding, proportional risk)`,
          total_cost: finalAmounts.subcontracts,
          labor_direct_cost: 0,
          labor_indirect_cost: 0,
          labor_staff_cost: 0,
          materials_cost: 0,
          equipment_cost: 0,
          subcontracts_cost: finalAmounts.subcontracts,
          small_tools_cost: 0,
          manhours: 0
        })
      }
      
      if (finalAmounts.smallTools > 0) {
        items.push({
          source_sheet: 'BUDGETS',
          source_row: rowCounter++,
          discipline: disc.discipline,
          category: 'NON_LABOR',
          subcategory: 'SMALL_TOOLS',
          wbs_code: 'N-004',
          cost_type: 'Small Tools & Consumables',
          description: `${disc.discipline} - Small Tools & Consumables (incl. proportional risk)`,
          total_cost: finalAmounts.smallTools,
          labor_direct_cost: 0,
          labor_indirect_cost: 0,
          labor_staff_cost: 0,
          materials_cost: 0,
          equipment_cost: 0,
          subcontracts_cost: 0,
          small_tools_cost: finalAmounts.smallTools,
          manhours: 0
        })
      }
    })
    
    return items
  }
  
  /**
   * Build WBS hierarchy from all extracted items
   */
  /**
   * Populate predefined WBS structure with budget data
   */
  private populatePredefinedWBS(items: BudgetLineItem[]): WBSNode[] {
    // Deep clone the predefined WBS to avoid mutations
    const wbsStructure = JSON.parse(JSON.stringify(this.predefinedWBS))
    
    // Create a map for quick lookup
    const wbsMap = new Map<string, WBSNode>()
    
    const indexWBS = (nodes: WBSNode[]) => {
      nodes.forEach(node => {
        wbsMap.set(node.code, node)
        if (node.children && node.children.length > 0) {
          indexWBS(node.children)
        }
      })
    }
    
    indexWBS(wbsStructure)
    
    // Reset all totals
    wbsMap.forEach(node => {
      node.budget_total = 0
      node.manhours_total = 0
      node.material_cost = 0
    })
    
    // Populate with budget data
    items.forEach(item => {
      // Try to match item to WBS node by discipline
      let targetNode: WBSNode | undefined
      
      if (item.discipline) {
        // Find the parent node for this discipline
        const parentNode = Array.from(wbsMap.values()).find(
          node => node.level === 1 && node.description === item.discipline.toUpperCase()
        )
        
        if (parentNode) {
          // Check if this is a demo item
          const isDemo = item.description.toUpperCase().includes('DEMO')
          
          // Find matching child node
          if (parentNode.children && parentNode.children.length > 0) {
            targetNode = parentNode.children.find(child => {
              const childDesc = child.description.toUpperCase()
              const itemDesc = item.description.toUpperCase()
              
              // Match demo items to demo nodes
              if (isDemo && childDesc.includes('DEMO')) {
                return itemDesc.includes(childDesc.replace(' DEMO', ''))
              }
              
              // Match non-demo items to non-demo nodes
              if (!isDemo && !childDesc.includes('DEMO')) {
                // Check for specific discipline match
                return childDesc === item.subcategory?.toUpperCase() ||
                       itemDesc.includes(childDesc) ||
                       childDesc.includes(itemDesc.split(' ')[0])
              }
              
              return false
            })
          }
          
          // If no specific child match, add to parent
          if (!targetNode) {
            targetNode = parentNode
          }
        }
      }
      
      // If we found a matching node, add the budget data
      if (targetNode) {
        targetNode.budget_total += item.total_cost
        if (item.manhours) {
          targetNode.manhours_total = (targetNode.manhours_total || 0) + item.manhours
        }
        if (item.material_cost) {
          targetNode.material_cost = (targetNode.material_cost || 0) + item.material_cost
        }
      }
    })
    
    // Roll up totals from children to parents
    const rollupTotals = (nodes: WBSNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          // First roll up children
          rollupTotals(node.children)
          
          // Then sum children to parent
          node.children.forEach(child => {
            node.budget_total += child.budget_total
            node.manhours_total = (node.manhours_total || 0) + (child.manhours_total || 0)
            node.material_cost = (node.material_cost || 0) + (child.material_cost || 0)
          })
        }
      })
    }
    
    rollupTotals(wbsStructure)
    
    return wbsStructure
  }
  
  buildWBSHierarchy(items: BudgetLineItem[]): WBSNode[] {
    const wbsMap = new Map<string, WBSNode>()
    const rootNodes: WBSNode[] = []
    
    // First pass: create all nodes
    items.forEach(item => {
      if (!item.wbs_code) return
      
      if (!wbsMap.has(item.wbs_code)) {
        const levels = this.parseWBSLevels(item.wbs_code)
        const level = Object.values(levels).filter(v => v).length
        
        const node: WBSNode = {
          code: item.wbs_code,
          level,
          description: item.description,
          children: [],
          budget_total: 0
        }
        
        // Determine parent code
        if (levels.level3 && levels.level2 && levels.level1) {
          node.parent_code = `${levels.level1}-${levels.level2}`
        } else if (levels.level2 && levels.level1) {
          node.parent_code = levels.level1
        }
        
        wbsMap.set(item.wbs_code, node)
      }
      
      // Add to budget total
      wbsMap.get(item.wbs_code)!.budget_total += item.total_cost
    })
    
    // Second pass: build hierarchy
    wbsMap.forEach(node => {
      if (node.parent_code && wbsMap.has(node.parent_code)) {
        wbsMap.get(node.parent_code)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    
    // Sort nodes by code
    const sortNodes = (nodes: WBSNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code))
      nodes.forEach(node => sortNodes(node.children))
    }
    
    sortNodes(rootNodes)
    
    return rootNodes
  }
  
  /**
   * Build WBS structure from BUDGETS sheet disciplines
   */
  private buildWBSFromBudgetDisciplines(disciplines: BudgetSheetDiscipline[]): WBSNode[] {
    // Extract discipline names
    const disciplineNames = disciplines.map(d => d.discipline.toUpperCase())
    
    // Create discipline mapping using DisciplineMapper
    const projectDisciplines = DisciplineMapper.createDisciplineMapping(disciplineNames)
    
    // Build WBS nodes
    const wbsNodes: WBSNode[] = []
    let codeCounter = 1
    
    // Create WBS nodes for each discipline group
    Object.entries(projectDisciplines.disciplineGroups).forEach(([groupName, mapping]) => {
      const parentCode = String(codeCounter).padStart(2, '0')
      const parentNode: WBSNode = {
        code: parentCode,
        parent_code: undefined,
        level: 1,
        description: groupName.toUpperCase(),
        discipline: groupName,
        children: [],
        budget_total: 0,
        manhours_total: 0,
        material_cost: 0
      }
      
      // Add child nodes for each discipline in the group
      let childCounter = 1
      mapping.childDisciplines.forEach(childDiscipline => {
        const childCode = `${parentCode}.${String(childCounter).padStart(2, '0')}`
        
        // Find the budget data for this discipline
        const budgetData = disciplines.find(d => d.discipline.toUpperCase() === childDiscipline)
        
        const childNode: WBSNode = {
          code: childCode,
          parent_code: parentCode,
          level: 2,
          description: childDiscipline,
          discipline: groupName,
          children: [],
          budget_total: budgetData?.value || 0,
          manhours_total: budgetData?.manhours || 0,
          material_cost: budgetData?.categories['MATERIALS']?.value || 0
        }
        
        parentNode.children.push(childNode)
        parentNode.budget_total += childNode.budget_total
        parentNode.manhours_total += childNode.manhours_total || 0
        parentNode.material_cost += childNode.material_cost || 0
        
        childCounter++
      })
      
      wbsNodes.push(parentNode)
      codeCounter++
    })
    
    return wbsNodes
  }
  
  /**
   * Main method to analyze and extract all budget data from workbook
   */
  async extractBudgetData(workbook: XLSX.WorkBook): Promise<ExcelBudgetData> {
    const budgetData: ExcelBudgetData = {
      summary: {},
      details: {},
      wbsStructure: [],
      totals: {
        laborDirect: 0,
        laborIndirect: 0,
        laborStaff: 0,
        materials: 0,
        equipment: 0,
        subcontracts: 0,
        smallTools: 0,
        totalLabor: 0,
        totalNonLabor: 0,
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
    
    const allItems: BudgetLineItem[] = []
    
    // First, extract detailed budget data from BUDGETS sheet
    const budgetDisciplines = this.extractBudgetSheetDisciplines(workbook)
    if (budgetDisciplines.length > 0) {
      budgetData.disciplineBudgets = budgetDisciplines
      
      // Extract equipment details from GENERAL EQUIPMENT sheet
      const equipmentDetails = this.extractGeneralEquipmentData(workbook)
      
      // Match equipment to disciplines
      if (equipmentDetails.length > 0) {
        this.matchEquipmentToDisciplines(budgetDisciplines, equipmentDetails)
      }
      
      // Convert to line items for storage
      const budgetItems = this.convertDisciplinesToLineItems(budgetDisciplines)
      if (budgetItems.length > 0) {
        budgetData.details['BUDGETS'] = budgetItems
        allItems.push(...budgetItems)
        
        // Update totals from BUDGETS sheet using new structure
        budgetItems.forEach(item => {
          budgetData.totals.laborDirect += item.labor_direct_cost
          budgetData.totals.laborIndirect += item.labor_indirect_cost
          budgetData.totals.laborStaff += item.labor_staff_cost
          budgetData.totals.materials += item.materials_cost
          budgetData.totals.equipment += item.equipment_cost
          budgetData.totals.subcontracts += item.subcontracts_cost
          budgetData.totals.smallTools += item.small_tools_cost
          
          // Update aggregate totals
          budgetData.totals.totalLabor += item.labor_direct_cost + item.labor_indirect_cost + item.labor_staff_cost
          budgetData.totals.totalNonLabor += item.materials_cost + item.equipment_cost + item.subcontracts_cost + item.small_tools_cost
          budgetData.totals.grandTotal += item.total_cost
          
          // Update manhours
          if (item.manhours) {
            if (item.subcategory === 'DIRECT') {
              budgetData.totals.directLaborManhours += item.manhours
            } else if (item.subcategory === 'INDIRECT') {
              budgetData.totals.indirectLaborManhours += item.manhours
            }
            budgetData.totals.totalManhours += item.manhours
          }
        })
      }
    }
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      // Skip INPUT sheet - it's handled separately
      if (sheetName.toUpperCase() === 'INPUT' || sheetName.toUpperCase() === 'INPUTS') {
        console.log(`Skipping INPUT sheet - handled separately`)
        continue
      }
      
      // Filter to only allowed sheets
      if (!this.ALLOWED_SHEETS.includes(sheetName)) {
        console.log(`Skipping sheet '${sheetName}' - not in allowed list`)
        budgetData.validation.warnings.push(`Sheet '${sheetName}' was skipped (not in allowed list)`)
        continue
      }
      
      const worksheet = workbook.Sheets[sheetName]
      const mapping = this.sheetMappings[sheetName]
      
      if (!mapping) {
        console.log(`No mapping found for sheet: ${sheetName}`)
        budgetData.validation.errors.push(`No mapping configuration found for required sheet: ${sheetName}`)
        continue
      }
      
      try {
        const structure = this.detectSheetStructure(worksheet)
        
        if (structure.headerRow === -1) {
          budgetData.validation.warnings.push(`Could not detect header row in sheet: ${sheetName}`)
          continue
        }
        
        const items = this.extractSheetData(worksheet, sheetName, structure, mapping)
        
        if (items.length === 0) {
          budgetData.validation.warnings.push(`No valid data found in sheet: ${sheetName}`)
          continue
        }
        
        budgetData.details[sheetName] = items
        allItems.push(...items)
        
        // Update totals using new structure
        items.forEach(item => {
          budgetData.totals.laborDirect += item.labor_direct_cost
          budgetData.totals.laborIndirect += item.labor_indirect_cost
          budgetData.totals.laborStaff += item.labor_staff_cost
          budgetData.totals.materials += item.materials_cost
          budgetData.totals.equipment += item.equipment_cost
          budgetData.totals.subcontracts += item.subcontracts_cost
          budgetData.totals.smallTools += item.small_tools_cost
          
          // Update aggregate totals
          budgetData.totals.totalLabor += item.labor_direct_cost + item.labor_indirect_cost + item.labor_staff_cost
          budgetData.totals.totalNonLabor += item.materials_cost + item.equipment_cost + item.subcontracts_cost + item.small_tools_cost
          budgetData.totals.grandTotal += item.total_cost
          
          // Update manhours
          if (item.manhours) {
            if (item.subcategory === 'DIRECT') {
              budgetData.totals.directLaborManhours += item.manhours
            } else if (item.subcategory === 'INDIRECT') {
              budgetData.totals.indirectLaborManhours += item.manhours
            }
            budgetData.totals.totalManhours += item.manhours
          }
        })
        
      } catch (error) {
        budgetData.validation.errors.push(`Error processing sheet ${sheetName}: ${error}`)
      }
    }
    
    // Build WBS hierarchy from BUDGETS sheet disciplines
    if (budgetDisciplines.length > 0) {
      budgetData.wbsStructure = this.buildWBSFromBudgetDisciplines(budgetDisciplines)
    } else if (this.predefinedWBS && this.predefinedWBS.length > 0) {
      budgetData.wbsStructure = this.populatePredefinedWBS(allItems)
    } else {
      budgetData.wbsStructure = this.buildWBSHierarchy(allItems)
    }
    
    // Add validation for WBS coverage
    const itemsWithoutWBS = allItems.filter(item => !item.wbs_code).length
    if (itemsWithoutWBS > 0) {
      budgetData.validation.warnings.push(
        `${itemsWithoutWBS} items do not have WBS codes assigned`
      )
    }
    
    return budgetData
  }
  
  /**
   * Save extracted budget data to database
   */
  async saveBudgetData(
    projectId: string,
    budgetData: ExcelBudgetData,
    userId: string
  ): Promise<{ success: boolean; error?: string; stats?: any }> {
    const adminSupabase = createAdminClient()
    const importBatchId = crypto.randomUUID()
    
    try {
      // 1. Save WBS structure
      const wbsNodes: Array<{
        project_id: string
        code: string
        parent_code?: string
        level: number
        description?: string
        budget_total: number
      }> = []
      const flattenWBS = (nodes: WBSNode[], parentCode?: string) => {
        nodes.forEach(node => {
          wbsNodes.push({
            project_id: projectId,
            code: node.code,
            parent_code: node.parent_code || parentCode,
            level: node.level,
            description: node.description,
            budget_total: node.budget_total
          })
          if (node.children.length > 0) {
            flattenWBS(node.children, node.code)
          }
        })
      }
      
      flattenWBS(budgetData.wbsStructure)
      
      if (wbsNodes.length > 0) {
        const { error: wbsError } = await adminSupabase
          .from('wbs_structure')
          .upsert(wbsNodes, {
            onConflict: 'project_id,code',
            ignoreDuplicates: false
          })
        
        if (wbsError) throw wbsError
      }
      
      // 2. Save all budget line items
      const allItems: Array<BudgetLineItem & { project_id: string; import_batch_id: string; cost_type?: string }> = []
      
      Object.entries(budgetData.details).forEach(([ , items]) => {
        items.forEach(item => {
          allItems.push({
            ...item,
            project_id: projectId,
            import_batch_id: importBatchId,
            cost_type: item.cost_type  // Include cost_type field
          })
        })
      })
      
      if (allItems.length > 0) {
        const { error: itemsError } = await adminSupabase
          .from('budget_line_items')
          .insert(allItems)
        
        if (itemsError) throw itemsError
      }
      
      // 3. Calculate detailed totals for projects table
      let laborDirectTotal = 0
      let laborIndirectTotal = 0
      let laborStaffTotal = 0
      let materialsTotal = 0
      let equipmentTotal = 0
      let subcontractsTotal = 0
      let smallToolsTotal = 0
      
      allItems.forEach(item => {
        laborDirectTotal += item.labor_direct_cost
        laborIndirectTotal += item.labor_indirect_cost
        laborStaffTotal += item.labor_staff_cost
        materialsTotal += item.materials_cost
        equipmentTotal += item.equipment_cost
        subcontractsTotal += item.subcontracts_cost
        smallToolsTotal += item.small_tools_cost
      })
      
      const totalLaborBudget = laborDirectTotal + laborIndirectTotal + laborStaffTotal
      const totalNonLaborBudget = materialsTotal + equipmentTotal + subcontractsTotal + smallToolsTotal
      const grandTotal = totalLaborBudget + totalNonLaborBudget
      
      // Update projects table with budget summary
      const { error: updateError } = await adminSupabase
        .from('projects')
        .update({
          labor_direct_budget: laborDirectTotal,
          labor_indirect_budget: laborIndirectTotal,
          labor_staff_budget: laborStaffTotal,
          materials_budget: materialsTotal,
          equipment_budget: equipmentTotal,
          subcontracts_budget: subcontractsTotal,
          small_tools_budget: smallToolsTotal,
          total_labor_budget: totalLaborBudget,
          total_non_labor_budget: totalNonLaborBudget,
          total_budget: grandTotal,
          budget_imported_at: new Date().toISOString(),
          budget_imported_by: userId
        })
        .eq('id', projectId)
      
      if (updateError) throw updateError
      
      return {
        success: true,
        stats: {
          wbsCodesCreated: wbsNodes.length,
          lineItemsImported: allItems.length,
          totalBudget: grandTotal,
          byCategory: {
            laborDirect: laborDirectTotal,
            laborIndirect: laborIndirectTotal,
            laborStaff: laborStaffTotal,
            materials: materialsTotal,
            equipment: equipmentTotal,
            subcontracts: subcontractsTotal,
            smallTools: smallToolsTotal,
            totalLabor: totalLaborBudget,
            totalNonLabor: totalNonLaborBudget,
            grandTotal: grandTotal
          }
        }
      }
      
    } catch (error) {
      console.error('Error saving budget data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}