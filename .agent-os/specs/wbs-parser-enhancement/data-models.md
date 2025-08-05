# WBS Parser Enhancement - Data Models

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document provides comprehensive TypeScript interfaces and data models for the 5-level WBS parser enhancement.

## Core Data Models

### WBS Structure Models

```typescript
/**
 * Represents the 5 levels in the WBS hierarchy
 */
export enum WBSLevel {
  PROJECT = 1,      // 1.0 - Project Total
  PHASE = 2,        // 1.1 - Construction Phase
  GROUP = 3,        // 1.1.X - Major Groups (e.g., General Staffing)
  CATEGORY = 4,     // 1.1.X.Y - Sub-Categories (e.g., Job Set Up)
  LINE_ITEM = 5     // 1.1.X.Y.Z - Line Items (e.g., Area Superintendent)
}

/**
 * Cost type classifications for Level 4
 */
export enum CostType {
  DL = 'DL',   // Direct Labor
  IL = 'IL',   // Indirect Labor (including Add-Ons)
  MAT = 'MAT', // Materials
  EQ = 'EQ',   // Equipment
  SUB = 'SUB'  // Subcontractors
}

/**
 * Complete WBS Node structure for 5-level hierarchy
 */
export interface WBSNode {
  // Identity
  id: string
  code: string                    // e.g., "1.1.3.2.1"
  parent_code?: string           // e.g., "1.1.3.2"
  level: WBSLevel
  
  // Classification
  description: string
  discipline?: string            // e.g., "MECHANICAL", "CIVIL"
  phase?: ProjectPhase          // For indirect labor nodes
  cost_type?: CostType          // For level 4 nodes
  
  // Hierarchy
  children: WBSNode[]
  path: string[]                // Full path from root, e.g., ["1.0", "1.1", "1.1.3"]
  sort_order: number            // For consistent ordering
  
  // Financial Data
  budget_total: number
  labor_cost: number
  material_cost: number
  equipment_cost: number
  subcontract_cost: number
  other_cost: number
  
  // Labor Metrics
  manhours_total?: number
  direct_hours?: number
  indirect_hours?: number
  crew_size?: number
  fte_count?: number           // For indirect labor
  
  // Metadata
  source_sheet?: string        // Which Excel sheet this came from
  source_row?: number          // Row number in source sheet
  import_batch_id?: string     // For tracking imports
  notes?: string
  created_at: Date
  updated_at: Date
}

/**
 * Flattened WBS node for list views and queries
 */
export interface FlatWBSNode extends Omit<WBSNode, 'children'> {
  full_path: string            // "1.0 > 1.1 > 1.1.3 > 1.1.3.2"
  parent_path: string          // "1.0 > 1.1 > 1.1.3"
  depth: number                // Same as level
  has_children: boolean
  child_count: number
  cumulative_total: number     // Including all descendants
}
```

### Labor Category Models

