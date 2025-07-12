# TypeScript Types & Type Generation

## Overview

CostTrak uses TypeScript for end-to-end type safety, with automatic type generation from the Supabase database schema. This ensures our types always match the database structure.

## Type Generation Setup

### Install Supabase CLI

```bash
npm install -g supabase
```

### Generate Types Command

Add to `package.json`:

```json
{
  "scripts": {
    "generate-types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.ts",
    "generate-types:local": "supabase gen types typescript --local > src/types/database.ts"
  }
}
```

### Generated Types Structure

The generated `database.ts` file provides:

```typescript
export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          job_number: string
          name: string
          division: string
          client_id: string | null
          contract_value: number
          status: string
          // ... all columns
        }
        Insert: {
          id?: string
          job_number: string
          // ... required and optional fields
        }
        Update: {
          id?: string
          job_number?: string
          // ... all fields optional
        }
      }
      // ... other tables
    }
    Views: {
      // Generated view types
    }
    Functions: {
      // Generated function types
    }
    Enums: {
      // Custom enums if defined
    }
  }
}
```

## Business Logic Types

### Base Table Types

```typescript
// src/types/index.ts
import { Database } from './database'

// Extract table types
export type Tables = Database['public']['Tables']
export type Project = Tables['projects']['Row']
export type ProjectInsert = Tables['projects']['Insert']
export type ProjectUpdate = Tables['projects']['Update']

export type User = Tables['users']['Row']
export type PurchaseOrder = Tables['purchase_orders']['Row']
export type LaborForecast = Tables['labor_forecasts']['Row']
export type ChangeOrder = Tables['change_orders']['Row']
export type ExtraCost = Tables['extra_costs']['Row']
export type FinancialSnapshot = Tables['financial_snapshots']['Row']
export type Notification = Tables['notifications']['Row']
```

### Enum Types

```typescript
// src/types/enums.ts
export const UserRoles = {
  EXECUTIVE: 'executive',
  OPS_MANAGER: 'ops_manager',
  PROJECT_MANAGER: 'project_manager',
  ACCOUNTING: 'accounting',
  CONTROLLER: 'controller',
  VIEWER: 'viewer'
} as const

export type UserRole = typeof UserRoles[keyof typeof UserRoles]

export const ProjectStatuses = {
  ACTIVE: 'Active',
  CLOSED: 'Closed'
} as const

export type ProjectStatus = typeof ProjectStatuses[keyof typeof ProjectStatuses]

export const CraftTypes = {
  MECHANICAL: 'Mechanical',
  IE: 'I&E',
  CIVIL: 'Civil'
} as const

export type CraftType = typeof CraftTypes[keyof typeof CraftTypes]

export const GroupTypes = {
  DIRECT: 'Direct',
  INDIRECT: 'Indirect',
  STAFF: 'Staff'
} as const

export type GroupType = typeof GroupTypes[keyof typeof GroupTypes]
```

### Extended Types with Relationships

```typescript
// src/types/models.ts
import { Project, User, Client, PurchaseOrder, ChangeOrder } from './index'

// Project with relationships
export interface ProjectWithRelations extends Project {
  client?: Client
  project_manager?: User
  purchase_orders?: PurchaseOrder[]
  change_orders?: ChangeOrder[]
  total_committed?: number
  total_invoiced?: number
  margin_percent?: number
}

// Dashboard types
export interface ProjectSummary extends Project {
  po_count: number
  total_po_value: number
  approved_change_orders: number
  total_change_value: number
  labor_actual: number
  labor_forecast: number
  margin: number
  margin_percent: number
}

export interface DivisionSummary {
  division: string
  project_count: number
  total_contract_value: number
  total_revised_value: number
  average_margin: number
  active_projects: number
}

export interface CompanyMetrics {
  cash_on_hand: number
  total_backlog: number
  average_margin: number
  net_income: number
  active_projects: number
  total_employees: number
  as_of_date: string
}
```

### API Response Types

