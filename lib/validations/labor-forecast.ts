import { z } from 'zod'
import { endOfWeek, format } from 'date-fns'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper to get Sunday week ending date
export const getWeekEndingDate = (date: Date): Date => {
  return endOfWeek(date, { weekStartsOn: 1 }) // Monday start = Sunday end
}

// Helper to format week ending date
export const formatWeekEnding = (date: Date): string => {
  return format(getWeekEndingDate(date), 'yyyy-MM-dd')
}

// Form validation schema (for UI input)
export const laborForecastFormSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  craft_type_id: z.string().uuid('Please select a craft type'),
  week_ending: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format')
    .transform((val) => {
      const date = new Date(val)
      return formatWeekEnding(date) // Ensure it's always a Sunday
    }),
  forecasted_hours: z.string()
    .min(1, 'Forecasted hours is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0
    }, 'Must be a non-negative number')
    .transform((val) => parseFloat(val)),
  forecasted_rate: z.string()
    .min(1, 'Forecasted rate is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0
    }, 'Must be a non-negative number')
    .transform((val) => parseFloat(val)),
  actual_hours: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0
    }, 'Must be a non-negative number')
    .transform((val) => parseFloat(val)),
  actual_cost: z.string()
    .optional()
    .transform((val) => val || '0')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0
    }, 'Must be a non-negative number')
    .transform((val) => parseFloat(val))
})

// API schema (with proper types)
export const laborForecastApiSchema = z.object({
  project_id: z.string().uuid(),
  craft_type_id: z.string().uuid(),
  week_ending: z.string().datetime(),
  forecasted_hours: z.number().min(0),
  forecasted_rate: z.number().min(0),
  forecasted_cost: z.number().min(0).optional(), // Calculated server-side
  actual_hours: z.number().min(0).default(0),
  actual_cost: z.number().min(0).default(0)
})

// Update schema (for PATCH requests)
export const laborForecastUpdateSchema = z.object({
  forecasted_hours: z.number().min(0).optional(),
  forecasted_rate: z.number().min(0).optional(),
  actual_hours: z.number().min(0).optional(),
  actual_cost: z.number().min(0).optional()
})

// Weekly batch entry schema
export const weeklyLaborEntrySchema = z.object({
  project_id: z.string().uuid(),
  week_ending: z.string().datetime(),
  entries: z.array(z.object({
    craft_type_id: z.string().uuid(),
    forecasted_hours: z.number().min(0),
    forecasted_rate: z.number().min(0),
    actual_hours: z.number().min(0).optional(),
    actual_cost: z.number().min(0).optional()
  }))
})

// CSV import schema
export const laborForecastCsvRowSchema = z.object({
  project_job_number: z.string().min(1),
  craft_type_code: z.string().min(1),
  week_ending: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  forecasted_hours: z.number().min(0),
  forecasted_rate: z.number().min(0),
  actual_hours: z.number().min(0).optional(),
  actual_cost: z.number().min(0).optional()
})

// Query parameters schema
export const laborForecastQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  project_id: z.string().uuid().optional(),
  craft_type_id: z.string().uuid().optional(),
  week_start: z.string().optional(),
  week_end: z.string().optional(),
  has_variance: z.string().transform((val) => val === 'true').optional(),
  sort_by: z.enum(['week_ending', 'craft_type', 'variance', 'created_at']).default('week_ending'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

// Business rule validations
export const calculateForecastedCost = (hours: number, rate: number): number => {
  return Math.round(hours * rate * 100) / 100 // Round to 2 decimal places
}

export const calculateVariance = (
  forecasted: number, 
  actual: number
): { amount: number; percentage: number; exceeds_threshold: boolean } => {
  const amount = actual - forecasted
  const percentage = forecasted > 0 ? (amount / forecasted) * 100 : 0
  const exceeds_threshold = percentage > 10 // 10% threshold
  
  return {
    amount: Math.round(amount * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    exceeds_threshold
  }
}

// Validate unique constraint (one record per project/craft/week)
export const validateUniqueEntry = async (
  supabase: SupabaseClient,
  projectId: string,
  craftTypeId: string,
  weekEnding: string,
  excludeId?: string
): Promise<{ valid: boolean; message?: string }> => {
  const query = supabase
    .from('labor_forecasts')
    .select('id')
    .eq('project_id', projectId)
    .eq('craft_type_id', craftTypeId)
    .eq('week_ending', weekEnding)
    .is('deleted_at', null)

  if (excludeId) {
    query.neq('id', excludeId)
  }

  const { data, error } = await query.single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error
  }

  if (data) {
    return {
      valid: false,
      message: 'A forecast already exists for this project, craft type, and week'
    }
  }

  return { valid: true }
}

// Get default rate for project/craft combination
export const getProjectCraftRate = async (
  supabase: SupabaseClient,
  projectId: string,
  craftTypeId: string
): Promise<number | null> => {
  // First, try to get the most recent rate for this project/craft
  const { data } = await supabase
    .from('labor_forecasts')
    .select('forecasted_rate')
    .eq('project_id', projectId)
    .eq('craft_type_id', craftTypeId)
    .is('deleted_at', null)
    .order('week_ending', { ascending: false })
    .limit(1)
    .single()

  return data?.forecasted_rate || null
}

// Type exports
export type LaborForecastFormData = z.infer<typeof laborForecastFormSchema>
export type LaborForecastApiData = z.infer<typeof laborForecastApiSchema>
export type LaborForecastUpdateData = z.infer<typeof laborForecastUpdateSchema>
export type WeeklyLaborEntry = z.infer<typeof weeklyLaborEntrySchema>
export type LaborForecastCsvRow = z.infer<typeof laborForecastCsvRowSchema>
export type LaborForecastQuery = z.infer<typeof laborForecastQuerySchema>