```typescript
/**
 * All 39 direct labor categories
 */
export enum DirectLaborCategory {
  BOILER_MAKER_A = 'Boiler Maker - Class A',
  BOILER_MAKER_B = 'Boiler Maker - Class B',
  CARPENTER_A = 'Carpenter - Class A',
  CARPENTER_B = 'Carpenter - Class B',
  CRANE_OPERATOR_A = 'Crane Operator A',
  CRANE_OPERATOR_B = 'Crane Operator B',
  ELECTRICIAN_A = 'Electrician - Class A',
  ELECTRICIAN_B = 'Electrician - Class B',
  ELECTRICIAN_C = 'Electrician - Class C',
  EQUIPMENT_OPERATOR_A = 'Equipment Operator - Class A',
  EQUIPMENT_OPERATOR_B = 'Equipment Operator - Class B',
  EQUIPMENT_OPERATOR_C = 'Equipment Operator - Class C',
  FIELD_ENGINEER_A = 'Field Engineer A',
  FIELD_ENGINEER_B = 'Field Engineer B',
  FITTER_A = 'Fitter - Class A',
  FITTER_B = 'Fitter - Class B',
  GENERAL_FOREMAN = 'General Foreman',
  HELPER = 'Helper',
  INSTRUMENT_TECH_A = 'Instrument Tech - Class A',
  INSTRUMENT_TECH_B = 'Instrument Tech - Class B',
  INSTRUMENT_TECH_C = 'Instrument Tech - Class C',
  IRONWORKER_A = 'Ironworker - Class A',
  IRONWORKER_B = 'Ironworker - Class B',
  LABORER_A = 'Laborer - Class A',
  LABORER_B = 'Laborer - Class B',
  MILLWRIGHT_A = 'Millwright A',
  MILLWRIGHT_B = 'Millwright B',
  OPERATING_ENGINEER_A = 'Operating Engineer A',
  OPERATING_ENGINEER_B = 'Operating Engineer B',
  OPERATOR_A = 'Operator A',
  OPERATOR_B = 'Operator B',
  PAINTER = 'Painter',
  PIPING_FOREMAN = 'Piping Foreman',
  SUPERVISOR = 'Supervisor',
  SURVEYOR_A = 'Surveyor A',
  SURVEYOR_B = 'Surveyor B',
  WAREHOUSE = 'Warehouse',
  WELDER_A = 'Welder - Class A',
  WELDER_B = 'Welder - Class B'
}

/**
 * All 23 indirect labor roles
 */
export enum IndirectLaborRole {
  AREA_SUPERINTENDENT = 'Area Superintendent',
  CLERK = 'Clerk',
  COST_ENGINEER = 'Cost Engineer',
  FIELD_ENGINEER = 'Field Engineer',
  FIELD_EXCHANGER_GENERAL_FOREMAN = 'Field Exchanger General Foreman',
  GENERAL_FOREMAN_INDIRECT = 'General Foreman',
  LEAD_PLANNER = 'Lead Planner',
  LEAD_SCHEDULER = 'Lead Scheduler',
  PLANNER_A = 'Planner A',
  PLANNER_B = 'Planner B',
  PROCUREMENT_COORDINATOR = 'Procurement Coordinator',
  PROJECT_CONTROLS_LEAD = 'Project Controls Lead',
  PROJECT_MANAGER = 'Project Manager',
  QA_QC_INSPECTOR_A = 'QA/QC Inspector A',
  QA_QC_INSPECTOR_B = 'QA/QC Inspector B',
  QA_QC_SUPERVISOR = 'QA/QC Supervisor',
  SAFETY_SUPERVISOR = 'Safety Supervisor',
  SAFETY_TECHNICIAN_A = 'Safety Technician A',
  SAFETY_TECHNICIAN_B = 'Safety Technician B',
  SCHEDULER = 'Scheduler',
  SENIOR_PROJECT_MANAGER = 'Senior Project Manager',
  SUPERINTENDENT = 'Superintendent',
  TIMEKEEPER = 'Timekeeper'
}

/**
 * Project phases for indirect labor allocation
 */
export enum ProjectPhase {
  JOB_SET_UP = 'JOB_SET_UP',
  PRE_WORK = 'PRE_WORK',
  PROJECT_EXECUTION = 'PROJECT_EXECUTION',
  JOB_CLOSE_OUT = 'JOB_CLOSE_OUT'
}

/**
 * Labor category information
 */
export interface LaborCategory {
  id: string
  category_type: 'DIRECT' | 'INDIRECT'
  name: string
  code: string
  standard_rate?: number
  overtime_multiplier?: number
  burden_rate?: number
  is_active: boolean
  requires_certification?: boolean
  certification_types?: string[]
}

/**
 * Direct labor allocation
 */
export interface DirectLaborAllocation {
  id: string
  project_id: string
  wbs_code: string
  discipline: string
  category: DirectLaborCategory
  manhours: number
  crew_size: number
  duration_days: number
  rate: number
  total_cost: number
  source_sheet: string
  source_row: number
}

/**
 * Phase-based indirect labor allocation
 */
export interface PhaseAllocation {
  id: string
  project_id: string
  wbs_code: string
  phase: ProjectPhase
  role: IndirectLaborRole
  fte: number
  duration_months: number
  monthly_rate: number
  perdiem?: number
  add_ons?: number
  total_cost: number
  start_date?: Date
  end_date?: Date
}

/**
 * Labor summary by category
 */
export interface LaborCategorySummary {
  category: string
  category_type: 'DIRECT' | 'INDIRECT'
  total_manhours: number
  total_cost: number
  average_rate: number
  min_rate: number
  max_rate: number
  headcount: number
  disciplines: string[]
  phases?: ProjectPhase[]
}
```

