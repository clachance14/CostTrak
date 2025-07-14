// Budget Breakdown Types and Interfaces

export interface BudgetBreakdownRow {
  discipline: string
  costType: string
  manhours?: number
  value: number
  description?: string
}

export interface BudgetBreakdownImportRow {
  discipline: string
  costType: string  
  manhours?: number | string
  value: number | string
  description?: string
}

export interface BudgetBreakdownSummary {
  byDiscipline: {
    [discipline: string]: {
      total: number
      byType: {
        [costType: string]: {
          manhours?: number
          value: number
        }
      }
    }
  }
  totals: {
    manhours: number
    value: number
    laborTotal: number
    materialsTotal: number
    equipmentTotal: number
    subcontractTotal: number
    otherTotal: number
  }
}

export interface DisciplineSummary {
  discipline: string
  totalValue: number
  laborValue: number
  materialsValue: number
  equipmentValue: number
  subcontractValue: number
  otherValue: number
  totalManhours: number
  percentageOfTotal: number
}

export interface BudgetBreakdownImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: unknown
  }>
}

// Common disciplines and cost types
export const COMMON_DISCIPLINES = [
  'PIPING',
  'STEEL', 
  'ELECTRICAL',
  'INSTRUMENTATION',
  'CIVIL',
  'INSULATION',
  'PAINTING',
  'SCAFFOLDING',
  'EQUIPMENT',
  'FABRICATION',
  'MECHANICAL',
  'STRUCTURAL',
  'OTHER'
] as const

export const COMMON_COST_TYPES = [
  'DIRECT LABOR',
  'INDIRECT LABOR',
  'MATERIALS',
  'EQUIPMENT',
  'SUBCONTRACT',
  'SMALL TOOLS',
  'CONSUMABLES',
  'OTHER'
] as const

export type Discipline = typeof COMMON_DISCIPLINES[number]
export type CostType = typeof COMMON_COST_TYPES[number]