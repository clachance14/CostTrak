# WBS Parser Enhancement - Validation Rules

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document defines comprehensive validation rules for the 5-level WBS parser to ensure data integrity, accuracy, and consistency.

## Validation Categories

### 1. Structural Validation
- WBS hierarchy integrity
- Parent-child relationships
- Level constraints
- Code format validation

### 2. Financial Validation
- 100% rule compliance
- Cross-sheet reconciliation
- Budget constraints
- Rate reasonableness

### 3. Data Quality Validation
- Required fields
- Data type validation
- Reference integrity
- Duplicate detection

### 4. Business Rule Validation
- Labor category constraints
- Phase allocation rules
- Discipline mapping
- Cost type classification

## Detailed Validation Rules

### 1. WBS Structure Validation

#### Rule 1.1: Valid WBS Code Format
```typescript
interface WBSCodeValidation {
  pattern: RegExp
  examples: string[]
  validate: (code: string) => ValidationResult
}

const WBS_CODE_RULES: Record<WBSLevel, WBSCodeValidation> = {
  1: {
    pattern: /^1\.0$/,
    examples: ['1.0'],
    validate: (code) => ({
      valid: code === '1.0',
      error: 'Level 1 must be "1.0" (Project Total)'
    })
  },
  2: {
    pattern: /^1\.1$/,
    examples: ['1.1'],
    validate: (code) => ({
      valid: code === '1.1',
      error: 'Level 2 must be "1.1" (Construction Phase)'
    })
  },
  3: {
    pattern: /^1\.1\.\d{1,2}$/,
    examples: ['1.1.1', '1.1.9', '1.1.13'],
    validate: (code) => ({
      valid: /^1\.1\.\d{1,2}$/.test(code) && 
             parseInt(code.split('.')[2]) >= 1 &&
             parseInt(code.split('.')[2]) <= 99,
      error: 'Level 3 must be "1.1.X" where X is 1-99'
    })
  },
  4: {
    pattern: /^1\.1\.\d{1,2}\.\d{1,2}$/,
    examples: ['1.1.1.1', '1.1.9.15'],
    validate: (code) => ({
      valid: /^1\.1\.\d{1,2}\.\d{1,2}$/.test(code),
      error: 'Level 4 must be "1.1.X.Y" format'
    })
  },
  5: {
    pattern: /^1\.1\.\d{1,2}\.\d{1,2}\.\d{1,2}$/,
    examples: ['1.1.1.1.1', '1.1.9.4.39'],
    validate: (code) => ({
      valid: /^1\.1\.\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(code),
      error: 'Level 5 must be "1.1.X.Y.Z" format'
    })
  }
}
```

#### Rule 1.2: Parent-Child Relationship
```typescript
const validateParentChild = (node: WBSNode, parent: WBSNode): ValidationResult => {
  // Child level must be exactly parent level + 1
  if (node.level !== parent.level + 1) {
    return {
      valid: false,
      error: `Node ${node.code} level (${node.level}) must be ${parent.level + 1}`
    }
  }
  
  // Child code must start with parent code
  if (!node.code.startsWith(parent.code + '.')) {
    return {
      valid: false,
      error: `Node ${node.code} must start with parent code ${parent.code}`
    }
  }
  
  return { valid: true }
}
```

#### Rule 1.3: Unique WBS Codes
```typescript
const validateUniqueCode = (
  code: string, 
  projectId: string, 
  existingCodes: Set<string>
): ValidationResult => {
  const key = `${projectId}:${code}`
  
  if (existingCodes.has(key)) {
    return {
      valid: false,
      error: `Duplicate WBS code: ${code}`,
      severity: 'error'
    }
  }
  
  return { valid: true }
}
```

### 2. Financial Validation

