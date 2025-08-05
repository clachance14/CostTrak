import * as XLSX from 'xlsx'

export interface DiscEquipmentItem {
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

export interface DiscEquipmentParseResult {
  disciplineName: string
  items: DiscEquipmentItem[]
  totals: {
    equipmentCost: number
    fogCost: number
    maintenanceCost: number
    totalCost: number
  }
  validation: {
    warnings: string[]
    errors: string[]
  }
}

export class DiscEquipmentSheetParser {
  /**
   * Parse discipline-specific equipment sheet (e.g., "DISC EQUIPMENT 01")
   * These sheets contain equipment specific to a single discipline
   */
  parse(worksheet: XLSX.WorkSheet, sheetName: string): DiscEquipmentParseResult {
    const result: DiscEquipmentParseResult = {
      disciplineName: this.extractDisciplineName(sheetName),
      items: [],
      totals: {
        equipmentCost: 0,
        fogCost: 0,
        maintenanceCost: 0,
        totalCost: 0
      },
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push(`${sheetName} is empty or has insufficient data`)
      return result
    }

    // Process rows starting from row 2 (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length < 19) continue // Need at least up to column S

      // Extract columns - same structure as GENERAL EQUIPMENT
      const used = row[0] // Column A: USED
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

      const item: DiscEquipmentItem = {
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

      result.items.push(item)

      // Update totals
      result.totals.equipmentCost += equipmentCost
      result.totals.fogCost += fogCost
      result.totals.maintenanceCost += maintenanceCost
      result.totals.totalCost += totalCost
    }

    // Validation
    if (result.items.length === 0) {
      result.validation.warnings.push(`No equipment items found in ${sheetName}`)
    }

    // Log summary
    console.log(`Discipline Equipment Parser Summary for ${result.disciplineName}:`)
    console.log(`  Items: ${result.items.length}`)
    console.log(`  Total Equipment Cost: $${result.totals.equipmentCost.toFixed(2)}`)
    console.log(`  Total FOG Cost: $${result.totals.fogCost.toFixed(2)}`)
    console.log(`  Total Maintenance: $${result.totals.maintenanceCost.toFixed(2)}`)
    console.log(`  Grand Total: $${result.totals.totalCost.toFixed(2)}`)

    return result
  }

  /**
   * Extract discipline name from sheet name
   * "DISC EQUIPMENT 01" -> "DISCIPLINE 01"
   * "DISC EQUIPMENT 02" -> "DISCIPLINE 02"
   */
  private extractDisciplineName(sheetName: string): string {
    const match = sheetName.match(/DISC\s+EQUIPMENT\s+(\d+)/i)
    if (match) {
      return `DISCIPLINE ${match[1]}`
    }
    return sheetName // Fallback to sheet name
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
   * Convert to budget line items for database storage
   */
  toBudgetLineItems(
    parseResult: DiscEquipmentParseResult,
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
    
    parseResult.items.forEach(item => {
      items.push({
        project_id: projectId,
        source_sheet: `DISC EQUIPMENT`,
        source_row: item.sourceRow,
        discipline: parseResult.disciplineName,
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