### Budget Line Item Models

```typescript
/**
 * Enhanced budget line item for 5-level WBS
 */
export interface BudgetLineItem {
  // Identity
  id: string
  project_id: string
  import_batch_id: string
  
  // Source tracking
  source_sheet: string
  source_row: number
  source_column?: string
  
  // WBS Classification (5 levels)
  wbs_code: string              // e.g., "1.1.3.2.1"
  wbs_level1?: string          // "1"
  wbs_level2?: string          // "1"
  wbs_level3?: string          // "3"
  wbs_level4?: string          // "2"
  wbs_level5?: string          // "1"
  
  // Categorization
  discipline?: string
  category: 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'SUBCONTRACT' | 'OTHER'
  subcategory?: string         // e.g., 'DIRECT', 'INDIRECT', 'STAFF'
  cost_type?: string          // Specific type like 'Perdiem', 'Add-Ons'
  phase?: ProjectPhase        // For phase-based allocations
  
  // Item details
  line_number?: string
  description: string
  
  // Quantities and rates
  quantity?: number
  unit_of_measure?: string
  unit_rate?: number
  
  // Labor-specific fields
  labor_category?: string     // One of 39 direct or 23 indirect
  manhours?: number
  crew_size?: number
  duration_days?: number
  fte?: number               // For indirect labor
  
  // Cost breakdown
  labor_cost: number
  material_cost: number
  equipment_cost: number
  subcontract_cost: number
  other_cost: number
  total_cost: number
  
  // Additional metadata
  notes?: string
  contractor_name?: string    // For subcontracts
  supplier_name?: string      // For materials
  vendor_id?: string
  owned_or_rented?: 'OWNED' | 'RENTED' // For equipment
  is_taxable?: boolean
  tax_rate?: number
  is_add_on?: boolean        // For indirect labor add-ons
  
  // Audit fields
  created_at: Date
  updated_at: Date
  created_by?: string
  updated_by?: string
}

/**
 * Aggregated budget data by WBS node
 */
export interface WBSBudgetRollup {
  wbs_code: string
  level: WBSLevel
  description: string
  line_item_count: number
  
  // Cost totals
  total_budget: number
  labor_budget: number
  material_budget: number
  equipment_budget: number
  subcontract_budget: number
  other_budget: number
  
  // Labor breakdown
  direct_labor_cost: number
  indirect_labor_cost: number
  add_ons_cost: number
  perdiem_cost: number
  
  // Hours breakdown
  total_manhours: number
  direct_hours: number
  indirect_hours: number
  
  // Metrics
  average_labor_rate?: number
  material_percentage: number
  labor_percentage: number
  
  // Source information
  source_sheets: string[]
}
```

### Discipline and Group Models

