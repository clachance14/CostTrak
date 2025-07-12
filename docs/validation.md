# Data Validation with Zod

## Overview

CostTrak uses Zod for runtime data validation, ensuring data integrity at API boundaries, form submissions, and CSV imports. Zod provides TypeScript-first schema validation with static type inference.

## Core Validation Schemas

### Project Schemas

```typescript
// Actual implementation in components/forms/project-form.tsx
import { z } from 'zod'

// Form validation schema (string values for form inputs)
export const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  job_number: z.string().min(1, 'Job number is required').max(50),
  client_id: z.string().uuid('Please select a client'),
  division_id: z.string().uuid('Please select a division'),
  project_manager_id: z.string().uuid('Please select a project manager'),
  original_contract: z.string().min(1, 'Contract amount is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip_code: z.string().max(10).optional(),
  description: z.string().optional()
})

// API validation schema (used in /api/projects/route.ts)
export const projectApiSchema = z.object({
  name: z.string().min(1).max(200),
  job_number: z.string().min(1).max(50),
  client_id: z.string().uuid(),
  division_id: z.string().uuid(),
  project_manager_id: z.string().uuid(),
  original_contract: z.number().min(0),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip_code: z.string().max(10).optional(),
  description: z.string().optional()
})

// Update schema (for PATCH requests)
export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  project_manager_id: z.string().uuid().optional(),
  original_contract: z.number().min(0).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip_code: z.string().max(10).optional(),
  description: z.string().optional()
})
```

### Purchase Order Schemas (Read-Only System)

```typescript
// Actual implementation in app/api/purchase-orders/import/route.ts
import { z } from 'zod'

// CSV row validation schema for import
export const csvRowSchema = z.object({
  project_job_number: z.string().min(1),
  po_number: z.string().min(1),
  vendor_name: z.string().min(1),
  description: z.string().optional().default(''),
  committed_amount: z.number().min(0),
  invoiced_amount: z.number().min(0).optional().default(0),
  status: z.enum(['draft', 'approved', 'closed', 'cancelled']).optional().default('approved'),
  issue_date: z.string().optional(),
  expected_delivery: z.string().optional()
})

// Line item schema (if importing with line items)
export const poLineItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  total_amount: z.number().min(0)
})

// Query parameter schemas for filtering
export const poQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  project_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'approved', 'closed', 'cancelled']).optional(),
  vendor: z.string().optional(),
  search: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional()
})
```

### Labor Forecast Schemas

```typescript
// src/lib/schemas/labor-forecast.ts
import { z } from 'zod'

export const laborForecastSchema = z.object({
  project_id: z.string().uuid(),
  
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  
  craft_type: z.enum(['Mechanical', 'I&E', 'Civil']),
  group_type: z.enum(['Direct', 'Indirect', 'Staff']),
  
  actual_hours: z.number()
    .nonnegative('Hours cannot be negative')
    .max(9999.99, 'Hours value too large')
    .default(0),
  
  actual_cost: z.number()
    .nonnegative('Cost cannot be negative')
    .max(999999.99, 'Cost value too large')
    .default(0),
  
  forecasted_hours: z.number()
    .nonnegative('Hours cannot be negative')
    .max(9999.99, 'Hours value too large'),
  
  forecasted_cost: z.number()
    .nonnegative('Cost cannot be negative')
    .max(999999.99, 'Cost value too large')
})

// Batch entry schema
export const laborForecastBatchSchema = z.object({
  project_id: z.string().uuid(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  entries: z.array(
    z.object({
      craft_type: z.enum(['Mechanical', 'I&E', 'Civil']),
      group_type: z.enum(['Direct', 'Indirect', 'Staff']),
      forecasted_hours: z.number().nonnegative(),
      forecasted_cost: z.number().nonnegative()
    })
  ).min(1, 'At least one entry required')
})
```

### User & Auth Schemas

```typescript
// Actual implementation in lib/validations/auth.ts
import { z } from 'zod'

const ALLOWED_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || 'ics.ac'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
      `Email must be from @${ALLOWED_EMAIL_DOMAIN} domain`
    ),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
})

export const userRegistrationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
      `Email must be from @${ALLOWED_EMAIL_DOMAIN} domain`
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  role: z.enum(['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer']),
  division_id: z.string().uuid().optional(),
})
```

### Change Order Schemas

