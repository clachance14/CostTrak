# WBS Parser Enhancement - API Design

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document specifies the API design for the enhanced WBS parser, including new endpoints, request/response schemas, and integration patterns.

## API Endpoints

### 1. Enhanced Budget Import

#### POST /api/projects/[id]/budget-import

Enhanced endpoint to support 5-level WBS import with comprehensive validation.

**Request**:
```typescript
interface BudgetImportRequest {
  file: File // multipart/form-data
  options: {
    clearExisting: boolean      // Clear existing budget data
    validateOnly: boolean        // Validation without import
    useFiveLevel: boolean        // Use 5-level WBS (default: true)
    strictValidation: boolean    // Fail on warnings (default: false)
  }
}
```

**Response**:
```typescript
interface BudgetImportResponse {
  success: boolean
  importId: string
  summary: {
    sheets_processed: number
    line_items_created: number
    wbs_nodes_created: number
    phases_allocated: number
    disciplines_discovered: string[]
    total_budget: number
    total_manhours: number
  }
  validation: {
    errors: ValidationError[]
    warnings: ValidationWarning[]
    info: ValidationInfo[]
  }
  hierarchy: WBSNode[] // Full 5-level hierarchy preview
  processing_time_ms: number
}

interface ValidationError {
  code: string // e.g., 'INVALID_WBS_CODE', 'MISSING_DISCIPLINE'
  sheet: string
  row?: number
  column?: string
  message: string
  value?: any
}
```

**Example Request**:
```bash
curl -X POST https://api.costtrak.com/api/projects/123/budget-import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@budget.xlsx" \
  -F "options[clearExisting]=false" \
  -F "options[useFiveLevel]=true"
```

### 2. WBS Hierarchy Endpoints

#### GET /api/projects/[id]/wbs-hierarchy

Retrieve the complete or filtered WBS hierarchy for a project.

**Query Parameters**:
```typescript
interface WBSHierarchyParams {
  level?: number           // Filter by level (1-5)
  discipline?: string      // Filter by discipline
  phase?: string          // Filter by phase
  cost_type?: string      // Filter by cost type (DL, IL, MAT, EQ, SUB)
  include_empty?: boolean // Include nodes with zero budget
  depth?: number          // Max depth to return (default: 5)
  format?: 'tree' | 'flat' // Response format
}
```

**Response**:
```typescript
interface WBSHierarchyResponse {
  project_id: string
  hierarchy: WBSNode[] | FlatWBSNode[]
  metadata: {
    total_nodes: number
    max_depth: number
    disciplines: string[]
    phases: string[]
    last_updated: string
  }
}

interface FlatWBSNode extends WBSNode {
  path: string // e.g., "1.0 > 1.1 > 1.1.1 > 1.1.1.1"
  parent_path: string
  depth: number
}
```

#### GET /api/projects/[id]/wbs-node/[code]

Get detailed information for a specific WBS node.

**Response**:
```typescript
interface WBSNodeDetailResponse {
  node: WBSNode
  parent?: WBSNode
  children: WBSNode[]
  lineItems: BudgetLineItem[]
  rollup: {
    total_cost: number
    labor_cost: number
    material_cost: number
    equipment_cost: number
    subcontract_cost: number
    total_manhours: number
    direct_hours: number
    indirect_hours: number
    child_count: number
    line_item_count: number
  }
  allocations?: PhaseAllocation[] // For indirect labor nodes
}
```

### 3. Labor Management Endpoints

#### GET /api/projects/[id]/labor-categories

Retrieve all labor categories with current allocations.

**Response**:
```typescript
interface LaborCategoriesResponse {
  direct: DirectLaborSummary[]
  indirect: IndirectLaborSummary[]
}

interface DirectLaborSummary {
  category: string // One of 39 categories
  code: string
  total_manhours: number
  total_cost: number
  average_rate: number
  disciplines: string[]
}

interface IndirectLaborSummary {
  role: string // One of 23 roles
  code: string
  phases: {
    phase: string
    fte: number
    duration_months: number
    cost: number
  }[]
  total_cost: number
}
```