```typescript
/**
 * Master discipline list entry
 */
export interface DisciplineEntry {
  id: string
  name: string                    // e.g., "PIPING", "CIVIL - GROUNDING"
  normalized_name: string         // e.g., "PIPING", "CIVIL_GROUNDING"
  parent_group: string           // e.g., "MECHANICAL", "CIVIL"
  wbs_code_prefix: string        // e.g., "09" for Mechanical
  is_standard: boolean           // True for predefined disciplines
  is_demo: boolean               // True for demolition disciplines
  sort_order: number
  created_at: Date
  updated_at: Date
  project_count?: number         // How many projects use this
}

/**
 * Discipline grouping for Level 3 WBS
 */
export interface DisciplineGroup {
  name: string                   // e.g., "MECHANICAL", "CIVIL", "I&E"
  wbs_code: string              // e.g., "1.1.9" for Mechanical
  disciplines: string[]          // Child disciplines
  includes_demos: boolean        // Has demolition work
  sort_order: number
}

/**
 * Project-specific discipline mapping
 */
export interface ProjectDisciplineMapping {
  project_id: string
  discipline_mappings: Record<string, string>  // discipline -> parent group
  custom_disciplines: DisciplineEntry[]
  unmapped_disciplines: string[]
}

/**
 * Standard WBS groups at Level 3
 */
export const STANDARD_WBS_GROUPS = {
  GENERAL_STAFFING: { code: '1.1.1', order: 1 },
  SCAFFOLDING: { code: '1.1.2', order: 2 },
  CONSTRUCTABILITY: { code: '1.1.3', order: 3 },
  FABRICATION: { code: '1.1.4', order: 4 },
  MOBILIZATION: { code: '1.1.5', order: 5 },
  CLEAN_UP: { code: '1.1.6', order: 6 },
  BUILDING_REMODELING: { code: '1.1.7', order: 7 },
  CIVIL: { code: '1.1.8', order: 8 },
  MECHANICAL: { code: '1.1.9', order: 9 },
  I_AND_E: { code: '1.1.10', order: 10 },
  DEMOLITION: { code: '1.1.11', order: 11 },
  MILLWRIGHT: { code: '1.1.12', order: 12 },
  INSULATION_PAINTING: { code: '1.1.13', order: 13 }
  // 1.1.14-99 reserved for custom groups
} as const
```

### Excel Sheet Models

```typescript
/**
 * Excel sheet mapping configuration
 */
export interface ExcelSheetMapping {
  id: string
  sheet_name: string             // e.g., "STAFF", "DIRECTS"
  category: string               // Primary category
  subcategory?: string          // Sub-category
  column_mappings: ColumnMapping
  parsing_rules?: ParsingRules
  validation_rules?: ValidationRule[]
  is_active: boolean
}

/**
 * Column mapping for Excel sheets
 */
export interface ColumnMapping {
  wbs_code?: number
  discipline?: number
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

/**
 * Parsing rules for special handling
 */
export interface ParsingRules {
  header_row?: number
  data_start_row?: number
  data_end_row?: number
  skip_empty_rows?: boolean
  truncation_patterns?: string[]
  number_formats?: Record<string, string>
  date_formats?: Record<string, string>
}

/**
 * Sheet-specific data structures
 */
export interface StaffSheetData {
  roles: IndirectLaborRole[]
  phases: ProjectPhase[]
  allocations: PhaseAllocation[]
  totals: {
    by_phase: Record<ProjectPhase, number>
    by_role: Record<string, number>
    grand_total: number
  }
}

export interface DirectsSheetData {
  categories: DirectLaborCategory[]
  disciplines: string[]
  allocations: DirectLaborAllocation[]
  totals: {
    by_category: Record<string, number>
    by_discipline: Record<string, number>
    total_manhours: number
    total_cost: number
  }
}

export interface MaterialsSheetData {
  items: MaterialLineItem[]
  vendors: string[]
  totals: {
    taxable: number
    non_taxable: number
    taxes: number
    grand_total: number
  }
}

export interface MaterialLineItem {
  wbs_code?: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total_cost: number
  vendor?: string
  is_taxable: boolean
  tax_amount?: number
  discipline?: string
}

export interface ConstructabilitySheetData {
  categories: ConstructabilityCategory[]
  items: ConstructabilityItem[]
  totals: {
    by_category: Record<string, number>
    add_ons_total: number
    safety_total: number
    facilities_total: number
    grand_total: number
  }
}

export interface ConstructabilityCategory {
  name: string
  wbs_code: string
  items: ConstructabilityItem[]
}

export interface ConstructabilityItem {
  category: string
  description: string
  cost: number
  is_add_on: boolean
  maps_to_indirect_labor: boolean
}
```

