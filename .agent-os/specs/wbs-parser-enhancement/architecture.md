# WBS Parser Enhancement - Technical Architecture

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document details the technical architecture for enhancing CostTrak's WBS parser to support a 5-level hierarchy with comprehensive Excel sheet parsing capabilities.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Budget Import  │  │ WBS Viewer   │  │ API Client   │  │
│  │      UI         │  │ Component    │  │              │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
┌───────────▼──────────────────▼──────────────────▼──────────┐
│                        API Layer                            │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ /budget-import  │  │ /wbs-hierarchy│  │ /budget-query│  │
│  │    Enhanced     │  │   New API    │  │   Enhanced   │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
┌───────────▼──────────────────▼──────────────────▼──────────┐
│                     Service Layer                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           ExcelBudgetAnalyzer (Enhanced)            │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │  │
│  │ │StaffParser  │ │DirectsParser│ │MaterialsParser│   │  │
│  │ └─────────────┘ └─────────────┘ └─────────────┘   │  │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │  │
│  │ │SubsParser   │ │EquipParser  │ │ConstParser  │   │  │
│  │ └─────────────┘ └─────────────┘ └─────────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ WBSValidator    │  │DisciplineMapper│  │WBSBuilder  │  │
│  └─────────────────┘  └──────────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ wbs_structure   │  │budget_line_  │  │ discipline_ │  │
│  │   (5 levels)    │  │    items     │  │  registry   │  │
│  └─────────────────┘  └──────────────┘  └─────────────┘  │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │phase_allocations│  │excel_sheet_  │  │ labor_      │  │
│  │                 │  │  mappings    │  │ categories  │  │
│  └─────────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Enhanced ExcelBudgetAnalyzer

**Location**: `/lib/services/excel-budget-analyzer.ts`

```typescript
export class ExcelBudgetAnalyzer {
  private parsers: Map<string, SheetParser>
  private validator: WBSValidator
  private builder: WBSBuilder
  
  constructor() {
    this.initializeParsers()
    this.validator = new WBSValidator()
    this.builder = new WBSBuilder()
  }
  
  private initializeParsers() {
    this.parsers = new Map([
      ['STAFF', new StaffParser()],
      ['DIRECTS', new DirectsParser()],
      ['MATERIALS', new MaterialsParser()],
      ['SUBS', new SubsParser()],
      ['DISC. EQUIPMENT', new EquipmentParser()],
      ['CONSTRUCTABILITY', new ConstructabilityParser()],
      ['SCAFFOLDING', new ScaffoldingParser()]
    ])
  }
  
  async extractBudgetData(workbook: XLSX.WorkBook): Promise<WBSData> {
    // Enhanced to support 5-level hierarchy
  }
}
```

### 2. Sheet Parser Architecture

**Base Parser Interface**:

```typescript
interface SheetParser {
  parse(worksheet: XLSX.WorkSheet): Promise<ParsedSheetData>
  validate(data: ParsedSheetData): ValidationResult
  mapToWBS(data: ParsedSheetData): WBSLineItem[]
}

abstract class BaseSheetParser implements SheetParser {
  protected handleTruncation(value: string): any
  protected parseNumericValue(value: any): number
  protected detectStructure(worksheet: XLSX.WorkSheet): SheetStructure
}
```

### 3. WBS Data Model (5-Level)

```typescript
interface WBSLevel {
  1: 'Project'
  2: 'Phase'
  3: 'Group'
  4: 'Category'
  5: 'LineItem'
}

interface WBSNode {
  // Identity
  id: string
  code: string
  parent_code?: string
  level: keyof WBSLevel
  
  // Classification
  description: string
  discipline?: string
  phase?: PhaseType
  cost_type?: CostType
  
  // Hierarchy
  children: WBSNode[]
  path: string[] // Full path from root
  
  // Financial
  budget_total: number
  labor_cost: number
  material_cost: number
  equipment_cost: number
  subcontract_cost: number
  other_cost: number
  
  // Labor
  manhours_total?: number
  direct_hours?: number
  indirect_hours?: number
  crew_size?: number
  
  // Metadata
  source_sheet?: string
  source_row?: number
  notes?: string
}
```