#### Rule 2.1: 100% Rule
```typescript
interface HundredPercentRule {
  tolerance: number // Percentage tolerance (e.g., 0.1%)
  validate: (parent: WBSNode, children: WBSNode[]) => ValidationResult
}

const HUNDRED_PERCENT_RULE: HundredPercentRule = {
  tolerance: 0.001, // 0.1%
  validate: (parent, children) => {
    const parentTotal = parent.budget_total
    const childrenSum = children.reduce((sum, child) => sum + child.budget_total, 0)
    const difference = Math.abs(parentTotal - childrenSum)
    const percentDiff = parentTotal > 0 ? difference / parentTotal : 0
    
    if (percentDiff > HUNDRED_PERCENT_RULE.tolerance) {
      return {
        valid: false,
        error: `100% rule violation at ${parent.code}: Parent=$${parentTotal}, Children=$${childrenSum}, Diff=$${difference}`,
        severity: 'error',
        data: {
          parent_code: parent.code,
          parent_total: parentTotal,
          children_sum: childrenSum,
          difference: difference,
          percent_difference: percentDiff * 100
        }
      }
    }
    
    return { valid: true }
  }
}
```

#### Rule 2.2: Cross-Sheet Total Validation
```typescript
const validateCrossSheetTotals = (data: {
  coversheet: { total: number, byDiscipline: Record<string, number> }
  budgets: { total: number, byDiscipline: Record<string, number> }
  lineItems: { total: number, bySheet: Record<string, number> }
}): ValidationResult[] => {
  const errors: ValidationResult[] = []
  
  // COVERSHEET vs BUDGETS total
  const totalDiff = Math.abs(data.coversheet.total - data.budgets.total)
  if (totalDiff > 0.01) {
    errors.push({
      valid: false,
      error: `COVERSHEET total ($${data.coversheet.total}) != BUDGETS total ($${data.budgets.total})`,
      severity: 'error'
    })
  }
  
  // Discipline-level validation
  Object.keys(data.coversheet.byDiscipline).forEach(discipline => {
    const coversheetAmount = data.coversheet.byDiscipline[discipline]
    const budgetsAmount = data.budgets.byDiscipline[discipline] || 0
    const diff = Math.abs(coversheetAmount - budgetsAmount)
    
    if (diff > 0.01) {
      errors.push({
        valid: false,
        error: `${discipline}: COVERSHEET ($${coversheetAmount}) != BUDGETS ($${budgetsAmount})`,
        severity: 'warning'
      })
    }
  })
  
  return errors
}
```

#### Rule 2.3: Component Cost Validation
```typescript
const validateComponentCosts = (item: BudgetLineItem): ValidationResult => {
  const componentSum = 
    item.labor_cost + 
    item.material_cost + 
    item.equipment_cost + 
    item.subcontract_cost + 
    item.other_cost
  
  const difference = Math.abs(item.total_cost - componentSum)
  
  if (difference > 0.01) {
    return {
      valid: false,
      error: `Component costs don't sum to total: $${componentSum} != $${item.total_cost}`,
      severity: 'error',
      location: {
        sheet: item.source_sheet,
        row: item.source_row
      }
    }
  }
  
  return { valid: true }
}
```

### 3. Labor Validation

#### Rule 3.1: Direct Labor Category Validation
```typescript
const VALID_DIRECT_LABOR = new Set([
  'Boiler Maker - Class A',
  'Boiler Maker - Class B',
  'Carpenter - Class A',
  'Carpenter - Class B',
  // ... all 39 categories
])

const validateDirectLaborCategory = (category: string): ValidationResult => {
  if (!VALID_DIRECT_LABOR.has(category)) {
    // Try fuzzy match
    const normalized = category.trim().replace(/\s+/g, ' ')
    const closeMatch = Array.from(VALID_DIRECT_LABOR).find(valid => 
      valid.toLowerCase() === normalized.toLowerCase()
    )
    
    if (closeMatch) {
      return {
        valid: true,
        warning: `Labor category "${category}" normalized to "${closeMatch}"`
      }
    }
    
    return {
      valid: false,
      error: `Invalid direct labor category: "${category}"`,
      severity: 'error',
      suggestion: 'Check spelling or use standard category names'
    }
  }
  
  return { valid: true }
}
```

#### Rule 3.2: Labor Rate Validation
```typescript
interface LaborRateValidation {
  category: string
  minRate: number
  maxRate: number
  warningThreshold: number
}