### Import and Validation Models

```typescript
/**
 * Budget import options
 */
export interface BudgetImportOptions {
  file: File
  project_id: string
  options: {
    clearExisting: boolean
    validateOnly: boolean
    useFiveLevel: boolean
    strictValidation: boolean
    skipWarnings?: boolean
    emailNotification?: boolean
  }
}

/**
 * Import result with comprehensive summary
 */
export interface BudgetImportResult {
  success: boolean
  import_id: string
  project_id: string
  
  summary: {
    file_name: string
    file_size: number
    sheets_processed: string[]
    sheets_skipped: string[]
    
    line_items_created: number
    line_items_updated: number
    line_items_failed: number
    
    wbs_nodes_created: number
    wbs_levels_used: number[]
    
    disciplines_found: string[]
    disciplines_created: string[]
    
    phases_allocated: number
    labor_categories_used: string[]
    
    total_budget: number
    total_manhours: number
    
    processing_time_ms: number
  }
  
  validation: {
    errors: ValidationError[]
    warnings: ValidationWarning[]
    info: ValidationInfo[]
  }
  
  hierarchy: WBSNode[]
  
  rollups: {
    by_discipline: Record<string, number>
    by_cost_type: Record<string, number>
    by_phase: Record<string, number>
    by_level: Record<number, number>
  }
}

/**
 * Validation error with detailed context
 */
export interface ValidationError {
  code: ValidationErrorCode
  severity: 'error' | 'critical'
  sheet?: string
  row?: number
  column?: string
  field?: string
  value?: any
  expected?: any
  message: string
  suggestion?: string
  impact?: string
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: ValidationWarningCode
  sheet?: string
  row?: number
  message: string
  suggestion?: string
}

/**
 * Validation info message
 */
export interface ValidationInfo {
  type: 'suggestion' | 'note' | 'tip'
  message: string
  context?: any
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  // Structure errors
  INVALID_WBS_CODE = 'INVALID_WBS_CODE',
  MISSING_WBS_PARENT = 'MISSING_WBS_PARENT',
  DUPLICATE_WBS_CODE = 'DUPLICATE_WBS_CODE',
  INVALID_WBS_LEVEL = 'INVALID_WBS_LEVEL',
  
  // Data errors
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_NUMBER_FORMAT = 'INVALID_NUMBER_FORMAT',
  NEGATIVE_VALUE = 'NEGATIVE_VALUE',
  
  // Reference errors
  UNKNOWN_DISCIPLINE = 'UNKNOWN_DISCIPLINE',
  UNKNOWN_LABOR_CATEGORY = 'UNKNOWN_LABOR_CATEGORY',
  INVALID_PHASE = 'INVALID_PHASE',
  
  // Business rule errors
  RULE_100_VIOLATION = 'RULE_100_VIOLATION',
  CROSS_SHEET_MISMATCH = 'CROSS_SHEET_MISMATCH',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED'
}

/**
 * Validation warning codes
 */
export enum ValidationWarningCode {
  TRUNCATED_DATA = 'TRUNCATED_DATA',
  MISSING_OPTIONAL_FIELD = 'MISSING_OPTIONAL_FIELD',
  UNUSUAL_VALUE = 'UNUSUAL_VALUE',
  NEW_DISCIPLINE_FOUND = 'NEW_DISCIPLINE_FOUND',
  ZERO_BUDGET_ITEM = 'ZERO_BUDGET_ITEM',
  HIGH_LABOR_RATE = 'HIGH_LABOR_RATE',
  LOW_LABOR_RATE = 'LOW_LABOR_RATE',
  MISSING_SHEET = 'MISSING_SHEET'
}
```

### Truncation Handling Models