```typescript
// Status enum
export const changeOrderStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type ChangeOrderStatus = typeof changeOrderStatuses[number]

// Form validation schema
export const changeOrderFormSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  co_number: z.string()
    .min(1, 'CO number is required')
    .max(50, 'CO number must be less than 50 characters')
    .regex(/^CO-\d{3,}$/, 'CO number must follow format: CO-001'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num)
    }, 'Invalid amount format')
    .transform((val) => val.replace(/,/g, '')),
  impact_schedule_days: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseInt(val)
      return !isNaN(num)
    }, 'Must be a valid number'),
  submitted_date: z.string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
  status: z.enum(changeOrderStatuses).default('pending')
})

// API schema
export const changeOrderApiSchema = z.object({
  project_id: z.string().uuid(),
  co_number: z.string().min(1).max(50),
  description: z.string().min(10).max(500),
  amount: z.number()
    .refine((val) => val !== 0, 'Amount cannot be zero'),
  impact_schedule_days: z.number().int().default(0),
  submitted_date: z.string().datetime().optional(),
  status: z.enum(changeOrderStatuses).default('pending')
})

// Update schema (for PATCH)
export const changeOrderUpdateSchema = z.object({
  description: z.string().min(10).max(500).optional(),
  amount: z.number()
    .refine((val) => val !== 0, 'Amount cannot be zero')
    .optional(),
  impact_schedule_days: z.number().int().optional(),
  submitted_date: z.string().datetime().optional(),
  status: z.enum(changeOrderStatuses).optional()
})

// Approval/Rejection schema
export const changeOrderActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
  approved_date: z.string().datetime().optional()
})

// Business rule validations
export const validateChangeOrderAmount = (amount: number, userRole: string) => {
  const APPROVAL_THRESHOLD = 50000 // $50k threshold for ops managers
  
  if (userRole === 'controller') {
    return { valid: true }
  }
  
  if (userRole === 'ops_manager' && Math.abs(amount) <= APPROVAL_THRESHOLD) {
    return { valid: true }
  }
  
  return {
    valid: false,
    message: `Change orders over $${APPROVAL_THRESHOLD.toLocaleString()} require controller approval`
  }
}

// Status transition validation
export const validateStatusTransition = (
  currentStatus: ChangeOrderStatus,
  newStatus: ChangeOrderStatus,
  userRole: string
): { valid: boolean; message?: string } => {
  const allowedTransitions: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: [], // No transitions from approved
    rejected: ['pending'], // Can resubmit
    cancelled: [] // No transitions from cancelled
  }

  if (!allowedTransitions[currentStatus].includes(newStatus)) {
    return {
      valid: false,
      message: `Cannot transition from ${currentStatus} to ${newStatus}`
    }
  }

  if (newStatus === 'approved' || newStatus === 'rejected') {
    if (!['controller', 'ops_manager'].includes(userRole)) {
      return {
        valid: false,
        message: 'Only controllers and ops managers can approve/reject change orders'
      }
    }
  }

  return { valid: true }
}

// CO number generator
export const generateCoNumber = (existingNumbers: string[]): string => {
  if (existingNumbers.length === 0) {
    return 'CO-001'
  }

  const numbers = existingNumbers
    .map(num => {
      const match = num.match(/CO-(\d+)/)
      return match ? parseInt(match[1]) : 0
    })
    .filter(num => num > 0)

  const nextNumber = Math.max(...numbers, 0) + 1
  return `CO-${nextNumber.toString().padStart(3, '0')}`
}
```

## CSV Import Validation

### PO Import Schema

```typescript
// CSV Import Processing
import { z } from 'zod'
import * as XLSX from 'xlsx'

// CSV row preprocessing function
function preprocessCSVRow(row: any) {
  return {
    ...row,
    committed_amount: parseFloat(row.committed_amount || '0'),
    invoiced_amount: parseFloat(row.invoiced_amount || '0')
  }
}

// CSV validation workflow
export async function validateCSVImport(file: File) {
  // 1. Parse file
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { 
    type: 'buffer', 
    dateNF: 'yyyy-mm-dd' 
  })
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
  
  // 2. Validate each row
  const results = []
  const errors = []
  
  for (let i = 0; i < data.length; i++) {
    try {
      const processed = preprocessCSVRow(data[i])
      const validated = csvRowSchema.parse(processed)
      results.push(validated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push({
          row: i + 2, // Excel row number (1-indexed + header)
          field: error.errors[0]?.path[0],
          message: error.errors[0]?.message,
          data: data[i]
        })
      }
    }
  }
  
  return { valid: results, errors }
}

// Import result schema
export const importResultSchema = z.object({
  success: z.boolean(),
  imported: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    field: z.string().optional(),
    message: z.string(),
    data: z.any().optional()
  }))
})
```

## Form Validation Hooks

### useZodForm Hook

```typescript
// src/hooks/useZodForm.ts
import { useForm, UseFormProps } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export function useZodForm<TSchema extends z.ZodType>(
  props: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'> & {
    schema: TSchema
  }
) {
  const form = useForm<z.infer<TSchema>>({
    ...props,
    resolver: zodResolver(props.schema)
  })

  return form
}
```

### Form Component Example