### 4. Labor Categories Structure

```typescript
// 39 Direct Labor Categories
enum DirectLaborCategory {
  BOILER_MAKER_A = 'Boiler Maker - Class A',
  BOILER_MAKER_B = 'Boiler Maker - Class B',
  CARPENTER_A = 'Carpenter - Class A',
  CARPENTER_B = 'Carpenter - Class B',
  // ... 35 more categories
}

// 23 Indirect Labor Roles
enum IndirectLaborRole {
  AREA_SUPERINTENDENT = 'Area Superintendent',
  CLERK = 'Clerk',
  COST_ENGINEER = 'Cost Engineer',
  // ... 20 more roles
}

// 4 Project Phases
enum ProjectPhase {
  JOB_SET_UP = 'Job Set Up',
  PRE_WORK = 'Pre-Work',
  PROJECT_EXECUTION = 'Project Execution',
  JOB_CLOSE_OUT = 'Job Close Out'
}

interface PhaseAllocation {
  phase: ProjectPhase
  role: IndirectLaborRole
  fte: number
  duration_months: number
  monthly_rate: number
  total_cost: number
  perdiem?: number
  add_ons?: number
}
```

### 5. Discipline Registry

```typescript
interface DisciplineEntry {
  id: string
  name: string
  parent_group: string
  wbs_code_prefix: string
  is_standard: boolean
  created_at: Date
  updated_at: Date
}

class DisciplineRegistry {
  private cache: Map<string, DisciplineEntry>
  
  async register(discipline: string): Promise<DisciplineEntry>
  async mapToGroup(discipline: string): Promise<string>
  async getDynamicDisciplines(): Promise<DisciplineEntry[]>
}
```

## Database Schema Updates

### New Tables

```sql
-- Master discipline registry
CREATE TABLE discipline_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  parent_group VARCHAR NOT NULL,
  wbs_code_prefix VARCHAR(10),
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase allocations for indirect labor
CREATE TABLE phase_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  phase VARCHAR NOT NULL CHECK (phase IN ('JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT')),
  role VARCHAR NOT NULL,
  fte DECIMAL(5,2),
  duration_months INTEGER,
  monthly_rate DECIMAL(10,2),
  perdiem DECIMAL(10,2),
  add_ons DECIMAL(10,2),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (fte * duration_months * (monthly_rate + COALESCE(perdiem, 0) + COALESCE(add_ons, 0))) STORED
);

-- Labor categories reference
CREATE TABLE labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type VARCHAR CHECK (category_type IN ('DIRECT', 'INDIRECT')),
  name VARCHAR NOT NULL,
  code VARCHAR(10),
  standard_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true
);
```

### Updated Tables

```sql
-- Extend wbs_structure for 5 levels
ALTER TABLE wbs_structure 
ADD COLUMN phase VARCHAR,
ADD COLUMN cost_type VARCHAR CHECK (cost_type IN ('DL', 'IL', 'MAT', 'EQ', 'SUB')),
ADD COLUMN labor_category_id UUID REFERENCES labor_categories(id),
ADD CONSTRAINT check_level CHECK (level BETWEEN 1 AND 5);

-- Add phase support to budget_line_items
ALTER TABLE budget_line_items
ADD COLUMN phase VARCHAR,
ADD COLUMN labor_category VARCHAR,
ADD COLUMN is_add_on BOOLEAN DEFAULT false;
```

## API Design

### Enhanced Budget Import

```typescript
// POST /api/projects/[id]/budget-import
interface BudgetImportRequest {
  file: File
  options: {
    clearExisting: boolean
    validateOnly: boolean
    useFiveLevel: boolean // New option
  }
}

interface BudgetImportResponse {
  success: boolean
  summary: {
    sheets_processed: number
    line_items_created: number
    wbs_nodes_created: number
    validation_warnings: string[]
  }
  hierarchy: WBSNode[] // Full 5-level hierarchy
}
```

### New WBS Hierarchy API