const LABOR_RATE_RULES: LaborRateValidation[] = [
  { category: 'Supervisor', minRate: 90, maxRate: 150, warningThreshold: 130 },
  { category: 'Welder - Class A', minRate: 70, maxRate: 120, warningThreshold: 110 },
  { category: 'Helper', minRate: 35, maxRate: 60, warningThreshold: 55 },
  // ... more rules
]

const validateLaborRate = (
  category: string, 
  rate: number, 
  manhours: number
): ValidationResult => {
  const rule = LABOR_RATE_RULES.find(r => r.category === category)
  
  if (!rule) {
    // Use general bounds
    if (rate < 15 || rate > 500) {
      return {
        valid: false,
        error: `Labor rate $${rate}/hr is outside reasonable bounds ($15-$500)`,
        severity: 'error'
      }
    }
    return { valid: true }
  }
  
  if (rate < rule.minRate) {
    return {
      valid: false,
      error: `${category} rate $${rate}/hr is below minimum $${rule.minRate}/hr`,
      severity: 'error'
    }
  }
  
  if (rate > rule.maxRate) {
    return {
      valid: false,
      error: `${category} rate $${rate}/hr exceeds maximum $${rule.maxRate}/hr`,
      severity: 'error'
    }
  }
  
  if (rate > rule.warningThreshold && manhours > 100) {
    return {
      valid: true,
      warning: `${category} rate $${rate}/hr is high for ${manhours} hours`,
      severity: 'warning'
    }
  }
  
  return { valid: true }
}
```

#### Rule 3.3: Phase Allocation Validation
```typescript
const validatePhaseAllocation = (allocation: PhaseAllocation): ValidationResult[] => {
  const errors: ValidationResult[] = []
  
  // FTE validation
  if (allocation.fte < 0.1 || allocation.fte > 10) {
    errors.push({
      valid: false,
      error: `Invalid FTE ${allocation.fte} for ${allocation.role} in ${allocation.phase}`,
      severity: 'error'
    })
  }
  
  // Duration validation
  const expectedDuration = {
    'JOB_SET_UP': 2,
    'PRE_WORK': 1,
    'PROJECT_EXECUTION': [6, 36], // Range
    'JOB_CLOSE_OUT': 1
  }
  
  const expected = expectedDuration[allocation.phase]
  if (Array.isArray(expected)) {
    if (allocation.duration_months < expected[0] || 
        allocation.duration_months > expected[1]) {
      errors.push({
        valid: true,
        warning: `Unusual duration ${allocation.duration_months} months for ${allocation.phase}`,
        severity: 'warning'
      })
    }
  } else if (allocation.duration_months !== expected) {
    errors.push({
      valid: true,
      warning: `Expected ${expected} months for ${allocation.phase}, got ${allocation.duration_months}`,
      severity: 'info'
    })
  }
  
  // Cost validation
  const calculatedCost = allocation.fte * allocation.duration_months * 
    (allocation.monthly_rate + (allocation.perdiem || 0) + (allocation.add_ons || 0))
  
  if (Math.abs(calculatedCost - allocation.total_cost) > 0.01) {
    errors.push({
      valid: false,
      error: `Phase allocation cost mismatch: calculated $${calculatedCost}, stored $${allocation.total_cost}`,
      severity: 'error'
    })
  }
  
  return errors
}
```

### 4. Discipline Validation

#### Rule 4.1: Discipline Mapping
```typescript
const STANDARD_DISCIPLINES = new Map([
  ['PIPING', 'MECHANICAL'],
  ['STEEL', 'MECHANICAL'],
  ['EQUIPMENT', 'MECHANICAL'],
  ['INSTRUMENTATION', 'I&E'],
  ['ELECTRICAL', 'I&E'],
  ['CIVIL', 'CIVIL'],
  ['CONCRETE', 'CIVIL'],
  ['GROUNDING', 'CIVIL'],
  ['CIVIL - GROUNDING', 'CIVIL']
])