```typescript
// src/types/api.ts
export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  count?: number
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

// Import response types
export interface POImportResult {
  success: boolean
  imported: number
  errors: Array<{
    row: number
    field: string
    message: string
  }>
  purchase_orders?: PurchaseOrder[]
}

export interface LaborForecastEntry {
  project_id: string
  period_start: string
  period_end: string
  entries: Array<{
    craft_type: CraftType
    group_type: GroupType
    forecasted_hours: number
    forecasted_cost: number
  }>
}
```

### Form Types

```typescript
// src/types/forms.ts
import { z } from 'zod'
import { projectSchema, laborForecastSchema } from '@/lib/schemas'

// Infer types from Zod schemas
export type ProjectFormData = z.infer<typeof projectSchema>
export type LaborForecastFormData = z.infer<typeof laborForecastSchema>

// Custom form types
export interface POImportFormData {
  project_id: string
  file: File
  override_existing: boolean
}

export interface FilterOptions {
  division?: string
  status?: ProjectStatus
  project_manager_id?: string
  date_range?: {
    start: string
    end: string
  }
}
```

### Utility Types

```typescript
// src/types/utils.ts

// Make all properties optional except specified keys
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>

// Extract non-nullable type
export type NonNullable<T> = T extends null | undefined ? never : T

// Supabase query builder types
export type SupabaseQueryBuilder<T> = PostgrestQueryBuilder<Database, T, T[]>

// Role permission checker
export type RolePermission = {
  [K in UserRole]: {
    canViewAllProjects: boolean
    canEditProjects: boolean
    canImportPOs: boolean
    canManageUsers: boolean
    canViewReports: boolean
    canConfigureSystem: boolean
  }
}
```

## Type Guards

```typescript
// src/lib/type-guards.ts
import { UserRole, ProjectStatus } from '@/types/enums'

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && 
    Object.values(UserRoles).includes(value as UserRole)
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && 
    Object.values(ProjectStatuses).includes(value as ProjectStatus)
}

export function hasRequiredProjectFields(
  project: unknown
): project is ProjectInsert {
  return (
    typeof project === 'object' &&
    project !== null &&
    'job_number' in project &&
    'name' in project &&
    'division' in project &&
    'contract_value' in project
  )
}
```

## Using Types in Components

```typescript
// Example component usage
import { Project, PurchaseOrder } from '@/types'
import { ProjectWithRelations } from '@/types/models'

interface ProjectDetailProps {
  project: ProjectWithRelations
  onUpdate: (updates: ProjectUpdate) => Promise<void>
}

export function ProjectDetail({ project, onUpdate }: ProjectDetailProps) {
  const totalPOValue = project.purchase_orders?.reduce(
    (sum, po) => sum + po.committed_amount, 
    0
  ) || 0

  // Type-safe operations
  const handleStatusChange = async (status: ProjectStatus) => {
    await onUpdate({ status })
  }

  return (
    // Component JSX
  )
}
```

## Type Generation Workflow

1. **Database changes**: Modify schema in Supabase
2. **Generate types**: Run `npm run generate-types`
3. **Extend types**: Add business logic types if needed
4. **Update validation**: Sync Zod schemas with new types
5. **Type check**: Run `npm run type-check`

## Best Practices

1. **Never modify generated files** - They'll be overwritten
2. **Extend generated types** in separate files
3. **Use strict mode** - Enable all TypeScript strict flags
4. **Validate at boundaries** - Use Zod for runtime validation
5. **Export from index** - Centralize type exports
6. **Document complex types** - Add JSDoc comments
7. **Avoid `any`** - Use `unknown` and type guards instead

## Common Patterns

### Nullable Handling

```typescript
// Safe access with optional chaining
const clientName = project.client?.name ?? 'No client'

// Type narrowing
if (project.client_id) {
  // TypeScript knows client_id is not null here
  await loadClient(project.client_id)
}
```

### Generic Hooks

```typescript
// src/hooks/useSupabaseQuery.ts
export function useSupabaseQuery<T>(
  query: () => PostgrestQueryBuilder<Database, T, T[]>
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Implementation
  return { data, loading, error }
}
```

### Type-safe Supabase Client

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```