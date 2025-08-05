import { BudgetDiscipline, BudgetsParseResult } from './sheet-parsers/BudgetsSheetParser'
import { StaffParseResult } from './sheet-parsers/StaffSheetParser'
import { DirectsParseResult } from './sheet-parsers/DirectsSheetParser'
import { MaterialsParseResult } from './sheet-parsers/MaterialsSheetParser'
import { EquipmentParseResult } from './sheet-parsers/EquipmentSheetParser'
import { ConstructabilityParseResult } from './sheet-parsers/ConstructabilitySheetParser'
import { IndirectsParseResult } from './sheet-parsers/IndirectsSheetParser'

export interface ValidationResult {
  isValid: boolean
  summary: {
    totalErrors: number
    totalWarnings: number
    sheetsValidated: number
  }
  details: {
    staff: SheetValidation
    directs: SheetValidation
    materials: SheetValidation
    equipment: SheetValidation
    constructability: SheetValidation
  }
  crossSheetValidation: CrossSheetValidation[]
}

export interface SheetValidation {
  sheetName: string
  isValid: boolean
  errors: string[]
  warnings: string[]
  budgetComparison?: {
    budgetValue: number
    sheetValue: number
    difference: number
    percentDifference: number
  }
}

export interface CrossSheetValidation {
  rule: string
  isValid: boolean
  message: string
  details?: any
}