const validateDisciplineMapping = (
  discipline: string
): { valid: boolean; parent?: string; warning?: string } => {
  const upper = discipline.toUpperCase().trim()
  
  // Check standard mapping
  if (STANDARD_DISCIPLINES.has(upper)) {
    return { 
      valid: true, 
      parent: STANDARD_DISCIPLINES.get(upper) 
    }
  }
  
  // Check for variations
  for (const [std, parent] of STANDARD_DISCIPLINES) {
    if (upper.includes(std)) {
      return {
        valid: true,
        parent: parent,
        warning: `Discipline "${discipline}" mapped to standard "${std}"`
      }
    }
  }
  
  // New discipline
  return {
    valid: true,
    warning: `New discipline "${discipline}" will be added to registry`
  }
}
```

### 5. Data Quality Validation

#### Rule 5.1: Required Fields
```typescript
interface RequiredFieldRule {
  entity: string
  fields: string[]
  conditional?: (item: any) => string[]
}

const REQUIRED_FIELDS: RequiredFieldRule[] = [
  {
    entity: 'BudgetLineItem',
    fields: ['source_sheet', 'source_row', 'description', 'total_cost'],
    conditional: (item) => {
      const additional = []
      if (item.category === 'LABOR') additional.push('manhours')
      if (item.category === 'MATERIAL') additional.push('unit_of_measure')
      return additional
    }
  },
  {
    entity: 'PhaseAllocation',
    fields: ['phase', 'role', 'fte', 'duration_months', 'monthly_rate']
  },
  {
    entity: 'WBSNode',
    fields: ['code', 'level', 'description', 'budget_total']
  }
]

const validateRequiredFields = (
  entity: any, 
  entityType: string
): ValidationResult[] => {
  const errors: ValidationResult[] = []
  const rule = REQUIRED_FIELDS.find(r => r.entity === entityType)
  
  if (!rule) return errors
  
  const required = [...rule.fields]
  if (rule.conditional) {
    required.push(...rule.conditional(entity))
  }
  
  required.forEach(field => {
    if (entity[field] === undefined || entity[field] === null || entity[field] === '') {
      errors.push({
        valid: false,
        error: `Missing required field: ${field}`,
        severity: 'error',
        field: field
      })
    }
  })
  
  return errors
}
```

#### Rule 5.2: Truncation Detection
```typescript
const TRUNCATION_PATTERNS = [
  /\.\.\.\(truncated (\d+) characters\)\.\.\./,
  /\[data truncated\]/,
  /\.\.\.\s*$/
]

const validateTruncation = (
  value: string,
  context: { sheet: string; row: number; column: string }
): ValidationResult => {
  for (const pattern of TRUNCATION_PATTERNS) {
    const match = value.match(pattern)
    if (match) {
      const truncatedChars = match[1] ? parseInt(match[1]) : 'unknown'
      
      return {
        valid: true,
        warning: `Data truncated in ${context.sheet} row ${context.row} column ${context.column} (${truncatedChars} chars)`,
        severity: 'warning',
        action: 'DEFAULT_ZERO'
      }
    }
  }
  
  return { valid: true }
}
```

### 6. Cross-Reference Validation

#### Rule 6.1: Vendor/Contractor Validation
```typescript
const validateVendorReferences = (
  items: BudgetLineItem[]
): ValidationResult[] => {
  const errors: ValidationResult[] = []
  const vendors = new Set<string>()
  const contractors = new Set<string>()
  
  // First pass: collect all vendors/contractors
  items.forEach(item => {
    if (item.supplier_name) vendors.add(item.supplier_name)
    if (item.contractor_name) contractors.add(item.contractor_name)
  })
  
  // Second pass: validate references
  items.forEach(item => {
    if (item.category === 'MATERIAL' && !item.supplier_name) {
      errors.push({
        valid: true,
        warning: `Material item missing supplier: ${item.description}`,
        severity: 'info'
      })
    }
    
    if (item.category === 'SUBCONTRACT' && !item.contractor_name) {
      errors.push({
        valid: false,
        error: `Subcontract item missing contractor: ${item.description}`,
        severity: 'error'
      })
    }
  })
  
  return errors
}
```

## Validation Workflow

### Pre-Import Validation
```typescript
class PreImportValidator {
  async validate(file: File): Promise<ValidationReport> {
    const report: ValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      info: []
    }
    