```typescript
/**
 * Truncation detection result
 */
export interface TruncationResult {
  isTruncated: boolean
  originalValue: string
  cleanValue: any
  truncatedCharacters?: number
  pattern?: string
  confidence: number
}

/**
 * Truncation patterns to detect
 */
export const TRUNCATION_PATTERNS = [
  /\.\.\.\(truncated (\d+) characters\)\.\.\./,
  /\[data truncated\]/,
  /\.\.\.\s*$/,
  /^\s*\.\.\./,
  /\[?\s*more\s*\]?$/i
] as const

/**
 * Default values for truncated data
 */
export interface TruncationDefaults {
  numeric: 0
  string: ''
  boolean: false
  date: null
  array: []
}
```

### Performance Models

```typescript
/**
 * Performance metrics for import operations
 */
export interface ImportPerformanceMetrics {
  import_id: string
  file_size_bytes: number
  total_duration_ms: number
  
  phases: {
    file_reading_ms: number
    sheet_parsing_ms: number
    validation_ms: number
    database_write_ms: number
    rollup_calculation_ms: number
  }
  
  sheets: Record<string, {
    rows_processed: number
    duration_ms: number
    errors_count: number
  }>
  
  memory: {
    initial_mb: number
    peak_mb: number
    final_mb: number
  }
  
  database: {
    queries_executed: number
    transactions_count: number
    rollbacks_count: number
  }
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  max_file_size_mb: number      // 50MB
  max_import_duration_ms: number // 30000ms (30 seconds)
  max_memory_usage_mb: number    // 500MB
  warning_thresholds: {
    file_size_mb: number         // 25MB
    duration_ms: number          // 15000ms
    memory_mb: number            // 250MB
  }
}
```

## Type Guards

```typescript
/**
 * Type guards for runtime type checking
 */
export const TypeGuards = {
  isWBSNode(value: any): value is WBSNode {
    return (
      typeof value === 'object' &&
      typeof value.code === 'string' &&
      typeof value.level === 'number' &&
      value.level >= 1 &&
      value.level <= 5
    )
  },

  isDirectLaborCategory(value: string): value is DirectLaborCategory {
    return Object.values(DirectLaborCategory).includes(value as DirectLaborCategory)
  },

  isIndirectLaborRole(value: string): value is IndirectLaborRole {
    return Object.values(IndirectLaborRole).includes(value as IndirectLaborRole)
  },

  isProjectPhase(value: string): value is ProjectPhase {
    return Object.values(ProjectPhase).includes(value as ProjectPhase)
  },

  isCostType(value: string): value is CostType {
    return Object.values(CostType).includes(value as CostType)
  },

  isTruncated(value: string): boolean {
    return TRUNCATION_PATTERNS.some(pattern => pattern.test(value))
  }
}
```

## Constants

```typescript
/**
 * System-wide constants
 */
export const WBS_CONSTANTS = {
  MAX_WBS_LEVEL: 5,
  MAX_CODE_LENGTH: 20,
  MAX_DESCRIPTION_LENGTH: 255,
  
  PHASE_DURATIONS: {
    [ProjectPhase.JOB_SET_UP]: 2,         // months
    [ProjectPhase.PRE_WORK]: 1,           // months
    [ProjectPhase.PROJECT_EXECUTION]: 12, // months
    [ProjectPhase.JOB_CLOSE_OUT]: 1       // months
  },
  
  STANDARD_RATES: {
    PERDIEM: 125,                         // per day
    ADD_ON_PERCENTAGE: 0.15,              // 15% of labor
    BURDEN_RATE: 1.35,                    // 35% burden
    OVERTIME_MULTIPLIER: 1.5
  },
  
  VALIDATION: {
    TOLERANCE_PERCENTAGE: 0.001,          // 0.1% for 100% rule
    MAX_LABOR_RATE: 500,                  // per hour
    MIN_LABOR_RATE: 15,                   // per hour
    MAX_FTE: 10,                          // per role per phase
    MIN_FTE: 0.1
  }
} as const
```

