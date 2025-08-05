import * as XLSX from 'xlsx'

export interface StaffPhaseData {
  phase: 'JOB_SET_UP' | 'PRE_WORK' | 'PROJECT_EXECUTION' | 'JOB_CLOSE_OUT'
  phaseDescription: string // The actual text from Excel (e.g., "JOB SET UP")
  roles: StaffRoleData[]
  totalLabor: number
}

export interface StaffRoleData {
  classification: string // Role name from Column A
  quantity: number // Column C
  weeks: number // Column D
  perDiem: number // Column W
  totalLabor: number // Column Y
  laborCategoryCode?: string // IL001-IL023
}

export interface StaffParseResult {
  phases: StaffPhaseData[]
  totalIndirectLabor: number
  totalPerDiem: number
  validation: {
    warnings: string[]
    errors: string[]
  }
  disciplineMapping?: string // Which discipline this maps to (e.g., "GENERAL STAFFING")
}

export class StaffSheetParser {
  // 23 indirect labor roles in order
  private readonly INDIRECT_ROLES = [
    'Area Superintendent',
    'Clerk',
    'Cost Engineer',
    'Field Engineer',
    'Field Exchanger General Foreman',
    'General Foreman',
    'Lead Planner',
    'Lead Scheduler',
    'Planner A',
    'Planner B',
    'Procurement Coordinator',
    'Project Controls Lead',
    'Project Manager',
    'QA/QC Inspector A',
    'QA/QC Inspector B',
    'QA/QC Supervisor',
    'Safety Supervisor',
    'Safety Technician A',
    'Safety Technician B',
    'Scheduler',
    'Senior Project Manager',
    'Superintendent',
    'Timekeeper'
  ]

  // Role variations mapping (Excel variations to standard names)
  // Using lowercase keys for case-insensitive matching
  private readonly ROLE_VARIATIONS: Record<string, string> = {
    'qa/qc inspector mech': 'QA/QC Inspector A',  // Maps to IL014
    'qa/qc inspector i&e': 'QA/QC Inspector B',   // Maps to IL015
    'safety observer/technician': 'Safety Technician A'  // Maps to IL018
  }

  // Map role names to IL codes
  private getRoleCode(roleName: string): string | undefined {
    const normalizedRole = roleName.trim().toLowerCase()
    
    // First check if this is a known variation using lowercase comparison
    const standardRole = this.ROLE_VARIATIONS[normalizedRole]
    
    if (standardRole) {
      // Find the standard role in our list
      const index = this.INDIRECT_ROLES.findIndex(role => 
        role.toUpperCase() === standardRole.toUpperCase()
      )
      if (index !== -1) {
        return `IL${String(index + 1).padStart(3, '0')}`
      }
    }
    
    // If not a variation, try direct match
    const index = this.INDIRECT_ROLES.findIndex(role => 
      role.toUpperCase() === normalizedRole.toUpperCase()
    )
    
    if (index !== -1) {
      return `IL${String(index + 1).padStart(3, '0')}`
    }
    
    return undefined
  }