    // 1. File validation
    if (file.size > 50 * 1024 * 1024) {
      report.errors.push({
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds 50MB limit'
      })
      report.valid = false
    }
    
    // 2. File type validation
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    
    if (!validTypes.includes(file.type)) {
      report.errors.push({
        code: 'INVALID_FILE_TYPE',
        message: 'File must be Excel format (.xlsx or .xls)'
      })
      report.valid = false
    }
    
    return report
  }
}
```

### During Import Validation
```typescript
class ImportValidator {
  private errors: ValidationError[] = []
  private warnings: ValidationWarning[] = []
  
  validateRow(row: any, context: ImportContext): boolean {
    // Required fields
    const requiredErrors = validateRequiredFields(row, context.entityType)
    this.errors.push(...requiredErrors.filter(r => !r.valid))
    
    // Data type validation
    if (context.expectedTypes) {
      Object.entries(context.expectedTypes).forEach(([field, type]) => {
        if (!this.validateType(row[field], type)) {
          this.errors.push({
            code: 'INVALID_TYPE',
            field: field,
            expected: type,
            actual: typeof row[field]
          })
        }
      })
    }
    
    // Business rules
    if (context.validators) {
      context.validators.forEach(validator => {
        const result = validator(row)
        if (!result.valid) {
          this.errors.push(result.error)
        }
        if (result.warning) {
          this.warnings.push(result.warning)
        }
      })
    }
    
    return this.errors.length === 0
  }
  
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'number':
        return !isNaN(Number(value))
      case 'string':
        return value !== null && value !== undefined
      case 'boolean':
        return typeof value === 'boolean' || 
               value === 'true' || value === 'false' ||
               value === 1 || value === 0
      default:
        return true
    }
  }
}
```

### Post-Import Validation
```typescript
class PostImportValidator {
  async validate(projectId: string): Promise<ValidationReport> {
    const report: ValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      info: []
    }
    
    // 1. WBS hierarchy validation
    const hierarchyErrors = await this.validateHierarchy(projectId)
    report.errors.push(...hierarchyErrors)
    
    // 2. Financial validation
    const financialErrors = await this.validateFinancials(projectId)
    report.errors.push(...financialErrors)
    
    // 3. Cross-reference validation
    const referenceWarnings = await this.validateReferences(projectId)
    report.warnings.push(...referenceWarnings)
    
    // 4. Data quality checks
    const qualityInfo = await this.checkDataQuality(projectId)
    report.info.push(...qualityInfo)
    
    report.valid = report.errors.length === 0
    
    return report
  }
  
  private async validateHierarchy(projectId: string): Promise<ValidationError[]> {
    // Implement 100% rule validation
    // Check parent-child relationships
    // Verify level constraints
    return []
  }
  
  private async validateFinancials(projectId: string): Promise<ValidationError[]> {
    // Cross-sheet totals
    // Component cost validation
    // Budget constraints
    return []
  }
  
  private async validateReferences(projectId: string): Promise<ValidationWarning[]> {
    // Vendor references
    // Labor category references
    // Discipline mappings
    return []
  }
  
  private async checkDataQuality(projectId: string): Promise<ValidationInfo[]> {
    // Completeness metrics
    // Data coverage
    // Suggestions for improvement
    return []
  }
}
```

## Validation Error Handling

### Error Recovery Strategies
```typescript
interface ErrorRecoveryStrategy {
  errorCode: string
  strategy: 'DEFAULT' | 'SKIP' | 'ASK_USER' | 'AUTO_FIX'
  handler: (error: ValidationError, context: any) => any
}

