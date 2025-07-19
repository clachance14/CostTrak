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
  
  try {
    const supabase = await createClient()
    adminSupabase = createAdminClient()

    // Check authentication
    const { data: { user: authUser } } = await supabase.auth.getUser()
    user = authUser
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Check permissions
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

    // Extract contractor number and try to match project if no project_id provided
    const contractorRow = rawData[3] // Row 4 (0-indexed)
    const contractorNumber = parseStringValue(contractorRow[4]) // "5772 LS DOW" at index 4
    
    // Extract job number from contractor string (e.g., "5772 LS DOW" -> "5772")
    const jobNumberMatch = contractorNumber.match(/^(\d+)/)
    const fileJobNumber = jobNumberMatch ? jobNumberMatch[1] : ''

    // If no project_id provided, try to auto-match by job number
    if (!projectId && fileJobNumber) {
      const { data: matchedProject } = await supabase
        .from('projects')
        .select('id, job_number, name, project_manager_id, division_id')
        .eq('job_number', fileJobNumber)
        .is('deleted_at', null)
        .single()
      
      if (matchedProject) {
        projectId = matchedProject.id
      } else {
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

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name, project_manager_id, division_id')
      .eq('id', validatedData.project_id)
      .is('deleted_at', null)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    // Check access permissions
    if (userProfile.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    if (userProfile.role === 'ops_manager') {
      const { data: userDetails } = await supabase
        .from('profiles')
        .select('division_id')
        .eq('id', user.id)
        .single()

      if (userDetails?.division_id !== project.division_id) {
        return NextResponse.json({ error: 'Access denied to this division' }, { status: 403 })
      }
    }

    // Extract week ending date (already have rawData from above)
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

    // Get all craft types for mapping
    const { data: craftTypes } = await adminSupabase
      .from('craft_types')
      .select('id, code, name, billing_rate')
      .eq('is_active', true)
    
    const craftTypeMap = new Map(
      craftTypes?.map(ct => [ct.code.toUpperCase(), ct.id]) || []
    )
    
    // Track craft types that need to be created or updated
    const craftTypesToUpdate = new Map<string, number>() // code -> billing_rate

    // Track new employees created
    let newEmployeesCreated = 0

    // Process employee data rows and aggregate totals
    // FIXED: Start from row 10 (index 9) - actual employee data starts here
    for (let i = 9; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = i + 1

      // Skip empty rows or rows without valid employee ID
      const employeeIdCell = parseStringValue(row[EXCEL_COLUMNS.EMPLOYEE_ID])
      
      // Stop if we hit the Grand Totals row
      if (employeeIdCell === 'Grand Totals' || employeeIdCell.toLowerCase().includes('total')) {
        break
      }
      
      // FIXED: Check if employee ID matches pattern T\d+
      if (!employeeIdCell || !/^T\d+$/.test(employeeIdCell)) {
        continue
      }

      try {
        // Get employee data from the row
        const employeeName = parseStringValue(row[EXCEL_COLUMNS.NAME])
        const craftCode = parseStringValue(row[EXCEL_COLUMNS.CRAFT])
        const stHours = parseNumericValue(row[EXCEL_COLUMNS.ST_HOURS])
        const otHours = parseNumericValue(row[EXCEL_COLUMNS.OT_HOURS])
        // Read the billing rate from ST_RATE column for the craft type
        const billingRate = parseNumericValue(row[EXCEL_COLUMNS.ST_RATE])
        // These are for reference/validation only - we'll calculate actual wages from base_rate
        // const stWagesFromFile = parseNumericValue(row[EXCEL_COLUMNS.ST_WAGES])
        // const otWagesFromFile = parseNumericValue(row[EXCEL_COLUMNS.OT_WAGES])

        // Skip rows with 0 hours
        if (stHours === 0 && otHours === 0) {
          result.skipped++
          continue
        }

        // Check if employee exists and get their base_rate and category
        const { data: existingEmployee } = await adminSupabase
          .from('employees')
          .select('id, base_rate, category')
          .eq('employee_number', employeeIdCell)
          .maybeSingle()
        
        let employeeId = existingEmployee?.id
        let employeeBaseRate = existingEmployee?.base_rate || 0
        let employeeCategory = existingEmployee?.category?.toLowerCase() || 'direct'
        
        if (!existingEmployee && employeeName) {
          // Employee doesn't exist, create them
          console.log(`Creating new employee: ${employeeIdCell} - ${employeeName}`)
          
          // Parse employee name (format: "LastName, FirstName")
          let firstName = ''
          let lastName = ''
          if (employeeName.includes(',')) {
            const parts = employeeName.split(',').map(p => p.trim())
            lastName = parts[0] || 'Unknown'
            firstName = parts[1] || 'Unknown'
          } else {
            // If no comma, assume "FirstName LastName" format
            const parts = employeeName.trim().split(' ')
            firstName = parts[0] || 'Unknown'
            lastName = parts.slice(1).join(' ') || firstName // Use firstName if no lastName
          }
          
          // Determine category and craft type ID - default to direct
          employeeCategory = 'direct'
          let craftTypeId = categoryToCraftTypeId[employeeCategory]
          let employeeClass = craftCode // Default to full craft code
          
          if (craftCode) {
            // Remove 'C' prefix for employee class field
            employeeClass = craftCode.startsWith('C') ? craftCode.substring(1) : craftCode
            
            // Look up craft type using full code (with 'C')
            if (craftTypeMap.has(craftCode.toUpperCase())) {
              craftTypeId = craftTypeMap.get(craftCode.toUpperCase())
            } else {
              // Track this craft type to be created later
              craftTypesToUpdate.set(craftCode.toUpperCase(), billingRate)
            }
          }
          
          // Use billing rate as initial base rate for new employees
          // This can be updated later with actual pay rates
          const baseRate = billingRate || 0
          
          // Create the employee
          const { data: newEmployee, error: createError } = await adminSupabase
            .from('employees')
            .insert({
              employee_number: employeeIdCell,
              first_name: firstName,
              last_name: lastName,
              craft_type_id: craftTypeId,
              base_rate: baseRate || 0,
              class: employeeClass, // Store without 'C' prefix
              category: 'Direct', // Default to Direct for new employees
              is_direct: true, // Default to direct, can be updated later
              is_active: true
            })
            .select('id')
            .single()
          
          if (createError) {
            console.error(`Failed to create employee ${employeeIdCell}:`, createError)
            result.errors.push({
              row: rowNumber,
              message: `Failed to create employee: ${createError.message}`,
              data: { employee_number: employeeIdCell, name: employeeName }
            })
          } else {
            console.log(`Successfully created employee ${employeeIdCell}`)
            employeeId = newEmployee.id
            employeeBaseRate = baseRate
            newEmployeesCreated++
          }
        }
        
        // Calculate actual wages using employee base rate
        const stWages = stHours * employeeBaseRate
        const otWages = otHours * employeeBaseRate * 1.5 // 1.5x for overtime
        
        // If we have an employee ID, create/update individual labor record
        if (employeeId) {
          // Parse daily hours (Monday through Sunday)
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
          
          dayColumns.forEach(({ day, index }) => {
            const hours = parseNumericValue(row[index])
            if (hours > 0) {
              dailyHours[day] = hours
            }
          })
          
          // Check if labor_employee_actuals entry exists
          const { data: existingLabor } = await adminSupabase
            .from('labor_employee_actuals')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('project_id', project.id)
            .eq('week_ending', weekEndingISO)
            .maybeSingle()
          
          if (existingLabor) {
            // Update existing record
            const { error: updateError } = await adminSupabase
              .from('labor_employee_actuals')
              .update({
                st_hours: stHours,
                ot_hours: otHours,
                st_wages: stWages,
                ot_wages: otWages,
                daily_hours: Object.keys(dailyHours).length > 0 ? dailyHours : null,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingLabor.id)
            
            if (updateError) {
              console.error(`Failed to update labor for employee ${employeeIdCell}:`, updateError)
            }
          } else {
            // Create new record
            const { error: insertError } = await adminSupabase
              .from('labor_employee_actuals')
              .insert({
                employee_id: employeeId,
                project_id: project.id,
                week_ending: weekEndingISO,
                st_hours: stHours,
                ot_hours: otHours,
                st_wages: stWages,
                ot_wages: otWages,
                daily_hours: Object.keys(dailyHours).length > 0 ? dailyHours : null
              })
            
            if (insertError) {
              console.error(`Failed to create labor record for employee ${employeeIdCell}:`, insertError)
            }
          }
        }

        // Track craft type billing rates for update
        if (craftCode && billingRate > 0) {
          craftTypesToUpdate.set(craftCode.toUpperCase(), billingRate)
        }
        
        // Aggregate totals by category (using calculated actual wages)
        if (categoryTotals[employeeCategory]) {
          categoryTotals[employeeCategory].stHours += stHours
          categoryTotals[employeeCategory].otHours += otHours
          categoryTotals[employeeCategory].stWages += stWages
          categoryTotals[employeeCategory].otWages += otWages
          categoryTotals[employeeCategory].employeeIds.add(employeeIdCell)
        }
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

    // Add new employees created to result
    if (newEmployeesCreated > 0) {
      console.log(`Created ${newEmployeesCreated} new employees during import`)
      ;(result as any).newEmployeesCreated = newEmployeesCreated
    }

    // Import aggregated labor actuals by category
    if (totalEmployeeCount > 0) {
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
          const { data: existing, error: existingError } = await adminSupabase
            .from('labor_actuals')
            .select('id')
            .eq('project_id', project.id)
            .eq('craft_type_id', craftTypeId)
            .eq('week_ending', weekEndingISO)
            .maybeSingle()

          if (existingError) throw existingError

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
            result.updated++
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
            result.imported++
          }

          console.log(`Imported ${category} labor: ${totals.employeeCount} employees, ${totalHours} hours, $${totalCost} (+ $${burdenAmount.toFixed(2)} burden = $${totalCostWithBurden.toFixed(2)} total)`)
        } catch (error) {
          console.error(`Error saving ${category} labor actuals:`, {
            error: error,
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            data: {
              project_id: project.id,
              craft_type_id: craftTypeId,
              category: category,
              week_ending: weekEndingISO,
              actual_hours: totalHours,
              actual_cost: totalCost
            }
          })
          
          let errorMessage = `Failed to save ${category} labor data`
          if (error instanceof Error && error.message) {
            errorMessage = `Database error: ${error.message}`
          }
          if ((error as any)?.hint) {
            errorMessage += ` (Hint: ${(error as any).hint})`
          }
          
          result.errors.push({
            row: 0,
            message: errorMessage
          })
        }
      }
      
      // Set total employee count in result
      result.employeeCount = totalEmployeeCount
    } else if (totalEmployeeCount === 0) {
      result.errors.push({
        row: 0,
        message: 'No employees with hours found in the Excel file'
      })
    }

    // Create or update craft types with billing rates from the import
    if (craftTypesToUpdate.size > 0) {
      for (const [craftCode, billingRate] of craftTypesToUpdate.entries()) {
        try {
          // Check if craft type exists
          const { data: existing } = await adminSupabase
            .from('craft_types')
            .select('id, billing_rate')
            .eq('code', craftCode)
            .maybeSingle()
          
          if (existing) {
            // Update billing rate if it's different
            if (existing.billing_rate !== billingRate) {
              await adminSupabase
                .from('craft_types')
                .update({ 
                  billing_rate: billingRate,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
            }
          } else {
            // Create new craft type
            const craftName = craftCode.startsWith('C') ? craftCode.substring(1) : craftCode
            await adminSupabase
              .from('craft_types')
              .insert({
                code: craftCode,
                name: craftName,
                billing_rate: billingRate,
                category: 'direct', // Default category
                is_active: true
              })
          }
        } catch (error) {
          console.error(`Failed to create/update craft type ${craftCode}:`, error)
        }
      }
    }
    
    // Update running averages for each category that had data
    if (result.imported > 0 || result.updated > 0) {
      for (const [category, craftTypeId] of Object.entries(categoryToCraftTypeId)) {
        if (categoryTotals[category].employeeCount === 0) continue
        
        try {
          // Calculate new running average
          const { data: recentActuals } = await adminSupabase
            .from('labor_actuals')
            .select('actual_hours, actual_cost')
            .eq('project_id', project.id)
            .eq('craft_type_id', craftTypeId)
            .order('week_ending', { ascending: false })
            .limit(8)

          if (recentActuals && recentActuals.length > 0) {
            const totalHours = recentActuals.reduce((sum, a) => sum + (a.actual_hours || 0), 0)
            const totalCost = recentActuals.reduce((sum, a) => sum + (a.actual_cost || 0), 0)
            
            const { error: avgError } = await adminSupabase
              .from('labor_running_averages')
              .upsert({
                project_id: project.id,
                craft_type_id: craftTypeId,
                avg_hours: totalHours / recentActuals.length,
                avg_cost: totalCost / recentActuals.length,
                week_count: recentActuals.length,
                last_updated: weekEndingISO,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'project_id,craft_type_id'
              })

            if (avgError) {
              console.error(`Failed to update running average for ${category}:`, avgError)
            }
          }
        } catch (error) {
          console.error(`Error updating running averages for ${category}:`, error)
        }
      }
    }

    // Log import activity (don't fail if audit log fails)
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
          employeeCount: result.employeeCount || 0
        }
      })
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError)
    }

    // Set success based on whether we processed data without critical errors
    result.success = (result.imported > 0 || result.updated > 0) && result.errors.length === 0

    // Create data_imports record to trigger project.last_labor_import_at update
    if (result.success) {
      try {
        const { error: importError } = await adminSupabase
          .from('data_imports')
          .insert({
            project_id: project.id,
            import_type: 'labor',
            import_status: 'success',
            imported_by: user.id,
            file_name: file.name,
            records_processed: result.imported + result.updated,
            records_failed: result.errors.length,
            metadata: {
              week_ending: weekEndingISO,
              imported: result.imported,
              updated: result.updated,
              skipped: result.skipped,
              employee_count: result.employeeCount || 0,
              job_number: project.job_number,
              contractor_number: contractorNumber,
              employeeCategoryCounts: {
                direct: categoryTotals.direct.employeeCount,
                indirect: categoryTotals.indirect.employeeCount,
                staff: categoryTotals.staff.employeeCount
              }
            }
          })

        if (importError) {
          console.error('Failed to create data_imports record:', importError)
          // Don't fail the whole import if we can't create the tracking record
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

