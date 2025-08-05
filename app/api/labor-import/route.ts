import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import {
  laborImportSchema,
  parseExcelDate,
  EXCEL_COLUMNS,
  type LaborImportResult
} from '@/lib/validations/labor-import'

export const dynamic = 'force-dynamic'

// Helper to generate a simple hash for duplicate detection
async function generateFileHash(buffer: Buffer): Promise<string> {
  // Convert buffer to string for hashing
  const text = buffer.toString('base64')
  
  // Use a simple hash function for duplicate detection
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Helper to parse numeric value from Excel cell
function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Helper to parse string value from Excel cell
function parseStringValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

// Helper to parse employee name with suffix handling
function parseEmployeeName(nameField: string): { firstName: string; lastName: string } {
  const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV']
  let cleanedName = nameField.trim()
  
  // Remove suffix if present
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\s+${suffix.replace('.', '\\.')}$`, 'i')
    cleanedName = cleanedName.replace(regex, '')
  })
  
  // Parse name based on format
  if (cleanedName.includes(',')) {
    // Format: "LastName, FirstName"
    const parts = cleanedName.split(',').map(p => p.trim())
    return {
      lastName: parts[0] || 'Unknown',
      firstName: parts[1] || 'Unknown'
    }
  } else {
    // Format: "FirstName LastName"
    const parts = cleanedName.split(' ')
    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: parts[0] // Use same as first if only one name
      }
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    }
  }
}

// Craft code to category mapping
const CRAFT_CODE_CATEGORY_MAP: Record<string, string> = {
  'STA': 'staff',
  'STAFF': 'staff',
  'IND': 'indirect',
  'INDIRECT': 'indirect',
  'DIR': 'direct',
  'DIRECT': 'direct'
}

// Helper to infer category from craft code
function inferCategoryFromCraftCode(craftCode: string): string {
  const upperCode = craftCode.toUpperCase()
  
  // Check exact matches first
  if (CRAFT_CODE_CATEGORY_MAP[upperCode]) {
    return CRAFT_CODE_CATEGORY_MAP[upperCode]
  }
  
  // Check if code starts with known prefixes
  for (const [prefix, category] of Object.entries(CRAFT_CODE_CATEGORY_MAP)) {
    if (upperCode.startsWith(prefix)) {
      return category
    }
  }
  
  // Default to direct
  return 'direct'
}

// Helper to track failed import attempts
async function trackFailedImport(
  adminSupabase: ReturnType<typeof createAdminClient>,
  projectId: string | null,
  userId: string | null,
  fileName: string | null,
  errorMessage: string,
  metadata?: Record<string, unknown>
) {
  if (!projectId || !userId || !fileName) return
  
  try {
    await adminSupabase
      .from('data_imports')
      .insert({
        project_id: projectId,
        import_type: 'labor',
        import_status: 'failed',
        imported_by: userId,
        file_name: fileName,
        records_processed: 0,
        records_failed: 0,
        error_message: errorMessage,
        metadata: metadata || {}
      })
  } catch (error) {
    console.error('Error tracking failed import:', error)
  }
}

// POST /api/labor-import - Import labor cost Excel file
export async function POST(request: NextRequest) {
  let adminSupabase: ReturnType<typeof createAdminClient> | undefined
  let projectId: string | null = null
  let user: any
  let file: File | null = null
  let weekEndingISO: string | undefined
  let fileHash: string | undefined
  
  try {
    const supabase = await createClient()
    adminSupabase = createAdminClient()

    // Check authentication
    const { data: { user: authUser } } = await supabase.auth.getUser()
    user = authUser
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role (keeping existing permissions - all authenticated users can import)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Check permissions (keeping existing allowed roles)
    const allowedRoles = ['controller', 'ops_manager', 'project_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to import labor data' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    file = formData.get('file') as File
    projectId = formData.get('project_id') as string | null
    const forceRefresh = formData.get('force_refresh') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // If force refresh is requested, add a small delay to ensure database consistency
    if (forceRefresh) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Read Excel file first to potentially auto-match project
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Calculate file hash for duplicate detection
    fileHash = await generateFileHash(buffer)

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, dateNF: 'yyyy-mm-dd' })
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse Excel file. Please ensure it is a valid .xlsx file.' },
        { status: 400 }
      )
    }

    // Get the DOW sheet
    const sheetName = 'DOW'
    if (!workbook.SheetNames.includes(sheetName)) {
      return NextResponse.json(
        { error: `Sheet "${sheetName}" not found in Excel file` },
        { status: 400 }
      )
    }

    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: true,
      defval: ''
    }) as unknown[][]

    if (rawData.length < 9) { // Need at least 9 rows (data starts at row 9)
      return NextResponse.json(
        { error: 'Invalid Excel format. File does not have enough rows.' },
        { status: 400 }
      )
    }

    // Validate headers (row 8, 0-indexed = row 7)
    const headerRow = rawData[7]
    if (!headerRow || parseStringValue(headerRow[4]) !== 'Name' || parseStringValue(headerRow[12]) !== 'StHours') {
      return NextResponse.json(
        { error: 'Invalid Excel format. Header row does not match expected format.' },
        { status: 400 }
      )
    }

    // Extract contractor number and try to match project if no project_id provided
    const contractorRow = rawData[3] // Row 4 (0-indexed)
    const contractorNumber = parseStringValue(contractorRow[4]) // "5772 LS DOW" at index 4
    
    // Extract job number from contractor string (e.g., "5772 LS DOW" -> "5772")
    const jobNumberMatch = contractorNumber.match(/^(\d+)/)
    const fileJobNumber = jobNumberMatch ? jobNumberMatch[1] : ''
    
    console.log('Labor Import Debug:', {
      contractorNumber,
      fileJobNumber,
      projectIdFromForm: projectId
    })

    // If no project_id provided, try to auto-match by job number
    if (!projectId && fileJobNumber) {
      // First, let's see what projects exist
      const { data: allProjects } = await supabase
        .from('projects')
        .select('id, job_number, name')
        .is('deleted_at', null)
        .limit(10)
      
      console.log('Available projects:', allProjects?.map(p => ({ 
        id: p.id, 
        job_number: p.job_number, 
        name: p.name 
      })))
      
      const { data: matchedProject } = await supabase
        .from('projects')
        .select('id, job_number, name, project_manager_id')
        .eq('job_number', fileJobNumber)
        .is('deleted_at', null)
        .single()
      
      if (matchedProject) {
        projectId = matchedProject.id
        console.log('Auto-matched project:', {
          projectId: matchedProject.id,
          jobNumber: matchedProject.job_number,
          name: matchedProject.name
        })
      } else {
        console.log('No project found for job number:', fileJobNumber)
        return NextResponse.json(
          { error: `No project found with job number ${fileJobNumber}. Please select a project manually.` },
          { status: 400 }
        )
      }
    }

    // Validate project ID if we have one now
    if (!projectId) {
      return NextResponse.json(
        { error: 'No project specified and could not auto-match from file' },
        { status: 400 }
      )
    }

    const validatedData = laborImportSchema.parse({ project_id: projectId })

    console.log('Querying project with ID:', validatedData.project_id)

    // Check project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, name, project_manager_id')
      .eq('id', validatedData.project_id)
      .is('deleted_at', null)
      .single()

    console.log('Project query result:', { 
      project, 
      error: projectError,
      projectId: validatedData.project_id 
    })

    if (!project) {
      console.error('Project not found for ID:', validatedData.project_id)
      return NextResponse.json({ 
        error: 'Project not found',
        details: `No project found with ID: ${validatedData.project_id}` 
      }, { status: 404 })
    }

    // Validate job number matches if provided
    if (fileJobNumber && fileJobNumber !== project.job_number) {
      await trackFailedImport(
        adminSupabase,
        project.id,
        user.id,
        file.name,
        `Job number mismatch. File contains data for job ${fileJobNumber}, but selected project is ${project.job_number}`,
        {
          file_job_number: fileJobNumber,
          project_job_number: project.job_number,
          contractor_number: contractorNumber
        }
      )
      return NextResponse.json(
        { 
          error: `Job number mismatch. File contains data for job ${fileJobNumber}, but selected project is ${project.job_number}`,
          warning: 'Please select the correct project or verify the file.'
        },
        { status: 400 }
      )
    }

    // Access control simplified - all authenticated users can access all projects
    // Per CLAUDE.md: "All users have 'project_manager' role" and "All users see all projects"
    console.log('Access control passed - simplified permissions model')

    // Extract week ending date
    const weekEndingRow = rawData[4] // Row 5 (0-indexed)
    const weekEndingSerial = parseNumericValue(weekEndingRow[4])
    
    if (!weekEndingSerial) {
      return NextResponse.json(
        { error: 'Invalid week ending date in Excel file' },
        { status: 400 }
      )
    }

    const weekEndingDate = parseExcelDate(weekEndingSerial)
    weekEndingISO = weekEndingDate.toISOString().split('T')[0] // Use date only
    
    // Check for duplicate import
    if (fileHash) {
      const { data: existingImport } = await adminSupabase
        .from('data_imports')
        .select('id, created_at')
        .eq('project_id', project.id)
        .eq('import_type', 'labor')
        .eq('import_status', 'success')
        .eq('metadata->>file_hash', fileHash)
        .eq('metadata->>week_ending', weekEndingISO)
        .single()
      
      if (existingImport) {
        return NextResponse.json(
          { 
            error: 'Duplicate import detected',
            message: `This file was already imported on ${new Date(existingImport.created_at).toLocaleString()}`,
            import_id: existingImport.id
          },
          { status: 400 }
        )
      }
    }

    // Get all default craft types for each category
    const { data: defaultCraftTypes, error: fetchError } = await adminSupabase
      .from('craft_types')
      .select('id, code, name, category')
      .in('code', ['DIRECT', 'INDIRECT', 'STAFF'])
    
    if (fetchError || !defaultCraftTypes || defaultCraftTypes.length !== 3) {
      console.error('Error fetching default craft types:', fetchError)
      return NextResponse.json(
        { error: 'Default labor categories not found. Please contact support.' },
        { status: 500 }
      )
    }
    
    // Create a map of category to craft type ID
    const categoryToCraftTypeId: Record<string, string> = {}
    defaultCraftTypes.forEach(ct => {
      categoryToCraftTypeId[ct.category] = ct.id
    })
    
    console.log('Default craft types loaded:', Object.keys(categoryToCraftTypeId).join(', '))

    // Initialize result tracking
    const result: LaborImportResult = {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      employeeCount: 0
    }

    // Initialize totals for aggregation by category
    const categoryTotals: Record<string, {
      stHours: number
      otHours: number
      stWages: number
      otWages: number
      employeeCount: number
      employeeIds: Set<string>
    }> = {
      direct: { stHours: 0, otHours: 0, stWages: 0, otWages: 0, employeeCount: 0, employeeIds: new Set() },
      indirect: { stHours: 0, otHours: 0, stWages: 0, otWages: 0, employeeCount: 0, employeeIds: new Set() },
      staff: { stHours: 0, otHours: 0, stWages: 0, otWages: 0, employeeCount: 0, employeeIds: new Set() }
    }
    let totalEmployeeCount = 0

    // Batch fetch all employees upfront for performance
    const employeeIds = rawData.slice(9)
      .map(row => parseStringValue(row[EXCEL_COLUMNS.EMPLOYEE_ID]))
      .filter(id => /^T\d+$/.test(id))
    
    const { data: existingEmployees } = await adminSupabase
      .from('employees')
      .select('id, employee_number, first_name, last_name, base_rate, category, craft_type_id')
      .in('employee_number', employeeIds)
    
    type EmployeeRecord = {
      id: string
      employee_number: string
      first_name: string
      last_name: string
      base_rate: number
      category: string
      craft_type_id: string
    }
    
    const employeeMap = new Map<string, EmployeeRecord>(
      existingEmployees?.map(e => [e.employee_number, e as EmployeeRecord]) || []
    )
    
    // Arrays to collect batch operations
    const newEmployeesToCreate: any[] = []
    const laborRecordsToUpsert: any[] = []
    const craftCodeWarnings: string[] = []
    
    // Track new employees created
    let newEmployeesCreated = 0
    let zeroRateEmployees = 0

    // Process employee data rows
    for (let i = 9; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = i + 1

      // Skip empty rows or rows without valid employee ID
      const employeeIdCell = parseStringValue(row[EXCEL_COLUMNS.EMPLOYEE_ID])
      
      // Stop if we hit the Grand Totals row
      if (employeeIdCell === 'Grand Totals' || employeeIdCell.toLowerCase().includes('total')) {
        break
      }
      
      // Check if employee ID matches pattern T\d+
      if (!employeeIdCell || !/^T\d+$/.test(employeeIdCell)) {
        continue
      }

      try {
        // Get employee data from the row
        const employeeName = parseStringValue(row[EXCEL_COLUMNS.NAME])
        const craftCode = parseStringValue(row[EXCEL_COLUMNS.CRAFT])
        const stHours = parseNumericValue(row[EXCEL_COLUMNS.ST_HOURS])
        const otHours = parseNumericValue(row[EXCEL_COLUMNS.OT_HOURS])
        
        // Skip rows with 0 hours
        if (stHours === 0 && otHours === 0) {
          result.skipped++
          continue
        }
        
        // Log craft code warning if present
        if (craftCode) {
          craftCodeWarnings.push(`Row ${rowNumber}: Employee ${employeeIdCell} has craft code '${craftCode}' - review for category assignment`)
        }

        // Parse daily hours and validate
        const dailyHours: Record<string, number> = {}
        const dayColumns = [
          { day: 'monday', index: EXCEL_COLUMNS.MONDAY },
          { day: 'tuesday', index: EXCEL_COLUMNS.TUESDAY },
          { day: 'wednesday', index: EXCEL_COLUMNS.WEDNESDAY },
          { day: 'thursday', index: EXCEL_COLUMNS.THURSDAY },
          { day: 'friday', index: EXCEL_COLUMNS.FRIDAY },
          { day: 'saturday', index: EXCEL_COLUMNS.SATURDAY },
          { day: 'sunday', index: EXCEL_COLUMNS.SUNDAY }
        ]
        
        for (const { day, index } of dayColumns) {
          const hours = parseNumericValue(row[index])
          if (hours > 0) {
            if (hours > 16) {
              result.errors.push({
                row: rowNumber,
                message: `Daily hours exceed 16-hour limit: ${hours} hours on ${day}`,
                data: { employee_number: employeeIdCell, day, hours }
              })
              throw new Error('Daily hours validation failed')
            }
            dailyHours[day] = hours
          }
        }

        // Check if employee exists in our map
        const existingEmployee = employeeMap.get(employeeIdCell)
        
        const employeeId = existingEmployee?.id
        const employeeBaseRate = existingEmployee?.base_rate || 0
        let employeeCategory = existingEmployee?.category?.toLowerCase() || 'direct'
        
        if (!existingEmployee) {
          // Employee doesn't exist, create placeholder
          if (!employeeName) {
            result.errors.push({
              row: rowNumber,
              message: 'Cannot create employee without name',
              data: { employee_number: employeeIdCell }
            })
            result.skipped++
            continue
          }
          
          console.log(`Creating new employee: ${employeeIdCell} - ${employeeName}`)
          
          // Parse employee name with enhanced suffix handling
          const { firstName, lastName } = parseEmployeeName(employeeName)
          
          // Infer category from craft code if present
          if (craftCode) {
            employeeCategory = inferCategoryFromCraftCode(craftCode)
          }
          
          const newEmployee = {
            employee_number: employeeIdCell,
            first_name: firstName,
            last_name: lastName,
            craft_type_id: categoryToCraftTypeId[employeeCategory],
            base_rate: 0, // Always 0 for new employees per requirements
            category: employeeCategory.charAt(0).toUpperCase() + employeeCategory.slice(1), // Capitalize
            is_direct: employeeCategory === 'direct',
            is_active: true
          }
          
          newEmployeesToCreate.push(newEmployee)
          newEmployeesCreated++
          
          // Skip wage calculations since base_rate is 0
          zeroRateEmployees++
          result.errors.push({
            row: rowNumber,
            message: 'New employee created with base_rate=0, wages not calculated',
            data: { employee_number: employeeIdCell, name: employeeName }
          })
          continue
        }
        
        // Check for zero base rate
        if (employeeBaseRate === 0) {
          zeroRateEmployees++
          result.errors.push({
            row: rowNumber,
            message: 'Employee has base_rate=0, skipping wage calculations',
            data: { employee_number: employeeIdCell }
          })
          continue
        }
        
        // Calculate wages using employee base rate
        const stWages = stHours * employeeBaseRate
        const otWages = otHours * employeeBaseRate * 1.5 // 1.5x for overtime
        
        // Prepare labor record for batch upsert
        laborRecordsToUpsert.push({
          employee_id: employeeId,
          employee_number: employeeIdCell, // Add employee number for reference
          project_id: project.id,
          week_ending: weekEndingISO,
          st_hours: stHours,
          ot_hours: otHours,
          st_wages: stWages,
          ot_wages: otWages,
          daily_hours: Object.keys(dailyHours).length > 0 ? dailyHours : null
        })
        
        // Track for aggregation (will be added after successful DB write)
        totalEmployeeCount++

      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Failed to parse row',
          data: row
        })
        result.skipped++
      }
    }

    // Batch create new employees if any
    if (newEmployeesToCreate.length > 0) {
      const { data: createdEmployees, error: createError } = await adminSupabase
        .from('employees')
        .insert(newEmployeesToCreate)
        .select('id, employee_number, base_rate, category')
      
      if (createError) {
        console.error('Failed to create employees:', createError)
        result.errors.push({
          row: 0,
          message: `Failed to create ${newEmployeesToCreate.length} employees: ${createError.message}`
        })
      } else if (createdEmployees) {
        // Add created employees to our map
        createdEmployees.forEach(emp => {
          employeeMap.set(emp.employee_number, emp)
        })
        
        // Log each new employee in audit
        for (const emp of createdEmployees) {
          await adminSupabase.from('audit_log').insert({
            user_id: user.id,
            action: 'create',
            entity_type: 'employee',
            entity_id: emp.id,
            changes: {
              source: 'labor_import',
              employee_number: emp.employee_number,
              created_during_import: true
            }
          }).catch(err => console.error('Audit log error:', err))
        }
      }
    }

    // Batch upsert labor records
    if (laborRecordsToUpsert.length > 0) {
      // Process in chunks to avoid query size limits
      const chunkSize = 100
      for (let i = 0; i < laborRecordsToUpsert.length; i += chunkSize) {
        const chunk = laborRecordsToUpsert.slice(i, i + chunkSize)
        
        // First, check which records exist
        const employeeIds = chunk.map(r => r.employee_id).filter(Boolean)
        const { data: existingRecords } = await adminSupabase
          .from('labor_employee_actuals')
          .select('id, employee_id')
          .in('employee_id', employeeIds)
          .eq('project_id', project.id)
          .eq('week_ending', weekEndingISO)
        
        const existingMap = new Map(existingRecords?.map(r => [r.employee_id, r.id]) || [])
        
        // Separate updates and inserts
        const toUpdate = chunk.filter(r => r.employee_id && existingMap.has(r.employee_id))
        const toInsert = chunk.filter(r => r.employee_id && !existingMap.has(r.employee_id))
        
        // Perform updates
        for (const record of toUpdate) {
          const { error } = await adminSupabase
            .from('labor_employee_actuals')
            .update({
              st_hours: record.st_hours,
              ot_hours: record.ot_hours,
              st_wages: record.st_wages,
              ot_wages: record.ot_wages,
              daily_hours: record.daily_hours,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMap.get(record.employee_id))
          
          if (!error) {
            result.updated++
            
            // Add to aggregation totals after successful write
            const recordWithNumber = toUpdate.find(r => r.employee_id === record.employee_id)
            if (recordWithNumber && recordWithNumber.employee_number) {
              const emp = employeeMap.get(recordWithNumber.employee_number)
              if (emp && emp.base_rate > 0) {
                const category = emp.category.toLowerCase()
                if (categoryTotals[category]) {
                  categoryTotals[category].stHours += record.st_hours
                  categoryTotals[category].otHours += record.ot_hours
                  categoryTotals[category].stWages += record.st_wages
                  categoryTotals[category].otWages += record.ot_wages
                  categoryTotals[category].employeeIds.add(recordWithNumber.employee_number)
                }
              }
            }
          }
        }
        
        // Perform inserts
        if (toInsert.length > 0) {
          // Remove employee_number from records before inserting
          const recordsToInsert = toInsert.map(({ employee_number, ...record }) => record)
          const { data: inserted, error } = await adminSupabase
            .from('labor_employee_actuals')
            .insert(recordsToInsert)
            .select('employee_id')
          
          if (!error && inserted) {
            result.imported += inserted.length
            
            // Add to aggregation totals after successful write
            inserted.forEach(rec => {
              const record = toInsert.find(r => r.employee_id === rec.employee_id)
              if (record && record.employee_number) {
                const emp = employeeMap.get(record.employee_number)
                if (emp && emp.base_rate > 0) {
                  const category = emp.category.toLowerCase()
                  if (categoryTotals[category]) {
                    categoryTotals[category].stHours += record.st_hours
                    categoryTotals[category].otHours += record.ot_hours
                    categoryTotals[category].stWages += record.st_wages
                    categoryTotals[category].otWages += record.ot_wages
                    categoryTotals[category].employeeIds.add(record.employee_number)
                  }
                }
              }
            })
          }
        }
      }
    }

    // Add new employees created to result
    if (newEmployeesCreated > 0) {
      console.log(`Created ${newEmployeesCreated} new employees during import`)
      ;(result as any).newEmployeesCreated = newEmployeesCreated
    }
    
    // Add zero rate warning
    if (zeroRateEmployees > 0) {
      ;(result as any).zeroRateEmployees = zeroRateEmployees
    }

    // Import aggregated labor actuals by category
    if (result.imported > 0 || result.updated > 0) {
      for (const [category, totals] of Object.entries(categoryTotals)) {
        if (totals.employeeIds.size === 0) continue
        
        totals.employeeCount = totals.employeeIds.size
        const totalHours = totals.stHours + totals.otHours
        const totalCost = totals.stWages + totals.otWages
        
        // Calculate burden on straight time wages only (28% default)
        const burdenRate = 0.28
        const burdenAmount = totals.stWages * burdenRate
        const totalCostWithBurden = totalCost + burdenAmount
        
        const craftTypeId = categoryToCraftTypeId[category]
        if (!craftTypeId) {
          console.error(`No default craft type found for category: ${category}`)
          continue
        }
        
        try {
          // Check if entry already exists for this week and category
          const { data: existing } = await adminSupabase
            .from('labor_actuals')
            .select('id')
            .eq('project_id', project.id)
            .eq('craft_type_id', craftTypeId)
            .eq('week_ending', weekEndingISO)
            .maybeSingle()

          if (existing) {
            // Update existing entry
            const { error: updateError } = await adminSupabase
              .from('labor_actuals')
              .update({
                actual_hours: totalHours,
                actual_cost: totalCost,
                burden_rate: burdenRate,
                burden_amount: burdenAmount,
                actual_cost_with_burden: totalCostWithBurden,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)

            if (updateError) throw updateError
          } else {
            // Create new entry
            const { error: insertError } = await adminSupabase
              .from('labor_actuals')
              .insert({
                project_id: project.id,
                craft_type_id: craftTypeId,
                week_ending: weekEndingISO,
                actual_hours: totalHours,
                actual_cost: totalCost,
                burden_rate: burdenRate,
                burden_amount: burdenAmount,
                actual_cost_with_burden: totalCostWithBurden
              })

            if (insertError) throw insertError
          }

          console.log(`Imported ${category} labor: ${totals.employeeCount} employees, ${totalHours} hours, $${totalCost} (+ $${burdenAmount.toFixed(2)} burden = $${totalCostWithBurden.toFixed(2)} total)`)
        } catch (error) {
          console.error(`Error saving ${category} labor actuals:`, error)
          
          let errorMessage = `Failed to save ${category} labor data`
          if (error instanceof Error && error.message) {
            errorMessage = `Database error: ${error.message}`
          }
          
          result.errors.push({
            row: 0,
            message: errorMessage
          })
        }
      }
      
      // Set total employee count in result
      result.employeeCount = totalEmployeeCount - zeroRateEmployees
    } else if (totalEmployeeCount === 0) {
      result.errors.push({
        row: 0,
        message: 'No employees with hours found in the Excel file'
      })
    }

    // Log import activity
    try {
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'import',
        entity_type: 'labor_actuals',
        entity_id: project.id,
        changes: {
          filename: file.name,
          week_ending: weekEndingISO,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
          employeeCount: result.employeeCount || 0,
          newEmployeesCreated: newEmployeesCreated,
          zeroRateEmployees: zeroRateEmployees,
          craftCodeWarnings: craftCodeWarnings.length
        }
      })
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError)
    }

    // Check if we should rollback due to high error rate
    const totalProcessed = result.imported + result.updated + result.skipped
    const errorRate = totalProcessed > 0 ? result.errors.length / totalProcessed : 1
    
    if (errorRate > 0.1 && result.errors.length > 5) {
      // More than 10% errors and at least 5 errors
      return NextResponse.json(
        {
          error: 'Import failed due to high error rate',
          message: `Too many errors encountered (${result.errors.length} errors out of ${totalProcessed} rows). Please review the file and try again.`,
          errors: result.errors.slice(0, 10) // Return first 10 errors
        },
        { status: 400 }
      )
    }

    // Set success based on whether we processed data without critical errors
    result.success = (result.imported > 0 || result.updated > 0) && result.errors.length === 0

    // Create data_imports record to trigger project.last_labor_import_at update
    if (result.success || (result.errors.length > 0 && (result.imported > 0 || result.updated > 0))) {
      try {
        const importMetadata: any = {
          week_ending: weekEndingISO,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          employee_count: result.employeeCount || 0,
          job_number: project.job_number,
          contractor_number: contractorNumber,
          file_hash: fileHash,
          employeeCategoryCounts: {
            direct: categoryTotals.direct.employeeCount,
            indirect: categoryTotals.indirect.employeeCount,
            staff: categoryTotals.staff.employeeCount
          }
        }
        
        // Add new employees to metadata for easy identification
        if (newEmployeesCreated > 0) {
          importMetadata.newEmployees = newEmployeesToCreate.map(e => ({
            employee_number: e.employee_number,
            name: `${e.last_name}, ${e.first_name}`,
            category: e.category
          }))
        }
        
        // Add craft code warnings
        if (craftCodeWarnings.length > 0) {
          importMetadata.craftCodeWarnings = craftCodeWarnings.slice(0, 20) // Limit to 20
        }
        
        const { data: importRecord, error: importError } = await adminSupabase
          .from('data_imports')
          .insert({
            project_id: project.id,
            import_type: 'labor',
            import_status: result.success ? 'success' : 'partial',
            imported_by: user.id,
            file_name: file.name,
            records_processed: result.imported + result.updated,
            records_failed: result.errors.length,
            metadata: importMetadata
          })
          .select('id')
          .single()

        if (importError) {
          console.error('Failed to create data_imports record:', importError)
        } else if (importRecord) {
          ;(result as any).import_id = importRecord.id
        }
      } catch (importTrackingError) {
        console.error('Error creating data_imports record:', importTrackingError)
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Labor import error:', error)
    
    // Try to create a failed import record if we have enough information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof z.ZodError ? error.errors : undefined
    
    if (adminSupabase) {
      await trackFailedImport(
        adminSupabase,
        projectId,
        user?.id,
        file?.name,
        errorMessage,
        {
          week_ending: weekEndingISO || null,
          file_hash: fileHash || null,
          error_type: error instanceof z.ZodError ? 'validation' : 'processing',
          error_details: errorDetails
        }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}