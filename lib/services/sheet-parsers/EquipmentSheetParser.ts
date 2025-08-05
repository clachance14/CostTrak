import * as XLSX from 'xlsx'

export interface EquipmentItem {
  discipline: string
  description: string
  quantity: number
  duration: number
  durationType?: string
  equipmentCost: number
  fogCost: number // Fuel, Oil, Grease
  maintenanceCost: number
  totalCost: number
  sourceRow: number
}

export interface EquipmentDisciplineData {
  disciplineName: string
  items: EquipmentItem[]
  totals: {
    equipmentCost: number
    fogCost: number
    maintenanceCost: number
    totalCost: number
  }
}

export interface EquipmentParseResult {
  disciplines: EquipmentDisciplineData[]
  projectWideItems: EquipmentItem[] // Items without specific discipline
  totals: {
    equipmentCost: number
    fogCost: number
    maintenanceCost: number
    grandTotal: number
  }
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class EquipmentSheetParser {
  parse(worksheet: XLSX.WorkSheet): EquipmentParseResult {
    const result: EquipmentParseResult = {
      disciplines: [],
      projectWideItems: [],
      totals: {
        equipmentCost: 0,
        fogCost: 0,
        maintenanceCost: 0,
        grandTotal: 0
      },
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push('GENERAL EQUIPMENT sheet is empty or has insufficient data')
      return result
    }

    // Map to store items by discipline
    const disciplineMap = new Map<string, EquipmentDisciplineData>()

    // Process rows starting from row 2 (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length < 19) continue // Need at least up to column S

      // Extract columns based on Grok's information
      const used = row[0] // Column A: USED
      const discipline = String(row[1] || '').trim() // Column B: DISCIPLINE
      const type = String(row[2] || '').trim() // Column C: TYPE
      const description = String(row[3] || '').trim() // Column D: DESCRIPTION
      const quantity = this.parseNumericValue(row[4]) // Column E: QUANTITY
      const duration = this.parseNumericValue(row[5]) // Column F: DURATION
      const durationType = String(row[6] || '').trim() // Column G: DURATION TYPE
      const equipmentCost = this.parseNumericValue(row[16]) // Column Q: EQUIPMENT COST
      const fogCost = this.parseNumericValue(row[17]) // Column R: F.O.G. COST
      const maintenanceCost = this.parseNumericValue(row[18]) // Column S: MAINTENANCE

      // Skip rows with no costs
      if (equipmentCost === 0 && fogCost === 0 && maintenanceCost === 0) continue

      const totalCost = equipmentCost + fogCost + maintenanceCost

      const item: EquipmentItem = {
        discipline: discipline || 'GENERAL',
        description,
        quantity,
        duration,
        durationType,
        equipmentCost,
        fogCost,
        maintenanceCost,
        totalCost,
        sourceRow: i + 1 // Excel rows are 1-based
      }

      // Add to appropriate collection
      if (!discipline || discipline === 'GENERAL' || discipline === '') {
        result.projectWideItems.push(item)
      } else {
        // Get or create discipline data
        if (!disciplineMap.has(discipline)) {
          disciplineMap.set(discipline, {
            disciplineName: discipline,
            items: [],
            totals: {
              equipmentCost: 0,
              fogCost: 0,
              maintenanceCost: 0,
              totalCost: 0
            }
          })
        }
        
        const disciplineData = disciplineMap.get(discipline)!
        disciplineData.items.push(item)
        
        // Update discipline totals
        disciplineData.totals.equipmentCost += equipmentCost
        disciplineData.totals.fogCost += fogCost
        disciplineData.totals.maintenanceCost += maintenanceCost
        disciplineData.totals.totalCost += totalCost
      }

      // Update grand totals
      result.totals.equipmentCost += equipmentCost
      result.totals.fogCost += fogCost
      result.totals.maintenanceCost += maintenanceCost
      result.totals.grandTotal += totalCost
    }

    // Convert map to array
    result.disciplines = Array.from(disciplineMap.values())

    // Validation
    if (result.disciplines.length === 0 && result.projectWideItems.length === 0) {
      result.validation.errors.push('No equipment items found in GENERAL EQUIPMENT sheet')
    }

    // Log summary
    console.log(`Equipment Parser Summary:`)
    console.log(`  Disciplines with equipment: ${result.disciplines.length}`)
    console.log(`  Project-wide items: ${result.projectWideItems.length}`)
    console.log(`  Total Equipment Cost: $${result.totals.equipmentCost.toFixed(2)}`)
    console.log(`  Total FOG Cost: $${result.totals.fogCost.toFixed(2)}`)
    console.log(`  Total Maintenance: $${result.totals.maintenanceCost.toFixed(2)}`)
    console.log(`  Grand Total: $${result.totals.grandTotal.toFixed(2)}`)

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
   * Validate against BUDGETS equipment values
   */
  validateAgainstBudget(
    parseResult: EquipmentParseResult,
    budgetTargets: Record<string, { equipmentValue: number }>
  ): { isValid: boolean; disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> } {
    const disciplineValidation: Array<{ discipline: string; isValid: boolean; difference: number }> = []
    let allValid = true
    
    parseResult.disciplines.forEach(disc => {
      const target = budgetTargets[disc.disciplineName]
      if (!target) {
        disciplineValidation.push({
          discipline: disc.disciplineName,
          isValid: false,
          difference: disc.totals.totalCost
        })
        allValid = false
      } else {
        const difference = Math.abs(disc.totals.totalCost - target.equipmentValue)
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
    parseResult: EquipmentParseResult,
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
    equipment_cost: number
    import_batch_id: string
    notes?: string
  }> {
    const items: Array<any> = []
    
    // Process discipline-specific equipment
    parseResult.disciplines.forEach(disc => {
      disc.items.forEach(item => {
        items.push({
          project_id: projectId,
          source_sheet: 'GENERAL EQUIPMENT',
          source_row: item.sourceRow,
          discipline: disc.disciplineName,
          category: 'EQUIPMENT',
          cost_type: 'Equipment',
          description: item.description,
          total_cost: item.totalCost,
          equipment_cost: item.equipmentCost,
          import_batch_id: importBatchId,
          notes: `FOG: $${item.fogCost.toFixed(2)}, Maintenance: $${item.maintenanceCost.toFixed(2)}`,
          labor_cost: 0,
          material_cost: 0,
          subcontract_cost: 0,
          other_cost: 0
        })
      })
    })
    
    // Process project-wide equipment
    parseResult.projectWideItems.forEach(item => {
      items.push({
        project_id: projectId,
        source_sheet: 'GENERAL EQUIPMENT',
        source_row: item.sourceRow,
        discipline: 'GENERAL',
        category: 'EQUIPMENT',
        cost_type: 'Equipment',
        description: item.description,
        total_cost: item.totalCost,
        equipment_cost: item.equipmentCost,
        import_batch_id: importBatchId,
        notes: `FOG: $${item.fogCost.toFixed(2)}, Maintenance: $${item.maintenanceCost.toFixed(2)}`,
        labor_cost: 0,
        material_cost: 0,
        subcontract_cost: 0,
        other_cost: 0
      })
    })
    
    return items
  }
}