## Utility Types

```typescript
/**
 * Utility types for common operations
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type Nullable<T> = T | null

export type AsyncResult<T> = Promise<{
  success: boolean
  data?: T
  error?: Error
  warnings?: string[]
}>

export type WBSPath = `${number}.${number}` | 
                     `${number}.${number}.${number}` |
                     `${number}.${number}.${number}.${number}` |
                     `${number}.${number}.${number}.${number}.${number}`
```

## Zod Schemas for Validation

```typescript
import { z } from 'zod'

/**
 * Zod schemas for runtime validation
 */
export const WBSNodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().regex(/^\d+(\.\d+){0,4}$/),
  parent_code: z.string().regex(/^\d+(\.\d+){0,3}$/).optional(),
  level: z.number().int().min(1).max(5),
  description: z.string().max(255),
  discipline: z.string().optional(),
  phase: z.nativeEnum(ProjectPhase).optional(),
  cost_type: z.nativeEnum(CostType).optional(),
  budget_total: z.number().min(0),
  labor_cost: z.number().min(0),
  material_cost: z.number().min(0),
  equipment_cost: z.number().min(0),
  subcontract_cost: z.number().min(0),
  other_cost: z.number().min(0)
})

export const BudgetLineItemSchema = z.object({
  source_sheet: z.string(),
  source_row: z.number().int().positive(),
  wbs_code: z.string(),
  description: z.string(),
  total_cost: z.number(),
  labor_cost: z.number().min(0).default(0),
  material_cost: z.number().min(0).default(0),
  equipment_cost: z.number().min(0).default(0),
  subcontract_cost: z.number().min(0).default(0),
  other_cost: z.number().min(0).default(0)
}).refine(
  data => Math.abs(data.total_cost - (
    data.labor_cost + 
    data.material_cost + 
    data.equipment_cost + 
    data.subcontract_cost + 
    data.other_cost
  )) < 0.01,
  {
    message: "Total cost must equal sum of component costs"
  }
)

export const PhaseAllocationSchema = z.object({
  phase: z.nativeEnum(ProjectPhase),
  role: z.nativeEnum(IndirectLaborRole),
  fte: z.number().min(0.1).max(10),
  duration_months: z.number().int().positive(),
  monthly_rate: z.number().positive(),
  perdiem: z.number().min(0).optional(),
  add_ons: z.number().min(0).optional()
})

export type ValidatedWBSNode = z.infer<typeof WBSNodeSchema>
export type ValidatedBudgetLineItem = z.infer<typeof BudgetLineItemSchema>
export type ValidatedPhaseAllocation = z.infer<typeof PhaseAllocationSchema>
```

## Database Table Types

```typescript
/**
 * Supabase generated types for new tables
 */
export interface Database {
  public: {
    Tables: {
      wbs_structure: {
        Row: {
          id: string
          project_id: string
          code: string
          parent_code: string | null
          level: number
          description: string | null
          phase: string | null
          cost_type: string | null
          labor_category_id: string | null
          budget_total: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['wbs_structure']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['wbs_structure']['Insert']>
      }
      
      phase_allocations: {
        Row: {
          id: string
          project_id: string
          phase: string
          role: string
          fte: number
          duration_months: number
          monthly_rate: number
          perdiem: number | null
          add_ons: number | null
          total_cost: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['phase_allocations']['Row'], 'id' | 'total_cost' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['phase_allocations']['Insert']>
      }
      
      discipline_registry: {
        Row: {
          id: string
          name: string
          parent_group: string
          wbs_code_prefix: string | null
          is_standard: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['discipline_registry']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['discipline_registry']['Insert']>
      }
      
      labor_categories: {
        Row: {
          id: string
          category_type: 'DIRECT' | 'INDIRECT'
          name: string
          code: string
          standard_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['labor_categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['labor_categories']['Insert']>
      }
    }
  }
}
```