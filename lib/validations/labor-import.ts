import { z } from 'zod'

// Helper to parse Excel serial date to JavaScript Date
export const parseExcelDate = (serial: number): Date => {
  // Excel serial date starts from Jan 1, 1900
  // Subtract 25569 to convert to Unix timestamp base (Jan 1, 1970)
  // Multiply by 86400 * 1000 to convert days to milliseconds
  return new Date((serial - 25569) * 86400 * 1000)
}

// Helper to format date as YYYY-MM-DD
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Labor import request schema
export const laborImportSchema = z.object({
  project_id: z.string().uuid('Invalid project ID')
})

// Employee actual entry schema for database insertion
export const employeeActualSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  project_id: z.string().uuid('Invalid project ID'),
  week_ending: z.string().datetime({ message: 'Invalid date format' }),
  st_hours: z.number().min(0, 'ST hours must be non-negative'),
  ot_hours: z.number().min(0, 'OT hours must be non-negative'),
  st_wages: z.number().min(0, 'ST wages must be non-negative'),
  ot_wages: z.number().min(0, 'OT wages must be non-negative'),
  daily_hours: z.record(z.string(), z.number()).optional()
})

// New employee creation schema
export const newEmployeeSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  payroll_name: z.string().optional(),
  legal_middle_name: z.string().optional(),
  craft_type_id: z.string().uuid('Invalid craft type ID'),
  base_rate: z.number().min(0, 'Base rate must be non-negative'),
  category: z.enum(['Direct', 'Indirect', 'Staff']),
  class: z.string().optional(),
  job_title_description: z.string().optional(),
  location_code: z.string().optional(),
  location_description: z.string().optional(),
  is_direct: z.boolean().default(true), // Keep for backward compatibility
  is_active: z.boolean().default(true)
})

// Batch employee creation schema
export const batchEmployeeSchema = z.object({
  employees: z.array(newEmployeeSchema).min(1, 'At least one employee is required')
})

// Employee spreadsheet import schema (maps to Excel columns)
export const employeeSpreadsheetRowSchema = z.object({
  'Payroll Name': z.string(),
  'Legal First Name': z.string().min(1, 'First name is required'),
  'Legal Last Name': z.string().min(1, 'Last name is required'),
  'Legal Middle Name': z.string().optional().transform(val => val === '' ? undefined : val),
  'employee_number': z.string().min(1, 'Employee number is required'),
  'Location Code': z.string().optional(),
  'Location Description': z.string().optional(),
  'Pay Grade Code': z.string().optional(),
  'Job Title Description': z.string().optional(),
  'Base_Rate': z.union([z.string(), z.number()]).transform((val) => {
    // Handle currency format like "$40.00"
    if (typeof val === 'string') {
      const cleaned = val.replace(/[$,]/g, '')
      const parsed = parseFloat(cleaned)
      if (isNaN(parsed)) throw new Error('Invalid base rate format')
      return parsed
    }
    return val
  }),
  'Category': z.enum(['Direct', 'Indirect', 'Staff'])
})

// New craft type creation schema
export const newCraftTypeSchema = z.object({
  name: z.string().min(1, 'Craft name is required'),
  code: z.string().min(1, 'Craft code is required'),
  labor_category: z.enum(['direct', 'indirect', 'staff']),
  default_rate: z.number().min(0).optional(),
  is_active: z.boolean().default(true)
})

// Schema for parsed Excel employee row
export const excelEmployeeRowSchema = z.object({
  employeeId: z.string(),
  lastName: z.string(),
  firstName: z.string(),
  mondayHours: z.number().default(0),
  tuesdayHours: z.number().default(0),
  wednesdayHours: z.number().default(0),
  thursdayHours: z.number().default(0),
  fridayHours: z.number().default(0),
  saturdayHours: z.number().default(0),
  sundayHours: z.number().default(0),
  stHours: z.number().default(0),
  otHours: z.number().default(0),
  craftCode: z.string(),
  stRate: z.number().min(0),
  stWages: z.number().min(0),
  otWages: z.number().min(0)
})

// Import result schema
export const laborImportResultSchema = z.object({
  success: z.boolean(),
  imported: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    employeeId: z.string().optional(),
    message: z.string(),
    data: z.unknown().optional()
  })),
  newEmployees: z.array(z.object({
    employee_number: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    craft_code: z.string(),
    base_rate: z.number()
  })).optional(),
  newCrafts: z.array(z.object({
    code: z.string(),
    suggested_name: z.string(),
    default_rate: z.number().optional()
  })).optional(),
  employeeCount: z.number().optional()
})

// Types
export type EmployeeActualData = z.infer<typeof employeeActualSchema>
export type NewEmployeeData = z.infer<typeof newEmployeeSchema>
export type BatchEmployeeData = z.infer<typeof batchEmployeeSchema>
export type NewCraftTypeData = z.infer<typeof newCraftTypeSchema>
export type ExcelEmployeeRow = z.infer<typeof excelEmployeeRowSchema>
export type LaborImportResult = z.infer<typeof laborImportResultSchema>

// Constants for Excel parsing
export const EXCEL_HEADERS = {
  CONTRACTOR_ROW: 4,     // Row 4 contains contractor info
  WEEK_ENDING_ROW: 5,    // Row 5 contains week ending date
  HEADER_ROW: 8,         // Row 8 contains column headers
  DATA_START_ROW: 10     // Row 10 is where actual employee data begins
}

// Updated column indices based on actual Excel structure
export const EXCEL_COLUMNS = {
  EMPLOYEE_ID: 2,    // Column C - T2005
  NAME: 4,           // Column E - "Lachance, Cory" (combined name field)
  MONDAY: 5,         // Column F
  TUESDAY: 6,        // Column G
  WEDNESDAY: 7,      // Column H
  THURSDAY: 8,       // Column I
  FRIDAY: 9,         // Column J
  SATURDAY: 10,      // Column K
  SUNDAY: 11,        // Column L
  ST_HOURS: 12,      // Column M
  OT_HOURS: 13,      // Column N
  CRAFT_CODE: 14,    // Column O
  ST_RATE: 15,       // Column P
  ST_WAGES: 16,      // Column Q
  OT_WAGES: 17,      // Column R
  // Legacy fields for compatibility
  LAST_NAME: 4,      // Same as NAME - will be parsed from combined field
  FIRST_NAME: 4,     // Same as NAME - will be parsed from combined field
  CRAFT: 14          // Alias for CRAFT_CODE
}

// OT multiplier (ignore OT meals)
export const OT_MULTIPLIER = 1.5