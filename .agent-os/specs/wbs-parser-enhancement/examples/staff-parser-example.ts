/**
 * Staff Parser Implementation Example
 * 
 * This parser handles the STAFF sheet which contains 23 indirect labor roles
 * allocated across 4 project phases.
 */

import * as XLSX from 'xlsx'
import { 
  IndirectLaborRole, 
  ProjectPhase, 
  PhaseAllocation,
  StaffSheetData 
} from '../data-models'

export class StaffParser {
  // 23 Indirect Labor Roles in order
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

  // Phase column mappings in STAFF sheet
  private readonly PHASE_COLUMNS = {
    'JOB_SET_UP': 10,        // Column K
    'PRE_WORK': 13,          // Column N
    'PROJECT_EXECUTION': 16,  // Column Q
    'JOB_CLOSE_OUT': 19      // Column T
  }

  // Standard rates and durations
  private readonly PHASE_DURATIONS = {
    'JOB_SET_UP': 2,         // months
    'PRE_WORK': 1,           // months
    'PROJECT_EXECUTION': 12,  // months (varies by project)
    'JOB_CLOSE_OUT': 1       // months
  }

  private readonly STANDARD_RATES = {
    PERDIEM: 125,            // per day
    ADD_ON_PERCENTAGE: 0.15   // 15% of base labor
  }

  /**
   * Parse STAFF sheet and extract phase allocations
   */
  async parse(worksheet: XLSX.WorkSheet): Promise<StaffSheetData> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    const allocations: PhaseAllocation[] = []
    
    console.log('Parsing STAFF sheet with', data.length, 'rows')
    
    // Validate sheet structure
    if (!this.validateSheetStructure(data)) {
      throw new Error('Invalid STAFF sheet structure')
    }
    
    // Process each role (rows 2-24 for 23 roles)
    for (let roleIndex = 0; roleIndex < this.INDIRECT_ROLES.length; roleIndex++) {
      const rowIndex = roleIndex + 2 // Start from row 3 (0-indexed row 2)
      const roleName = this.INDIRECT_ROLES[roleIndex]
      
      if (rowIndex >= data.length) {
        console.warn(`Missing data for role: ${roleName}`)
        continue
      }
      
      const row = data[rowIndex]
      
      // Extract data for each phase
      for (const [phase, columnIndex] of Object.entries(this.PHASE_COLUMNS)) {
        const fte = this.parseNumericValue(row[columnIndex])
        
        if (fte > 0) {
          const allocation = this.createPhaseAllocation(
            phase as ProjectPhase,
            roleName as IndirectLaborRole,
            fte,
            row
          )
          allocations.push(allocation)
        }
      }
    }
    
    // Calculate totals
    const totals = this.calculateTotals(allocations)
    