```typescript
// src/components/forms/ProjectForm.tsx
import { useZodForm } from '@/hooks/useZodForm'
import { projectSchema } from '@/lib/schemas/project'

export function ProjectForm({ onSubmit }: { onSubmit: (data: ProjectFormData) => void }) {
  const form = useZodForm({
    schema: projectSchema,
    defaultValues: {
      status: 'Active'
    }
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('job_number')} />
      {form.formState.errors.job_number && (
        <span>{form.formState.errors.job_number.message}</span>
      )}
      
      {/* Other fields */}
      
      <button type="submit">Create Project</button>
    </form>
  )
}
```

## API Validation Middleware

### Next.js API Route Validation

```typescript
// src/lib/api/validate.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export function validateRequest<T extends z.ZodType>(schema: T) {
  return (handler: (req: NextRequest, data: z.infer<T>) => Promise<NextResponse>) => {
    return async (req: NextRequest) => {
      try {
        const body = await req.json()
        const validated = schema.parse(body)
        return handler(req, validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { 
              error: 'Validation failed', 
              details: error.errors 
            },
            { status: 400 }
          )
        }
        throw error
      }
    }
  }
}
```

### Usage in API Routes

```typescript
// src/app/api/projects/route.ts
import { validateRequest } from '@/lib/api/validate'
import { projectSchema } from '@/lib/schemas/project'

export const POST = validateRequest(projectSchema)(
  async (req, data) => {
    // data is fully typed and validated
    const project = await createProject(data)
    return NextResponse.json(project)
  }
)
```

## Custom Validators

### Business Rule Validators

```typescript
// src/lib/validators/business-rules.ts
import { z } from 'zod'

// Validate change order doesn't exceed percentage
export const changeOrderValidator = (maxPercentage: number = 10) => {
  return z.object({
    project_id: z.string().uuid(),
    amount: z.number()
  }).refine(async (data) => {
    const project = await getProject(data.project_id)
    const changePercent = (data.amount / project.contract_value) * 100
    return Math.abs(changePercent) <= maxPercentage
  }, {
    message: `Change order exceeds ${maxPercentage}% threshold`
  })
}

// Validate PO doesn't exceed budget
export const purchaseOrderBudgetValidator = z.object({
  project_id: z.string().uuid(),
  committed_amount: z.number()
}).refine(async (data) => {
  const budget = await getProjectBudget(data.project_id)
  const currentSpend = await getCurrentSpend(data.project_id)
  return currentSpend + data.committed_amount <= budget
}, {
  message: 'Purchase order would exceed project budget'
})
```

## Error Handling

### Format Validation Errors

```typescript
// src/lib/validators/error-formatter.ts
import { z } from 'zod'

export function formatZodError(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}
  
  error.errors.forEach((err) => {
    const path = err.path.join('.')
    formatted[path] = err.message
  })
  
  return formatted
}

// Usage
try {
  projectSchema.parse(data)
} catch (error) {
  if (error instanceof z.ZodError) {
    const errors = formatZodError(error)
    // { "job_number": "Job number is required", "contract_value": "Contract value must be positive" }
  }
}
```

## Testing Validation

### Unit Tests

```typescript
// src/lib/schemas/__tests__/project.test.ts
import { projectSchema } from '../project'

describe('Project Schema', () => {
  it('validates valid project data', () => {
    const valid = {
      job_number: 'PRJ-001',
      name: 'Test Project',
      division: 'North',
      client_id: '123e4567-e89b-12d3-a456-426614174000',
      contract_value: 100000,
      status: 'Active',
      project_manager_id: '123e4567-e89b-12d3-a456-426614174000'
    }
    
    expect(() => projectSchema.parse(valid)).not.toThrow()
  })
  
  it('rejects invalid job number format', () => {
    const invalid = {
      job_number: 'prj 001', // lowercase and space
      // ... other fields
    }
    
    expect(() => projectSchema.parse(invalid)).toThrow(/uppercase letters/)
  })
})
```

## Best Practices

1. **Validate at boundaries** - API routes, form submissions, imports
2. **Reuse schemas** - Define once, use everywhere
3. **Compose schemas** - Build complex from simple schemas
4. **Custom messages** - Provide user-friendly error messages
5. **Type inference** - Let Zod infer TypeScript types
6. **Async validation** - Use refinements for database checks
7. **Transform data** - Clean/format during validation
8. **Test schemas** - Unit test validation logic

## Common Patterns

### Optional with Default

```typescript
const schema = z.object({
  status: z.enum(['Active', 'Closed']).default('Active'),
  created_at: z.string().datetime().default(() => new Date().toISOString())
})
```

### Conditional Validation

```typescript
const schema = z.object({
  type: z.enum(['fixed', 'hourly']),
  rate: z.number(),
  hours: z.number().optional()
}).refine((data) => {
  if (data.type === 'hourly' && !data.hours) {
    return false
  }
  return true
}, {
  message: 'Hours required for hourly type',
  path: ['hours']
})
```

### Union Types

```typescript
const notificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email(),
    subject: z.string()
  }),
  z.object({
    type: z.literal('sms'),
    phone: z.string(),
    message: z.string().max(160)
  })
])
```