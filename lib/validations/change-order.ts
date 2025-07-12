import { z } from 'zod'

// Status enum matching database
export const changeOrderStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type ChangeOrderStatus = typeof changeOrderStatuses[number]

// Base change order schema (for forms)
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

// API schema (with proper types)
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

// Update schema (for PATCH requests)
export const changeOrderUpdateSchema = z.object({
  description: z.string().min(10).max(500).optional(),
  amount: z.number()
    .refine((val) => val !== 0, 'Amount cannot be zero')
    .optional(),
  impact_schedule_days: z.number().int().optional(),
  submitted_date: z.string().datetime().optional(),
  status: z.enum(changeOrderStatuses).optional()
})

// CSV import schema
export const changeOrderCsvRowSchema = z.object({
  project_job_number: z.string().min(1),
  co_number: z.string().min(1),
  description: z.string().min(10),
  amount: z.number(),
  impact_schedule_days: z.number().int().default(0),
  status: z.enum(changeOrderStatuses).default('pending'),
  submitted_date: z.string().optional()
})

// Query parameters schema
export const changeOrderQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  project_id: z.string().uuid().optional(),
  status: z.enum(changeOrderStatuses).optional(),
  search: z.string().optional(),
  sort_by: z.enum(['co_number', 'amount', 'submitted_date', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

// Approval/rejection schema
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

// Validate status transitions
export const validateStatusTransition = (
  currentStatus: ChangeOrderStatus,
  newStatus: ChangeOrderStatus,
  userRole: string
): { valid: boolean; message?: string } => {
  // Only certain transitions are allowed
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

  // Role-based restrictions
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

// Helper to generate next CO number
export const generateCoNumber = (existingNumbers: string[]): string => {
  if (existingNumbers.length === 0) {
    return 'CO-001'
  }

  // Extract numbers and find the highest
  const numbers = existingNumbers
    .map(num => {
      const match = num.match(/CO-(\d+)/)
      return match ? parseInt(match[1]) : 0
    })
    .filter(num => num > 0)

  const nextNumber = Math.max(...numbers, 0) + 1
  return `CO-${nextNumber.toString().padStart(3, '0')}`
}

// Type exports
export type ChangeOrderFormData = z.infer<typeof changeOrderFormSchema>
export type ChangeOrderApiData = z.infer<typeof changeOrderApiSchema>
export type ChangeOrderUpdateData = z.infer<typeof changeOrderUpdateSchema>
export type ChangeOrderCsvRow = z.infer<typeof changeOrderCsvRowSchema>
export type ChangeOrderQuery = z.infer<typeof changeOrderQuerySchema>
export type ChangeOrderAction = z.infer<typeof changeOrderActionSchema>