```typescript
// GET /api/projects/[id]/wbs-hierarchy
interface WBSHierarchyParams {
  level?: number // Filter by level (1-5)
  discipline?: string
  phase?: string
  cost_type?: string
  include_empty?: boolean
}

// GET /api/projects/[id]/wbs-node/[code]
interface WBSNodeResponse {
  node: WBSNode
  children: WBSNode[]
  lineItems: BudgetLineItem[]
  rollup: {
    total_cost: number
    total_manhours: number
    child_count: number
  }
}
```

## Performance Considerations

### 1. Streaming Parser

For files >10MB, implement streaming:

```typescript
class StreamingExcelParser {
  async *parseStream(stream: ReadableStream): AsyncGenerator<ParsedRow> {
    // Yield rows as they're parsed
  }
}
```

### 2. Database Optimization

- Composite indexes on (project_id, wbs_code, level)
- Materialized views for hierarchy queries
- Partitioning for large projects

### 3. Caching Strategy

```typescript
class WBSCache {
  private hierarchyCache: LRUCache<string, WBSNode[]>
  private ttl = 5 * 60 * 1000 // 5 minutes
  
  async getHierarchy(projectId: string): Promise<WBSNode[]>
  async invalidate(projectId: string): Promise<void>
}
```

## Error Handling

### Truncation Handling

```typescript
class TruncationHandler {
  private patterns = [
    /\.\.\.\(truncated \d+ characters\)\.\.\./,
    /\[data truncated\]/
  ]
  
  handle(value: string): {
    isTruncated: boolean
    cleanValue: any
    warning?: string
  }
}
```

### Validation Errors

```typescript
interface ValidationError {
  code: string
  level: 'error' | 'warning' | 'info'
  sheet?: string
  row?: number
  column?: string
  message: string
  suggestion?: string
}

class ValidationErrorCollector {
  private errors: ValidationError[] = []
  
  add(error: ValidationError): void
  getByLevel(level: string): ValidationError[]
  hasErrors(): boolean
  toReport(): ValidationReport
}
```

## Security Considerations

1. **File Upload Security**
   - Max file size: 50MB
   - Allowed MIME types: xlsx, xls, csv
   - Virus scanning integration
   - Sanitize file names

2. **Data Validation**
   - Zod schemas for all inputs
   - SQL injection prevention
   - XSS protection in descriptions

3. **Access Control**
   - RLS policies for all new tables
   - Role-based import permissions
   - Audit logging for imports

## Integration Points

### 1. Existing Systems

- Budget vs Actual reporting
- Labor forecasting module
- Financial dashboards
- Change order impacts

### 2. External Systems

- ERP export formats
- Excel template compatibility
- API webhooks for import events

## Migration Strategy

### From 3-Level to 5-Level

```typescript
class WBSMigrator {
  async migrate3To5Level(projectId: string): Promise<MigrationResult> {
    // 1. Backup existing data
    // 2. Transform 3-level to 5-level
    // 3. Validate transformation
    // 4. Apply changes
    // 5. Update references
  }
}
```

## Monitoring & Observability

### Key Metrics

- Import processing time by file size
- Parser errors by sheet type
- Validation warning frequency
- API response times
- Memory usage during import

### Logging

```typescript
interface ImportLog {
  timestamp: Date
  project_id: string
  user_id: string
  file_name: string
  file_size: number
  sheets_processed: string[]
  duration_ms: number
  errors: ValidationError[]
  result: 'success' | 'partial' | 'failed'
}
```

## Future Extensibility

1. **Additional Sheet Types**
   - Easy to add new parsers
   - Plugin architecture for custom sheets

2. **WBS Templates**
   - Save/load WBS structures
   - Industry-standard templates

3. **AI-Assisted Mapping**
   - ML for discipline detection
   - Automatic categorization

4. **Real-time Collaboration**
   - Multiple users importing
   - Conflict resolution

## Appendix: Technical Decisions

1. **Why 5 Levels?**
   - Industry standard depth
   - Balances detail vs complexity
   - Supports all use cases

2. **Why TypeScript?**
   - Type safety for financial data
   - Better IDE support
   - Easier refactoring

3. **Why Separate Parsers?**
   - Single responsibility
   - Easier testing
   - Parallel development