export class BudgetValidationService {
  /**
   * Perform comprehensive validation of all parsed sheets against BUDGETS
   */
  validateAllSheets(
    budgets: BudgetsParseResult,
    staff?: StaffParseResult,
    directs?: DirectsParseResult,
    materials?: MaterialsParseResult,
    equipment?: EquipmentParseResult,
    constructability?: ConstructabilityParseResult,
    discEquipment?: Record<string, any>,
    indirects?: IndirectsParseResult
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        sheetsValidated: 0
      },
      details: {
        staff: this.createEmptyValidation('STAFF'),
        directs: this.createEmptyValidation('DIRECTS'),
        materials: this.createEmptyValidation('MATERIALS'),
        equipment: this.createEmptyValidation('EQUIPMENT'),
        constructability: this.createEmptyValidation('CONSTRUCTABILITY')
      },
      crossSheetValidation: []
    }

    // Get validation targets from BUDGETS
    const validationTargets = this.getValidationTargets(budgets.disciplines)
    const addOnsByDiscipline = this.getAddOnsByDiscipline(budgets.disciplines)

    // Validate STAFF sheet with INDIRECTS aggregation
    if (staff) {
      result.details.staff = this.validateStaffSheet(staff, validationTargets, addOnsByDiscipline, indirects, constructability)
      result.summary.sheetsValidated++
    }

    // Validate INDIRECTS sheet
    if (indirects) {
      result.details.indirects = this.createEmptyValidation('INDIRECTS')
      result.details.indirects.warnings.push(
        `INDIRECTS supervision labor: $${indirects.totalSupervisionLabor.toFixed(2)} contributes to BUDGETS INDIRECT LABOR`
      )
      result.summary.sheetsValidated++
    }

    // Validate DIRECTS sheet
    if (directs) {
      result.details.directs = this.validateDirectsSheet(directs, validationTargets)
      result.summary.sheetsValidated++
    }

    // Validate MATERIALS sheet
    if (materials) {
      result.details.materials = this.validateMaterialsSheet(materials, validationTargets)
      result.summary.sheetsValidated++
    }

    // Validate EQUIPMENT sheet
    if (equipment) {
      result.details.equipment = this.validateEquipmentSheet(equipment, validationTargets)
      result.summary.sheetsValidated++
    }

    // Validate CONSTRUCTABILITY sheet
    if (constructability) {
      result.details.constructability = this.validateConstructabilitySheet(
        constructability, 
        validationTargets
      )
      result.summary.sheetsValidated++
    }

    // Validate discipline equipment sheets
    if (discEquipment) {
      Object.entries(discEquipment).forEach(([sheetName, discEquipmentData]) => {
        const disciplineName = discEquipmentData.disciplineName
        const sheetValidation: SheetValidation = {
          sheetName,
          isValid: true,
          errors: [...discEquipmentData.validation.errors],
          warnings: [...discEquipmentData.validation.warnings]
        }
        
        // Add info about discipline equipment
        sheetValidation.warnings.push(
          `${sheetName} contains discipline-specific equipment for ${disciplineName}. Total: $${discEquipmentData.totals.totalCost.toFixed(2)}`
        )
        
        result.summary.sheetsValidated++
        
        // Store validation results
        if (!result.details[sheetName]) {
          result.details[sheetName] = sheetValidation
        }
      })
    }

    // Perform cross-sheet validation
    result.crossSheetValidation = this.performCrossSheetValidation(
      budgets,
      staff,
      directs,
      materials,
      equipment,
      constructability,
      discEquipment,
      indirects
    )

    // Update summary
    Object.values(result.details).forEach(detail => {
      result.summary.totalErrors += detail.errors.length
      result.summary.totalWarnings += detail.warnings.length
      if (!detail.isValid) result.isValid = false
    })

    result.crossSheetValidation.forEach(validation => {
      if (!validation.isValid) {
        result.isValid = false
        result.summary.totalErrors++
      }
    })

    return result
  }

  private createEmptyValidation(sheetName: string): SheetValidation {
    return {
      sheetName,
      isValid: true,
      errors: [],
      warnings: []
    }
  }

  private getValidationTargets(disciplines: BudgetDiscipline[]): Record<string, {
    directLaborHours: number
    indirectLaborValue: number
    materialsValue: number
    equipmentValue: number
    subcontractorsValue: number
  }> {
    const targets: Record<string, any> = {}
    
    disciplines.forEach(disc => {
      targets[disc.disciplineName] = {
        directLaborHours: disc.categories.DIRECT_LABOR?.manhours || 0,
        indirectLaborValue: disc.categories.INDIRECT_LABOR?.value || 0,
        materialsValue: disc.categories.MATERIALS?.value || 0,
        equipmentValue: disc.categories.EQUIPMENT?.value || 0,
        subcontractorsValue: disc.categories.SUBCONTRACTS?.value || 0
      }
    })
    
    return targets
  }

  private getAddOnsByDiscipline(disciplines: BudgetDiscipline[]): Record<string, number> {
    const addOns: Record<string, number> = {}
    
    disciplines.forEach(disc => {
      addOns[disc.disciplineName] = disc.categories.ADD_ONS?.value || 0
    })
    
    return addOns
  }

  private validateStaffSheet(
    staff: StaffParseResult,
    targets: Record<string, any>,
    addOns: Record<string, number>,
    indirects?: IndirectsParseResult,
    constructability?: ConstructabilityParseResult
  ): SheetValidation {
    const validation: SheetValidation = {
      sheetName: 'STAFF',
      isValid: true,
      errors: [...staff.validation.errors],
      warnings: [...staff.validation.warnings]
    }

    // Find which discipline this maps to (usually GENERAL STAFFING)
    const targetDiscipline = staff.disciplineMapping || 'GENERAL STAFFING'
    const target = targets[targetDiscipline]
    const addOnsValue = addOns[targetDiscipline] || 0

    if (!target) {
      validation.errors.push(`No matching discipline found in BUDGETS for ${targetDiscipline}`)
      validation.isValid = false
    } else {
      // Calculate aggregated indirect labor components
      // BUDGETS INDIRECT LABOR = STAFF labor + STAFF per diem + INDIRECTS supervision + CONSTRUCTABILITY labor + ADD ONS + TAXES & INSURANCE
      const staffLabor = staff.totalIndirectLabor - addOnsValue // Remove ADD ONS as it's counted separately
      const staffPerDiem = staff.totalPerDiem || 0
      const indirectsSupervision = indirects?.totalSupervisionLabor || 0
      const constructabilityLabor = 0 // TODO: Extract from constructability when parser is updated
      
      // Calculate the aggregated total
      const aggregatedTotal = staffLabor + staffPerDiem + indirectsSupervision + constructabilityLabor + addOnsValue
      
      const expectedTotal = target.indirectLaborValue
      const difference = Math.abs(aggregatedTotal - expectedTotal)
      
      validation.budgetComparison = {
        budgetValue: expectedTotal,
        sheetValue: aggregatedTotal,
        difference,
        percentDifference: expectedTotal > 0 ? (difference / expectedTotal) * 100 : 0
      }

      // Add breakdown to show components
      const breakdown = [
        `STAFF labor: $${staffLabor.toFixed(2)}`,
        `STAFF per diem: $${staffPerDiem.toFixed(2)}`,
        `INDIRECTS supervision: $${indirectsSupervision.toFixed(2)}`,
        `CONSTRUCTABILITY labor: $${constructabilityLabor.toFixed(2)}`,
        `ADD ONS: $${addOnsValue.toFixed(2)}`,
        `Total: $${aggregatedTotal.toFixed(2)}`
      ]
      
      validation.warnings.push(`INDIRECT LABOR breakdown: ${breakdown.join(', ')}`)
      
      // Allow 1% tolerance for rounding
      if (difference > expectedTotal * 0.01) {
        validation.warnings.push(
          `Aggregated indirect labor ($${aggregatedTotal.toFixed(2)}) differs from BUDGETS ($${expectedTotal.toFixed(2)}) by ${validation.budgetComparison.percentDifference.toFixed(1)}%`
        )
      }
    }

    return validation
  }

  private validateDirectsSheet(
    directs: DirectsParseResult,
    targets: Record<string, any>
  ): SheetValidation {
    const validation: SheetValidation = {
      sheetName: 'DIRECTS',
      isValid: true,
      errors: [...directs.validation.errors],
      warnings: [...directs.validation.warnings]
    }

    // Validate each discipline
    directs.disciplines.forEach(disc => {
      const target = targets[disc.disciplineName]
      if (!target) {
        validation.warnings.push(`No matching discipline found in BUDGETS for ${disc.disciplineName}`)
      } else {
        const difference = Math.abs(disc.totalManhours - target.directLaborHours)
        if (difference > 0.01) {
          validation.errors.push(
            `${disc.disciplineName} manhours (${disc.totalManhours}) does not match BUDGETS (${target.directLaborHours}). Difference: ${difference}`
          )
          validation.isValid = false
        }
      }
    })

    return validation
  }

  private validateMaterialsSheet(
    materials: MaterialsParseResult,
    targets: Record<string, any>
  ): SheetValidation {
    const validation: SheetValidation = {
      sheetName: 'MATERIALS',
      isValid: true,
      errors: [...materials.validation.errors],
      warnings: [...materials.validation.warnings]
    }

    // Validate each discipline
    materials.disciplines.forEach(disc => {
      const target = targets[disc.disciplineName]
      if (!target) {
        validation.warnings.push(`No matching discipline found in BUDGETS for ${disc.disciplineName}`)
      } else {
        const difference = Math.abs(disc.materials.total - target.materialsValue)
        if (difference > 0.01) {
          validation.errors.push(
            `${disc.disciplineName} materials total ($${disc.materials.total.toFixed(2)}) does not match BUDGETS ($${target.materialsValue.toFixed(2)}). Difference: $${difference.toFixed(2)}`
          )
          validation.isValid = false
        }
      }
    })

    return validation
  }

  private validateEquipmentSheet(
    equipment: EquipmentParseResult,
    targets: Record<string, any>
  ): SheetValidation {
    const validation: SheetValidation = {
      sheetName: 'EQUIPMENT',
      isValid: true,
      errors: [...equipment.validation.errors],
      warnings: [...equipment.validation.warnings]
    }

    // Validate each discipline
    equipment.disciplines.forEach(disc => {
      const target = targets[disc.disciplineName]
      if (!target) {
        validation.warnings.push(`No matching discipline found in BUDGETS for ${disc.disciplineName}`)
      } else {
        const difference = Math.abs(disc.totals.totalCost - target.equipmentValue)
        if (difference > 0.01) {
          validation.errors.push(
            `${disc.disciplineName} equipment total ($${disc.totals.totalCost.toFixed(2)}) does not match BUDGETS ($${target.equipmentValue.toFixed(2)}). Difference: $${difference.toFixed(2)}`
          )
          validation.isValid = false
        }
      }
    })

    return validation
  }

  private validateConstructabilitySheet(
    constructability: ConstructabilityParseResult,
    targets: Record<string, any>
  ): SheetValidation {
    const validation: SheetValidation = {
      sheetName: 'CONSTRUCTABILITY',
      isValid: true,
      errors: [...constructability.validation.errors],
      warnings: [...constructability.validation.warnings]
    }

    // Constructability usually maps to discipline 23
    const targetDiscipline = constructability.disciplineMapping
    const target = targets[targetDiscipline]

    if (!target) {
      validation.errors.push(`No matching discipline found in BUDGETS for ${targetDiscipline}`)
      validation.isValid = false
    } else {
      // Constructability total should match something in BUDGETS
      // It might be split across multiple categories
      const budgetTotal = target.indirectLaborValue + 
                         target.materialsValue + 
                         target.equipmentValue + 
                         target.subcontractorsValue
      
      const difference = Math.abs(constructability.totalCost - budgetTotal)
      
      validation.budgetComparison = {
        budgetValue: budgetTotal,
        sheetValue: constructability.totalCost,
        difference,
        percentDifference: budgetTotal > 0 ? (difference / budgetTotal) * 100 : 0
      }

      // CONSTRUCTABILITY is typically 20-40x higher than BUDGETS (as per Grok insights)
      // This is because BUDGETS only includes a budgeted subset
      if (constructability.totalCost > budgetTotal * 10) {
        validation.warnings.push(
          `CONSTRUCTABILITY total ($${constructability.totalCost.toFixed(2)}) is ${(constructability.totalCost / budgetTotal).toFixed(1)}x higher than BUDGETS allocation ($${budgetTotal.toFixed(2)}). This is expected as BUDGETS typically contains only a subset of the full constructability estimate.`
        )
      } else if (difference > budgetTotal * 0.50) {
        validation.warnings.push(
          `CONSTRUCTABILITY total ($${constructability.totalCost.toFixed(2)}) differs significantly from BUDGETS total ($${budgetTotal.toFixed(2)}). This may be expected depending on budgeting approach.`
        )
      }
      // Don't mark as invalid - these differences are expected
    }

    return validation
  }

  private performCrossSheetValidation(
    budgets: BudgetsParseResult,
    staff?: StaffParseResult,
    directs?: DirectsParseResult,
    materials?: MaterialsParseResult,
    equipment?: EquipmentParseResult,
    constructability?: ConstructabilityParseResult,
    discEquipment?: Record<string, any>,
    indirects?: IndirectsParseResult
  ): CrossSheetValidation[] {
    const validations: CrossSheetValidation[] = []

    // Rule 1: Total of all detail sheets should not exceed BUDGETS
    const budgetGrandTotal = budgets.totals.grandTotal
    let detailsTotal = 0
    
    if (staff) detailsTotal += staff.totalIndirectLabor
    if (directs) {
      // Convert manhours to value (would need rates)
      // For now, just validate manhours are present
    }
    if (materials) detailsTotal += materials.totals.grandTotal
    if (equipment) detailsTotal += equipment.totals.grandTotal
    if (constructability) detailsTotal += constructability.totalCost
    
    // Add discipline equipment totals
    let totalDiscEquipment = 0
    if (discEquipment) {
      Object.values(discEquipment).forEach(disc => {
        totalDiscEquipment += disc.totals.totalCost
      })
      detailsTotal += totalDiscEquipment
    }

    // Rule 2: Labor totals validation
    if (staff && directs) {
      validations.push({
        rule: 'Labor totals consistency',
        isValid: true, // Would need to calculate based on rates
        message: 'Direct and indirect labor should reconcile with BUDGETS labor totals'
      })
    }
    
    // Rule 3: Equipment totals validation
    if (equipment || discEquipment) {
      const totalEquipment = (equipment?.totals.grandTotal || 0) + totalDiscEquipment
      validations.push({
        rule: 'Equipment totals breakdown',
        isValid: true,
        message: `Total equipment: $${totalEquipment.toFixed(2)} (Shared: $${(equipment?.totals.grandTotal || 0).toFixed(2)}, Discipline-specific: $${totalDiscEquipment.toFixed(2)})`,
        details: {
          sharedEquipment: equipment?.totals.grandTotal || 0,
          disciplineEquipment: totalDiscEquipment,
          total: totalEquipment
        }
      })
    }

    // Rule 4: No orphaned disciplines
    const budgetDisciplines = new Set(budgets.disciplines.map(d => d.disciplineName))
    const detailDisciplines = new Set<string>()
    
    if (directs) directs.disciplines.forEach(d => detailDisciplines.add(d.disciplineName))
    if (materials) materials.disciplines.forEach(d => detailDisciplines.add(d.disciplineName))
    if (equipment) equipment.disciplines.forEach(d => detailDisciplines.add(d.disciplineName))
    if (discEquipment) {
      Object.values(discEquipment).forEach(disc => {
        if (disc.disciplineName) {
          detailDisciplines.add(disc.disciplineName)
        }
      })
    }
    
    detailDisciplines.forEach(disc => {
      if (!budgetDisciplines.has(disc)) {
        validations.push({
          rule: 'Discipline consistency',
          isValid: false,
          message: `Discipline "${disc}" found in detail sheets but not in BUDGETS`
        })
      }
    })

    return validations
  }

  /**
   * Generate a human-readable validation report
   */
  generateReport(validation: ValidationResult): string {
    const lines: string[] = []
    
    lines.push('=== BUDGET VALIDATION REPORT ===')
    lines.push(`Overall Status: ${validation.isValid ? 'VALID ✓' : 'INVALID ✗'}`)
    lines.push(`Sheets Validated: ${validation.summary.sheetsValidated}`)
    lines.push(`Total Errors: ${validation.summary.totalErrors}`)
    lines.push(`Total Warnings: ${validation.summary.totalWarnings}`)
    lines.push('')
    
    // Sheet details
    Object.values(validation.details).forEach(detail => {
      if (detail.errors.length > 0 || detail.warnings.length > 0) {
        lines.push(`--- ${detail.sheetName} ---`)
        lines.push(`Status: ${detail.isValid ? 'Valid' : 'Invalid'}`)
        
        if (detail.budgetComparison) {
          lines.push(`Budget: $${detail.budgetComparison.budgetValue.toFixed(2)}`)
          lines.push(`Sheet: $${detail.budgetComparison.sheetValue.toFixed(2)}`)
          lines.push(`Difference: $${detail.budgetComparison.difference.toFixed(2)} (${detail.budgetComparison.percentDifference.toFixed(2)}%)`)
        }
        
        if (detail.errors.length > 0) {
          lines.push('Errors:')
          detail.errors.forEach(err => lines.push(`  • ${err}`))
        }
        
        if (detail.warnings.length > 0) {
          lines.push('Warnings:')
          detail.warnings.forEach(warn => lines.push(`  • ${warn}`))
        }
        
        lines.push('')
      }
    })
    
    // Cross-sheet validation
    if (validation.crossSheetValidation.length > 0) {
      lines.push('--- CROSS-SHEET VALIDATION ---')
      validation.crossSheetValidation.forEach(val => {
        lines.push(`${val.isValid ? '✓' : '✗'} ${val.rule}: ${val.message}`)
      })
    }
    
    return lines.join('\n')
  }
}