    return {
      roles: this.INDIRECT_ROLES as IndirectLaborRole[],
      phases: Object.keys(this.PHASE_COLUMNS) as ProjectPhase[],
      allocations,
      totals
    }
  }

  /**
   * Validate sheet has expected structure
   */
  private validateSheetStructure(data: unknown[][]): boolean {
    if (data.length < 25) { // Need at least 25 rows (header + 23 roles + total)
      console.error('STAFF sheet has insufficient rows')
      return false
    }
    
    // Check for phase headers in row 1
    const headerRow = data[0]
    if (!headerRow) return false
    
    // Verify role names in column B (index 1)
    for (let i = 0; i < this.INDIRECT_ROLES.length; i++) {
      const row = data[i + 2]
      if (!row || row[1] !== this.INDIRECT_ROLES[i]) {
        console.error(`Expected role "${this.INDIRECT_ROLES[i]}" at row ${i + 3}, found "${row?.[1]}"`)
        return false
      }
    }
    
    return true
  }

  /**
   * Create phase allocation with calculated costs
   */
  private createPhaseAllocation(
    phase: ProjectPhase,
    role: IndirectLaborRole,
    fte: number,
    row: unknown[]
  ): PhaseAllocation {
    // Get monthly rate from appropriate column based on phase
    const rateColumnOffset = 1 // Rate is 1 column after FTE
    const monthlyRate = this.parseNumericValue(
      row[this.PHASE_COLUMNS[phase] + rateColumnOffset]
    ) || this.getStandardRate(role)
    
    const duration = this.PHASE_DURATIONS[phase]
    const baseCost = fte * duration * monthlyRate
    
    // Calculate per diem (based on working days)
    const workingDaysPerMonth = 22
    const perdiem = fte * duration * workingDaysPerMonth * this.STANDARD_RATES.PERDIEM
    
    // Calculate add-ons (15% of base labor)
    const addOns = baseCost * this.STANDARD_RATES.ADD_ON_PERCENTAGE
    
    return {
      id: crypto.randomUUID(),
      project_id: '', // Will be set during import
      wbs_code: this.generateWBSCode(phase, role),
      phase,
      role,
      fte,
      duration_months: duration,
      monthly_rate: monthlyRate,
      perdiem,
      add_ons: addOns,
      total_cost: baseCost + perdiem + addOns
    }
  }

  /**
   * Generate WBS code for indirect labor allocation
   */
  private generateWBSCode(phase: ProjectPhase, role: IndirectLaborRole): string {
    const phaseMap = {
      'JOB_SET_UP': '1.1.1.1',
      'PRE_WORK': '1.1.1.2',
      'PROJECT_EXECUTION': '1.1.1.3',
      'JOB_CLOSE_OUT': '1.1.1.4'
    }
    
    const roleIndex = this.INDIRECT_ROLES.indexOf(role) + 1
    const roleCode = roleIndex.toString().padStart(2, '0')
    
    return `${phaseMap[phase]}.2.${roleCode}` // .2 for IL (Indirect Labor)
  }

  /**
   * Get standard monthly rate for a role
   */
  private getStandardRate(role: IndirectLaborRole): number {
    // Standard rates by role category
    const rates: Record<string, number> = {
      'Senior Project Manager': 15000,
      'Project Manager': 12000,
      'Area Superintendent': 11000,
      'Superintendent': 10000,
      'Cost Engineer': 9500,
      'Field Engineer': 8500,
      'Lead Planner': 9000,
      'Lead Scheduler': 9000,
      'Project Controls Lead': 10000,
      'QA/QC Supervisor': 9000,
      'Safety Supervisor': 8500,
      'General Foreman': 8000,
      'Field Exchanger General Foreman': 8500,
      'Procurement Coordinator': 7500,
      'Planner A': 7000,
      'Planner B': 6000,
      'Scheduler': 7000,
      'QA/QC Inspector A': 6500,
      'QA/QC Inspector B': 5500,
      'Safety Technician A': 5500,
      'Safety Technician B': 4500,
      'Clerk': 4000,
      'Timekeeper': 4500
    }
    
    return rates[role] || 7000 // Default rate
  }

  /**
   * Parse numeric value from Excel cell
   */
  private parseNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    
    // Handle Excel formula results
    if (typeof value === 'object' && 'v' in value) {
      return this.parseNumericValue((value as any).v)
    }
    
    // Clean string values
    const cleaned = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-')
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Calculate totals by phase and role
   */
  private calculateTotals(allocations: PhaseAllocation[]) {
    const byPhase: Record<ProjectPhase, number> = {
      'JOB_SET_UP': 0,
      'PRE_WORK': 0,
      'PROJECT_EXECUTION': 0,
      'JOB_CLOSE_OUT': 0
    }
    
    const byRole: Record<string, number> = {}
    let grandTotal = 0
    
    for (const allocation of allocations) {
      byPhase[allocation.phase] += allocation.total_cost
      byRole[allocation.role] = (byRole[allocation.role] || 0) + allocation.total_cost
      grandTotal += allocation.total_cost
    }
    
    return {
      by_phase: byPhase,
      by_role: byRole,
      grand_total: grandTotal
    }
  }

  /**
   * Handle truncated data
   */
  private handleTruncation(value: string): any {
    const truncationPattern = /\.\.\.\(truncated (\d+) characters\)\.\.\./
    
    if (truncationPattern.test(value)) {
      console.warn(`Truncated data detected: ${value}`)
      return 0 // Default to 0 for numeric fields
    }
    
    return value
  }
}

// Example usage
async function exampleUsage() {
  const parser = new StaffParser()
  const workbook = XLSX.readFile('budget.xlsx')
  const staffSheet = workbook.Sheets['STAFF']
  
  if (!staffSheet) {
    console.error('STAFF sheet not found')
    return
  }
  
  try {
    const result = await parser.parse(staffSheet)
    
    console.log('\n=== STAFF Sheet Parse Results ===')
    console.log(`Total allocations: ${result.allocations.length}`)
    console.log(`Grand total: $${result.totals.grand_total.toLocaleString()}`)
    
    console.log('\nBy Phase:')
    for (const [phase, total] of Object.entries(result.totals.by_phase)) {
      console.log(`  ${phase}: $${total.toLocaleString()}`)
    }
    
    console.log('\nTop 5 Roles by Cost:')
    const sortedRoles = Object.entries(result.totals.by_role)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    
    for (const [role, total] of sortedRoles) {
      console.log(`  ${role}: $${total.toLocaleString()}`)
    }
    
  } catch (error) {
    console.error('Failed to parse STAFF sheet:', error)
  }
}

// Export example usage
export { exampleUsage }