#### POST /api/projects/[id]/phase-allocations

Create or update phase allocations for indirect labor.

**Request**:
```typescript
interface PhaseAllocationRequest {
  allocations: {
    phase: 'JOB_SET_UP' | 'PRE_WORK' | 'PROJECT_EXECUTION' | 'JOB_CLOSE_OUT'
    role: string // One of 23 indirect roles
    fte: number
    duration_months: number
    monthly_rate: number
    perdiem?: number
    add_ons?: number
  }[]
}
```

### 4. Discipline Management

#### GET /api/disciplines

Get all registered disciplines.

**Response**:
```typescript
interface DisciplinesResponse {
  standard: DisciplineEntry[]
  custom: DisciplineEntry[]
}

interface DisciplineEntry {
  id: string
  name: string
  parent_group: string
  wbs_code_prefix: string
  is_standard: boolean
  project_count: number // Number of projects using this
}
```

#### POST /api/disciplines

Register a new custom discipline.

**Request**:
```typescript
interface CreateDisciplineRequest {
  name: string
  parent_group: string
  wbs_code_prefix?: string
}
```

### 5. Budget Query Endpoints

#### GET /api/projects/[id]/budget-by-cost-type

Query budget by specific cost types across all disciplines.

**Query Parameters**:
```typescript
interface BudgetByCostTypeParams {
  cost_types?: string[] // e.g., ['PERDIEM', 'ADD_ONS']
  disciplines?: string[]
  group_by?: 'discipline' | 'phase' | 'category'
}
```

**Response**:
```typescript
interface BudgetByCostTypeResponse {
  results: {
    cost_type: string
    discipline?: string
    phase?: string
    total_cost: number
    line_item_count: number
    percentage_of_total: number
  }[]
  totals: {
    grand_total: number
    by_cost_type: Record<string, number>
  }
}
```

#### GET /api/projects/[id]/budget-vs-actual-enhanced

Enhanced budget vs actual with WBS hierarchy support.

**Query Parameters**:
```typescript
interface BudgetVsActualParams {
  view: 'category' | 'wbs' | 'discipline' | 'phase'
  level?: number // WBS level for rollup
  include_forecast?: boolean
}
```

**Response**:
```typescript
interface BudgetVsActualResponse {
  view: string
  data: {
    code: string
    description: string
    budget: number
    actual: number
    forecast?: number
    variance: number
    variance_percentage: number
    children?: any[] // Recursive
  }[]
  totals: {
    budget: number
    actual: number
    forecast?: number
    variance: number
  }
}
```

### 6. Validation Endpoints

#### POST /api/projects/[id]/validate-budget

Validate budget data without importing.

**Request**:
```typescript
interface ValidateBudgetRequest {
  file: File
  options: {
    check_100_rule: boolean
    check_cross_sheet: boolean
    check_disciplines: boolean
  }
}
```

**Response**:
```typescript
interface ValidationResponse {
  valid: boolean
  summary: {
    sheets_found: string[]
    total_budget: number
    total_manhours: number
    disciplines: string[]
  }
  issues: {
    errors: ValidationIssue[]
    warnings: ValidationIssue[]
    suggestions: ValidationSuggestion[]
  }
}

interface ValidationIssue {
  type: string
  severity: 'error' | 'warning'
  location: {
    sheet?: string
    row?: number
    column?: string
  }
  message: string
  impact: string
}

interface ValidationSuggestion {
  type: string
  message: string
  action: string
}
```

## Error Handling

### Error Response Format

All endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    request_id: string
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_FILE_FORMAT` | Uploaded file is not valid Excel | 400 |
| `FILE_TOO_LARGE` | File exceeds 50MB limit | 413 |
| `MISSING_REQUIRED_SHEET` | Required sheet not found | 400 |
| `INVALID_WBS_STRUCTURE` | WBS validation failed | 422 |
| `DISCIPLINE_NOT_FOUND` | Unknown discipline | 404 |
| `PERMISSION_DENIED` | User lacks import permission | 403 |
| `PROJECT_NOT_FOUND` | Project doesn't exist | 404 |
| `CONCURRENT_IMPORT` | Another import in progress | 409 |

## Authentication & Authorization

### Headers

All requests must include:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json (except file uploads)
X-Request-ID: <unique_request_id> (optional)
```