const ERROR_RECOVERY: ErrorRecoveryStrategy[] = [
  {
    errorCode: 'TRUNCATED_DATA',
    strategy: 'DEFAULT',
    handler: (error, context) => {
      // Default numeric fields to 0
      if (context.expectedType === 'number') return 0
      // Default string fields to empty
      return ''
    }
  },
  {
    errorCode: 'INVALID_LABOR_CATEGORY',
    strategy: 'AUTO_FIX',
    handler: (error, context) => {
      // Try to match to closest valid category
      const closest = findClosestMatch(
        context.value, 
        VALID_DIRECT_LABOR_CATEGORIES
      )
      return closest || context.value
    }
  },
  {
    errorCode: 'MISSING_DISCIPLINE',
    strategy: 'ASK_USER',
    handler: (error, context) => {
      // Prompt user to select discipline
      return {
        prompt: 'Select discipline for this item',
        options: Array.from(STANDARD_DISCIPLINES.keys()),
        default: 'MECHANICAL'
      }
    }
  }
]
```

## Validation Reporting

### Validation Report Format
```typescript
interface ValidationReport {
  valid: boolean
  timestamp: Date
  summary: {
    total_items: number
    valid_items: number
    errors_count: number
    warnings_count: number
    processing_time_ms: number
  }
  errors: Array<{
    code: string
    message: string
    location?: {
      sheet?: string
      row?: number
      column?: string
      wbs_code?: string
    }
    severity: 'critical' | 'error'
    impact: string
    suggestion?: string
  }>
  warnings: Array<{
    code: string
    message: string
    location?: any
    action_taken?: string
  }>
  info: Array<{
    type: string
    message: string
    details?: any
  }>
  metrics: {
    coverage: {
      sheets_processed: number
      sheets_total: number
      percentage: number
    }
    quality: {
      complete_items: number
      partial_items: number
      score: number
    }
    performance: {
      items_per_second: number
      memory_used_mb: number
    }
  }
}
```

### Example Validation Report
```json
{
  "valid": false,
  "timestamp": "2025-01-30T10:30:00Z",
  "summary": {
    "total_items": 1523,
    "valid_items": 1498,
    "errors_count": 3,
    "warnings_count": 22,
    "processing_time_ms": 3456
  },
  "errors": [
    {
      "code": "RULE_100_VIOLATION",
      "message": "100% rule violation at 1.1.9: Parent=$500000, Children=$499850, Diff=$150",
      "location": {
        "wbs_code": "1.1.9"
      },
      "severity": "error",
      "impact": "Budget totals will not reconcile",
      "suggestion": "Review line items under Mechanical Group for missing entries"
    }
  ],
  "warnings": [
    {
      "code": "HIGH_LABOR_RATE",
      "message": "Supervisor rate $125/hr is high for 2000 hours",
      "location": {
        "sheet": "DIRECTS",
        "row": 35
      },
      "action_taken": "Accepted with warning"
    }
  ],
  "info": [
    {
      "type": "NEW_DISCIPLINE",
      "message": "New discipline 'CIVIL - GROUNDING' added to registry",
      "details": {
        "mapped_to": "CIVIL",
        "wbs_prefix": "1.1.8"
      }
    }
  ],
  "metrics": {
    "coverage": {
      "sheets_processed": 9,
      "sheets_total": 10,
      "percentage": 90
    },
    "quality": {
      "complete_items": 1420,
      "partial_items": 103,
      "score": 93.2
    },
    "performance": {
      "items_per_second": 441,
      "memory_used_mb": 125
    }
  }
}