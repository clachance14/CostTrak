import { z } from 'zod'
import { endOfWeek, format } from 'date-fns'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper to get Sunday week ending date
export const getWeekEndingDate = (date: Date): Date => {
  return endOfWeek(date, { weekStartsOn: 1 }) // Monday start = Sunday end
}

// Helper to format week ending date
export const formatWeekEnding = (date: Date): string => {
  return format(date, 'MMM dd, yyyy')
}

// Calculate running average rate
export function calculateRunningAverage(rates: number[], weights?: number[]): number {
  if (rates.length === 0) return 0
  
  if (weights && weights.length === rates.length) {
    // Weighted average - more recent weeks have higher weight
    const weightedSum = rates.reduce((sum, rate, i) => sum + rate * weights[i], 0)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0
  } else {
    // Simple average
    const sum = rates.reduce((total, rate) => total + rate, 0)
    return Number((sum / rates.length).toFixed(2))
  }
}

// Labor actual entry schema
export const laborActualSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  craft_type_id: z.string().uuid('Invalid craft type ID'),
  week_ending: z.string().datetime({ message: 'Invalid date format' }),
  total_cost: z.number().min(0, 'Cost must be non-negative'),
  total_hours: z.number().min(0, 'Hours must be non-negative')
})

// Batch weekly actual entry for UI forms
export const weeklyActualFormSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  week_ending: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format')
    .transform((val) => {
      const date = new Date(val)
      return getWeekEndingDate(date).toISOString()
    }),
  entries: z.array(z.object({
    craft_type_id: z.string().uuid(),
    craft_name: z.string().optional(), // For display only
    labor_category: z.enum(['direct', 'indirect', 'staff']).optional(),
    total_cost: z.string()
      .transform((val) => val || '0')
      .refine((val) => {
        const num = parseFloat(val)
        return !isNaN(num) && num >= 0
      }, 'Must be a non-negative number')
      .transform((val) => parseFloat(val)),
    total_hours: z.string()
      .transform((val) => val || '0')
      .refine((val) => {
        const num = parseFloat(val)
        return !isNaN(num) && num >= 0
      }, 'Must be a non-negative number')
      .transform((val) => parseFloat(val))
  }))
})

// Batch weekly actual API schema
export const weeklyActualBatchSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  week_ending: z.string().datetime({ message: 'Invalid date format' }),
  entries: z.array(z.object({
    craft_type_id: z.string().uuid('Invalid craft type ID'),
    total_cost: z.number().min(0, 'Cost must be non-negative'),
    total_hours: z.number().min(0, 'Hours must be non-negative')
  }))
})

// Headcount forecast schema
export const headcountForecastSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  craft_type_id: z.string().uuid('Invalid craft type ID'),
  week_ending: z.string().datetime({ message: 'Invalid date format' }),
  headcount: z.number().int().min(0, 'Headcount must be non-negative'),
  hours_per_person: z.number().min(0, 'Hours must be non-negative').default(50)
})

// Batch headcount forecast entry for UI forms
export const headcountFormSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  weeks: z.array(z.object({
    week_ending: z.string(),
    entries: z.array(z.object({
      craft_type_id: z.string().uuid(),
      craft_name: z.string().optional(), // For display only
      labor_category: z.enum(['direct', 'indirect', 'staff']).optional(),
      headcount: z.string()
        .transform((val) => val || '0')
        .refine((val) => {
          const num = parseInt(val, 10)
          return !isNaN(num) && num >= 0
        }, 'Must be a non-negative integer')
        .transform((val) => parseInt(val, 10)),
      hours_per_person: z.number().min(0).default(50).optional()
    }))
  }))
})

// Batch headcount forecast API schema
export const headcountBatchSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  weeks: z.array(z.object({
    week_ending: z.string().datetime({ message: 'Invalid date format' }),
    entries: z.array(z.object({
      craft_type_id: z.string().uuid('Invalid craft type ID'),
      headcount: z.number().int().min(0, 'Headcount must be non-negative'),
      hours_per_person: z.number().min(0, 'Hours must be non-negative').default(50)
    }))
  }))
})

// Query schemas
export const laborActualQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  project_id: z.string().uuid().optional(),
  craft_type_id: z.string().uuid().optional(),
  week_start: z.string().optional(),
  week_end: z.string().optional(),
  sort_by: z.enum(['week_ending', 'craft_type_id', 'total_cost', 'rate_per_hour']).default('week_ending'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

export const headcountQuerySchema = z.object({
  project_id: z.string().uuid(),
  weeks_ahead: z.string().transform(Number).default('12'),
  start_date: z.string().optional()
})

export const runningAverageQuerySchema = z.object({
  project_id: z.string().uuid(),
  weeks_back: z.string().transform(Number).default('8')
})

// Validate unique actual entry
export async function validateUniqueActual(
  supabase: SupabaseClient,
  projectId: string,
  craftTypeId: string,
  weekEnding: string,
  excludeId?: string
) {
  const query = supabase
    .from('labor_actuals')
    .select('id')
    .eq('project_id', projectId)
    .eq('craft_type_id', craftTypeId)
    .eq('week_ending', weekEnding)

  if (excludeId) {
    query.neq('id', excludeId)
  }

  const { data, error } = await query.single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error
  }

  return {
    valid: !data,
    message: data ? 'An entry already exists for this week and craft type' : undefined
  }
}

// Get running average rate for project/craft combination
export async function getRunningAverageRate(
  supabase: SupabaseClient,
  projectId: string,
  craftTypeId: string,
  weeks: number = 8
): Promise<number> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - weeks * 7)
  
  const { data } = await supabase
    .from('labor_actuals')
    .select('rate_per_hour, week_ending')
    .eq('project_id', projectId)
    .eq('craft_type_id', craftTypeId)
    .gte('week_ending', startDate.toISOString())
    .gt('total_hours', 0)
    .order('week_ending', { ascending: false })

  if (!data || data.length === 0) return 0

  // Simple average for now - could add weighted average later
  const rates = data.map((d: { rate_per_hour: number }) => d.rate_per_hour)
  return calculateRunningAverage(rates)
}

// Get all running averages for a project
export async function getProjectRunningAverages(
  supabase: SupabaseClient,
  projectId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('labor_running_averages')
    .select('craft_type_id, avg_rate')
    .eq('project_id', projectId)

  if (error) throw error

  const averageMap = new Map<string, number>()
  data?.forEach((row: { craft_type_id: string; avg_rate: number }) => {
    averageMap.set(row.craft_type_id, row.avg_rate)
  })

  return averageMap
}

// Type exports
export type LaborActualData = z.infer<typeof laborActualSchema>
export type WeeklyActualFormData = z.infer<typeof weeklyActualFormSchema>
export type WeeklyActualBatchData = z.infer<typeof weeklyActualBatchSchema>
export type HeadcountForecastData = z.infer<typeof headcountForecastSchema>
export type HeadcountFormData = z.infer<typeof headcountFormSchema>
export type HeadcountBatchData = z.infer<typeof headcountBatchSchema>
export type LaborActualQuery = z.infer<typeof laborActualQuerySchema>
export type HeadcountQuery = z.infer<typeof headcountQuerySchema>