### Permissions

| Endpoint | Required Role | Additional Checks |
|----------|--------------|-------------------|
| Budget Import | Controller or delegated PM | Project access |
| WBS Hierarchy | Any authenticated | Project visibility |
| Labor Categories | Any authenticated | Project visibility |
| Phase Allocations | Controller or PM | Project edit permission |
| Discipline Management | Controller | Global permission |

## Rate Limiting

| Endpoint Type | Rate Limit | Window |
|--------------|------------|---------|
| Import endpoints | 10 requests | 1 hour |
| Query endpoints | 100 requests | 1 minute |
| Validation | 20 requests | 1 hour |

## Pagination

For endpoints returning lists:

```typescript
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
  links: {
    first?: string
    prev?: string
    next?: string
    last?: string
  }
}
```

## Webhooks

Import events can trigger webhooks:

```typescript
interface ImportWebhookPayload {
  event: 'budget.import.started' | 'budget.import.completed' | 'budget.import.failed'
  project_id: string
  import_id: string
  user_id: string
  timestamp: string
  data: {
    file_name: string
    file_size: number
    sheets_processed?: string[]
    line_items_created?: number
    errors?: ValidationError[]
  }
}
```

## Caching

### Cache Headers

```
Cache-Control: private, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
```

### Cache Invalidation

- Budget import invalidates all project caches
- WBS updates invalidate hierarchy cache
- Phase allocations invalidate labor caches

## API Versioning

Version included in URL path:

```
/api/v1/projects/[id]/budget-import
/api/v2/projects/[id]/budget-import (future)
```

## SDK Examples

### TypeScript Client

```typescript
import { CostTrakClient } from '@costtrak/sdk'

const client = new CostTrakClient({
  apiKey: process.env.COSTTRAK_API_KEY,
  baseUrl: 'https://api.costtrak.com'
})

// Import budget
const result = await client.projects.importBudget(projectId, {
  file: budgetFile,
  options: {
    useFiveLevel: true,
    validateOnly: false
  }
})

// Query WBS hierarchy
const hierarchy = await client.projects.getWBSHierarchy(projectId, {
  level: 3,
  discipline: 'MECHANICAL'
})

// Get labor categories
const labor = await client.projects.getLaborCategories(projectId)
```

### React Hook Examples

```typescript
// Budget import hook
const { mutate: importBudget, isLoading } = useImportBudget(projectId)

// WBS hierarchy hook
const { data: hierarchy } = useWBSHierarchy(projectId, {
  level: 3,
  discipline: 'MECHANICAL'
})

// Labor categories hook
const { data: laborCategories } = useLaborCategories(projectId)
```

## GraphQL Alternative (Future)

For complex queries, consider GraphQL:

```graphql
query GetProjectWBS($projectId: ID!, $level: Int) {
  project(id: $projectId) {
    wbsHierarchy(level: $level) {
      nodes {
        code
        description
        level
        budget_total
        children {
          code
          description
        }
      }
    }
  }
}
```

## Performance SLAs

| Operation | Target | Max |
|-----------|--------|-----|
| Import 10MB file | < 5s | 10s |
| Query hierarchy | < 100ms | 500ms |
| Validate budget | < 2s | 5s |
| Labor rollup | < 200ms | 1s |

## Monitoring

Key metrics to track:

- Import success rate
- Average import duration by file size
- Validation error frequency
- API response times (p50, p95, p99)
- Cache hit rates

## Migration Notes

### Breaking Changes from v1

1. WBS structure now 5 levels (was 3)
2. Labor categories standardized to 39/23
3. Phase allocation required for indirect labor
4. Discipline registry replaces hard-coded list

### Backwards Compatibility

- 3-level WBS still supported with `useFiveLevel: false`
- Legacy discipline names mapped automatically
- Old import format converted on the fly