  parse(worksheet: XLSX.WorkSheet, addOnsValue: number = 0): StaffParseResult {
    const result: StaffParseResult = {
      phases: [],
      totalIndirectLabor: 0,
      totalPerDiem: 0,
      validation: {
        warnings: [],
        errors: []
      }
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    if (!data || data.length < 2) {
      result.validation.errors.push('STAFF sheet is empty or has no data rows')
      return result
    }

    // Phase detection patterns
    const phasePatterns = [
      { pattern: /JOB\s*SET\s*UP/i, phase: 'JOB_SET_UP' as const },
      { pattern: /PRE[\s-]*WORK/i, phase: 'PRE_WORK' as const },
      { pattern: /PROJECT(?!\s*CLOSE)/i, phase: 'PROJECT_EXECUTION' as const },
      { pattern: /JOB\s*CLOSE\s*OUT/i, phase: 'JOB_CLOSE_OUT' as const }
    ]

    let currentPhase: StaffPhaseData | null = null
    let rowsProcessed = 0

    // Start from row 2 (row 1 in 0-based index)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const classification = String(row[0] || '').trim() // Column A
      const description = String(row[1] || '').trim() // Column B
      
      // Check if this row indicates a phase
      let phaseFound = false
      for (const { pattern, phase } of phasePatterns) {
        if (pattern.test(description)) {
          // Save previous phase if exists
          if (currentPhase) {
            result.phases.push(currentPhase)
          }
          
          currentPhase = {
            phase,
            phaseDescription: description,
            roles: [],
            totalLabor: 0
          }
          phaseFound = true
          break
        }
      }

      // If not a phase row and we have a current phase, check if it's a role
      if (!phaseFound && currentPhase && classification) {
        const quantity = this.parseNumericValue(row[2]) // Column C
        const weeks = this.parseNumericValue(row[3]) // Column D
        const perDiem = this.parseNumericValue(row[22]) // Column W (0-based index 22)
        const totalLabor = this.parseNumericValue(row[24]) // Column Y (0-based index 24)
        
        // Only process if we have valid data
        if (quantity > 0 || weeks > 0 || totalLabor > 0) {
          const roleData: StaffRoleData = {
            classification,
            quantity,
            weeks,
            perDiem,
            totalLabor,
            laborCategoryCode: this.getRoleCode(classification)
          }
          
          if (!roleData.laborCategoryCode) {
            result.validation.warnings.push(`Unknown role: ${classification}`)
          }
          
          currentPhase.roles.push(roleData)
          currentPhase.totalLabor += totalLabor
          rowsProcessed++
        }
      }
    }

    // Don't forget the last phase
    if (currentPhase) {
      result.phases.push(currentPhase)
    }

    // Calculate totals
    result.totalIndirectLabor = result.phases.reduce((sum, phase) => sum + phase.totalLabor, 0)
    result.totalPerDiem = result.phases.reduce((sum, phase) => 
      phase.roles.reduce((phaseSum, role) => phaseSum + role.perDiem, 0) + sum
    , 0)
    
    // Add ADD ONS to total if provided
    if (addOnsValue > 0) {
      result.totalIndirectLabor += addOnsValue
    }

    // Validation
    if (result.phases.length === 0) {
      result.validation.errors.push('No phases found in STAFF sheet')
    } else if (result.phases.length !== 4) {
      result.validation.warnings.push(`Expected 4 phases, found ${result.phases.length}`)
    }

    if (rowsProcessed === 0) {
      result.validation.errors.push('No role data found in STAFF sheet')
    }

    // Try to determine which discipline this belongs to
    // Usually GENERAL STAFFING, but could be others
    result.disciplineMapping = 'GENERAL STAFFING'

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
   * Validate against BUDGETS indirect labor value
   */
  validateAgainstBudget(
    parseResult: StaffParseResult, 
    budgetIndirectLaborValue: number
  ): { isValid: boolean; difference: number; message: string } {
    const difference = Math.abs(parseResult.totalIndirectLabor - budgetIndirectLaborValue)
    const threshold = 0.01 // Allow $0.01 difference for rounding
    
    const isValid = difference <= threshold
    
    let message = ''
    if (isValid) {
      message = `STAFF total ($${parseResult.totalIndirectLabor.toFixed(2)}) matches BUDGETS INDIRECT LABOR ($${budgetIndirectLaborValue.toFixed(2)})`
    } else {
      message = `STAFF total ($${parseResult.totalIndirectLabor.toFixed(2)}) does not match BUDGETS INDIRECT LABOR ($${budgetIndirectLaborValue.toFixed(2)}). Difference: $${difference.toFixed(2)}`
    }
    
    return { isValid, difference, message }
  }

  /**
   * Convert to phase allocations for database storage
   */
  toPhaseAllocations(
    parseResult: StaffParseResult,
    projectId: string,
    wbsCode: string
  ): Array<{
    project_id: string
    wbs_code: string
    phase: string
    role: string
    fte: number
    duration_months: number
    monthly_rate: number
    perdiem: number
    add_ons: number
    created_by?: string
  }> {
    const allocations: Array<any> = []
    
    parseResult.phases.forEach(phase => {
      phase.roles.forEach(role => {
        if (role.quantity > 0 && role.weeks > 0) {
          // Convert weeks to months (approximate)
          const durationMonths = Math.ceil(role.weeks / 4.33)
          
          // Calculate monthly rate from total labor
          const monthlyRate = role.totalLabor / (role.quantity * durationMonths)
          
          allocations.push({
            project_id: projectId,
            wbs_code: wbsCode,
            phase: phase.phase,
            role: role.classification,
            fte: role.quantity,
            duration_months: durationMonths,
            monthly_rate: monthlyRate,
            perdiem: 0, // Would need to extract from other columns
            add_ons: 0  // Would need to extract from other columns
          })
        }
      })
    })
    
    return allocations
  }
}