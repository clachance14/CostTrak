import { z } from 'zod'

// Status enum matching database
export const changeOrderStatuses = ['draft', 'pending', 'approved', 'rejected', 'cancelled'] as const
export type ChangeOrderStatus = typeof changeOrderStatuses[number]

// Pricing type enum
export const pricingTypes = ['LS', 'T&M', 'Estimate', 'Credit'] as const
export type PricingType = typeof pricingTypes[number]

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
  status: z.enum(changeOrderStatuses).default('pending'),
  pricing_type: z.enum(pricingTypes).default('LS'),
  reason: z.string().optional(),
  manhours: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive number'),
  labor_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount'),
  equipment_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount'),
  material_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount'),
  subcontract_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount'),
  markup_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount'),
  tax_amount: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val.replace(/,/g, ''))
      return !isNaN(num) && num >= 0
    }, 'Must be a valid positive amount')
}).refine((data) => {
  // Allow zero amounts only for Credit type change orders
  const amount = parseFloat(data.amount)
  if (amount === 0 && data.pricing_type !== 'Credit') {
    return false
  }
  return true
}, {
  message: 'Amount cannot be zero unless pricing type is Credit',
  path: ['amount']
})

// API schema (with proper types)
export const changeOrderApiSchema = z.object({
  project_id: z.string().uuid(),
  co_number: z.string().min(1).max(50),
  description: z.string().min(10).max(500),
  amount: z.number(),
  impact_schedule_days: z.number().int().default(0),
  submitted_date: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true
      // Accept both date (YYYY-MM-DD) and datetime formats
      return !isNaN(Date.parse(val))
    }, 'Invalid date format')
    .transform((val) => {
      if (!val) return undefined
      // If it's a date without time, convert to ISO datetime
      const date = new Date(val)
      return date.toISOString()
    }),
  status: z.enum(changeOrderStatuses).default('pending'),
  pricing_type: z.enum(pricingTypes),
  reason: z.string().optional(),
  manhours: z.number().min(0).default(0),
  labor_amount: z.number().min(0).default(0),
  equipment_amount: z.number().min(0).default(0),
  material_amount: z.number().min(0).default(0),
  subcontract_amount: z.number().min(0).default(0),
  markup_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0)
}).refine((data) => {
  // Allow zero amounts only for Credit type change orders
  if (data.amount === 0 && data.pricing_type !== 'Credit') {
    return false
  }
  return true
}, {
  message: 'Amount cannot be zero unless pricing type is Credit',
  path: ['amount']
})

// Update schema (for PATCH requests)
export const changeOrderUpdateSchema = z.object({
  description: z.string().min(10).max(500).optional(),
  amount: z.number().optional(),
  impact_schedule_days: z.number().int().optional(),
  submitted_date: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true
      // Accept both date (YYYY-MM-DD) and datetime formats
      return !isNaN(Date.parse(val))
    }, 'Invalid date format')
    .transform((val) => {
      if (!val) return undefined
      // If it's a date without time, convert to ISO datetime
      const date = new Date(val)
      return date.toISOString()
    }),
  status: z.enum(changeOrderStatuses).optional(),
  pricing_type: z.enum(pricingTypes).optional(),
  reason: z.string().optional(),
  manhours: z.number().min(0).optional(),
  labor_amount: z.number().min(0).optional(),
  equipment_amount: z.number().min(0).optional(),
  material_amount: z.number().min(0).optional(),
  subcontract_amount: z.number().min(0).optional(),
  markup_amount: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional()
}).refine((data) => {
  // Allow zero amounts only for Credit type change orders
  if (data.amount !== undefined && data.amount === 0 && data.pricing_type !== 'Credit') {
    return false
  }
  return true
}, {
  message: 'Amount cannot be zero unless pricing type is Credit',
  path: ['amount']
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
    draft: ['pending', 'cancelled'],
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

// Attachment schema
export const changeOrderAttachmentSchema = z.object({
  file: z.instanceof(File).refine((file) => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB'),
  change_order_id: z.string().uuid()
})

// Helper to validate file types
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export const validateFileType = (file: File): boolean => {
  return ALLOWED_FILE_TYPES.includes(file.type)
}

// Type exports
export type ChangeOrderFormData = z.infer<typeof changeOrderFormSchema>
export type ChangeOrderApiData = z.infer<typeof changeOrderApiSchema>
export type ChangeOrderUpdateData = z.infer<typeof changeOrderUpdateSchema>
export type ChangeOrderCsvRow = z.infer<typeof changeOrderCsvRowSchema>
export type ChangeOrderQuery = z.infer<typeof changeOrderQuerySchema>
export type ChangeOrderAction = z.infer<typeof changeOrderActionSchema>
export type ChangeOrderAttachment = z.infer<typeof changeOrderAttachmentSchema>