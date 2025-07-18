import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for validating employee import data - kept for future use
// const employeeImportRowSchema = z.object({
//   employee_number: z.string().min(1),
//   first_name: z.string().min(1),
//   last_name: z.string().min(1),
//   payroll_name: z.string().optional(),
//   legal_middle_name: z.string().optional(),
//   craft_code: z.string().optional(),
//   base_rate: z.number().min(0),
//   category: z.enum(['Direct', 'Indirect', 'Staff']).default('Direct'),
//   class: z.string().optional(),
//   job_title_description: z.string().optional(),
//   location_code: z.string().optional(),
//   location_description: z.string().optional(),
//   is_direct: z.boolean().default(true)
// })

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

// Helper to parse boolean value - kept for future use
// function parseBooleanValue(value: unknown): boolean {
//   if (typeof value === 'boolean') return value
//   if (typeof value === 'string') {
//     const lower = value.toLowerCase().trim()
//     return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'direct'
//   }
//   return true // Default to direct labor
// }

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
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
    const allowedRoles = ['controller', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to import employees' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'update' // Default to update mode

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse Excel file. Please ensure it is a valid .xlsx file.' },
        { status: 400 }
      )
    }

    // Try to find a sheet with employee data
    let worksheet: XLSX.WorkSheet | null = null
    let rawData: unknown[][] = []
    // let sheetName = ''
    
    // Check all sheets for employee data
    for (const name of workbook.SheetNames) {
      console.log(`Checking sheet: ${name}`)
      const ws = workbook.Sheets[name]
      const data = XLSX.utils.sheet_to_json(ws, { 
        header: 1,
        raw: true,
        defval: ''
      }) as unknown[][]
      
      // Look for employee-related headers in the first 10 rows
      let headerRowIndex = -1
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i]
        if (!row || row.length === 0) continue
        
        // Check if this row contains employee-related headers
        const rowStr = row.map(cell => String(cell).toLowerCase()).join(' ')
        if (rowStr.includes('employee') || rowStr.includes('name') || rowStr.includes('id') || 
            rowStr.includes('number') || rowStr.includes('craft') || rowStr.includes('rate')) {
          headerRowIndex = i
          break
        }
      }
      
      if (headerRowIndex >= 0) {
        worksheet = ws
        rawData = data
        console.log(`Found employee data in sheet "${name}" at row ${headerRowIndex + 1}`)
        break
      }
    }
    
    if (!worksheet || rawData.length < 2) {
      return NextResponse.json(
        { error: 'No employee data found in Excel file. Please check the file format.' },
        { status: 400 }
      )
    }

    // Ensure default craft types exist for each category
    const { data: existingCraftTypes } = await adminSupabase
      .from('craft_types')
      .select('id, code, name, category')
      .eq('is_active', true)

    const craftTypesByCategory = {
      direct: existingCraftTypes?.find(ct => ct.category === 'direct' && ct.code === 'DIRECT'),
      indirect: existingCraftTypes?.find(ct => ct.category === 'indirect' && ct.code === 'INDIRECT'),
      staff: existingCraftTypes?.find(ct => ct.category === 'staff' && ct.code === 'STAFF')
    }

    // Create missing default craft types
    if (!craftTypesByCategory.direct) {
      const { data: newCraft } = await adminSupabase
        .from('craft_types')
        .insert({
          code: 'DIRECT',
          name: 'Direct Labor',
          category: 'direct',
          is_active: true
        })
        .select('id, code, name, category')
        .single()
      
      if (newCraft) {
        craftTypesByCategory.direct = newCraft
      }
    }

    if (!craftTypesByCategory.indirect) {
      const { data: newCraft } = await adminSupabase
        .from('craft_types')
        .insert({
          code: 'INDIRECT',
          name: 'Indirect Labor',
          category: 'indirect',
          is_active: true
        })
        .select('id, code, name, category')
        .single()
      
      if (newCraft) {
        craftTypesByCategory.indirect = newCraft
      }
    }

    if (!craftTypesByCategory.staff) {
      const { data: newCraft } = await adminSupabase
        .from('craft_types')
        .insert({
          code: 'STAFF',
          name: 'Staff Labor',
          category: 'staff',
          is_active: true
        })
        .select('id, code, name, category')
        .single()
      
      if (newCraft) {
        craftTypesByCategory.staff = newCraft
      }
    }

    // Find header row and map columns
    let headerRowIndex = -1
    const columnMap: {
      employeeNumber?: number
      firstName?: number
      lastName?: number
      payrollName?: number
      middleName?: number
      fullName?: number
      craft?: number
      rate?: number
      type?: number
      category?: number
      class?: number
      jobTitle?: number
      locationCode?: number
      locationDescription?: number
    } = {}
    
    // Find headers
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i]
      if (!row || row.length === 0) continue
      
      let foundHeaders = false
      row.forEach((cell, index) => {
        const header = String(cell).toLowerCase().trim()
        
        // Map common header variations
        if (header.includes('employee') && (header.includes('number') || header.includes('#') || header.includes('id'))) {
          columnMap.employeeNumber = index
          foundHeaders = true
        } else if (header === 'employee_number') {
          columnMap.employeeNumber = index
          foundHeaders = true
        } else if (header === 'legal first name' || (header.includes('first') && header.includes('name'))) {
          columnMap.firstName = index
          foundHeaders = true
        } else if (header === 'legal last name' || (header.includes('last') && header.includes('name'))) {
          columnMap.lastName = index
          foundHeaders = true
        } else if (header === 'payroll name') {
          columnMap.payrollName = index
          foundHeaders = true
        } else if (header === 'legal middle name' || header.includes('middle')) {
          columnMap.middleName = index
          foundHeaders = true
        } else if (header === 'name' || header.includes('employee name') || header.includes('full name')) {
          columnMap.fullName = index
          foundHeaders = true
        } else if (header.includes('craft') || header.includes('trade') || header.includes('classification')) {
          columnMap.craft = index
          foundHeaders = true
        } else if (header === 'base_rate' || header.includes('rate') || header.includes('wage') || header.includes('hourly')) {
          columnMap.rate = index
          foundHeaders = true
        } else if (header === 'category' || header.includes('type') || header.includes('direct') || header.includes('indirect')) {
          columnMap.category = index
          foundHeaders = true
        } else if (header === 'pay grade code' || header.includes('grade') || header.includes('class')) {
          columnMap.class = index
          foundHeaders = true
        } else if (header === 'job title description' || header.includes('job title') || header.includes('title')) {
          columnMap.jobTitle = index
          foundHeaders = true
        } else if (header === 'location code') {
          columnMap.locationCode = index
          foundHeaders = true
        } else if (header === 'location description') {
          columnMap.locationDescription = index
          foundHeaders = true
        }
      })
      
      if (foundHeaders) {
        headerRowIndex = i
        console.log('Found headers at row', i + 1, 'Column mapping:', columnMap)
        break
      }
    }
    
    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: 'Could not find valid headers in Excel file. Expected columns for employee number, name, craft, and rate.' },
        { status: 400 }
      )
    }

    // Automatically create craft types from pay grade codes in the file
    const craftTypesInFile = new Set<string>()
    const craftTypeUpdateResults = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ craft: string; error: string }>
    }

    if (columnMap.craft !== undefined) {
      // First pass: collect all unique pay grade codes from the file
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i]
        if (!row || row.length === 0) continue
        
        const hasData = row.some(cell => cell && String(cell).trim() !== '')
        if (!hasData) continue

        const craftCode = parseStringValue(row[columnMap.craft])
        if (craftCode && craftCode !== 'DIRECT' && craftCode !== 'INDIRECT' && craftCode !== 'STAFF') {
          craftTypesInFile.add(craftCode.toUpperCase())
        }
      }

      // Create craft types for any new pay grade codes
      for (const craftCode of craftTypesInFile) {
        const existing = existingCraftTypes?.find(ct => ct.code === craftCode)
        
        if (!existing) {
          // Determine category based on code patterns or default to direct
          const category: 'direct' | 'indirect' | 'staff' = 'direct'
          
          // You can add logic here to determine category from code if needed
          // For now, default to direct
          
          const { error } = await adminSupabase
            .from('craft_types')
            .insert({
              code: craftCode,
              name: craftCode, // Use code as name initially
              category: category,
              is_active: true
            })
          
          if (error) {
            craftTypeUpdateResults.errors.push({
              craft: craftCode,
              error: 'Failed to create craft type'
            })
          } else {
            craftTypeUpdateResults.created++
          }
        }
      }
    }

    // Reload craft types after potential additions
    const { data: allCraftTypes } = await adminSupabase
      .from('craft_types')
      .select('id, code, name, category')
      .eq('is_active', true)

    const craftTypeMap = new Map(
      allCraftTypes?.map(ct => [ct.code.toUpperCase(), ct]) || []
    )

    // Process employee data
    const results = {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; employee_number: string; error: string }>
    }

    const employeesToCreate = []
    const employeesToUpdate = []

    // Start from row after headers
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = i + 1

      // Skip empty rows
      if (!row || row.length === 0) continue
      
      // Check if this is an empty row (all cells empty or whitespace)
      const hasData = row.some(cell => cell && String(cell).trim() !== '')
      if (!hasData) continue

      results.total++

      try {
        // Extract data based on mapped columns
        let employeeNumber = ''
        let firstName = ''
        let lastName = ''
        let payrollName = ''
        let middleName = ''
        let craftCode = ''
        let baseRate = 0
        let isDirect = true
        let category = 'Direct'
        let classCode = ''
        let jobTitle = ''
        let locationCode = ''
        let locationDescription = ''
        
        // Get employee number
        if (columnMap.employeeNumber !== undefined) {
          employeeNumber = parseStringValue(row[columnMap.employeeNumber])
        }
        
        // Get name - either from separate columns or parse full name
        if (columnMap.firstName !== undefined && columnMap.lastName !== undefined) {
          firstName = parseStringValue(row[columnMap.firstName])
          lastName = parseStringValue(row[columnMap.lastName])
        } else if (columnMap.fullName !== undefined) {
          const fullName = parseStringValue(row[columnMap.fullName])
          // Parse "LastName, FirstName" or "FirstName LastName"
          if (fullName.includes(',')) {
            const parts = fullName.split(',').map(p => p.trim())
            lastName = parts[0] || ''
            firstName = parts[1] || ''
          } else {
            const parts = fullName.split(' ').filter(p => p)
            firstName = parts[0] || ''
            lastName = parts.slice(1).join(' ') || ''
          }
        }
        
        // Get craft
        if (columnMap.craft !== undefined) {
          craftCode = parseStringValue(row[columnMap.craft])
        }
        
        // Get rate
        if (columnMap.rate !== undefined) {
          baseRate = parseNumericValue(row[columnMap.rate])
        }
        
        // Get type/category
        if (columnMap.category !== undefined) {
          const categoryValue = parseStringValue(row[columnMap.category])
          if (['Direct', 'Indirect', 'Staff'].includes(categoryValue)) {
            category = categoryValue as 'Direct' | 'Indirect' | 'Staff'
            isDirect = category === 'Direct'
          }
        } else if (columnMap.type !== undefined) {
          const typeValue = parseStringValue(row[columnMap.type])
          isDirect = !typeValue.toLowerCase().includes('indirect')
          category = isDirect ? 'Direct' : 'Indirect'
        }

        // Get new fields
        if (columnMap.payrollName !== undefined) {
          payrollName = parseStringValue(row[columnMap.payrollName])
        }
        
        if (columnMap.middleName !== undefined) {
          middleName = parseStringValue(row[columnMap.middleName])
        }
        
        if (columnMap.class !== undefined) {
          classCode = parseStringValue(row[columnMap.class])
        }
        
        if (columnMap.jobTitle !== undefined) {
          jobTitle = parseStringValue(row[columnMap.jobTitle])
        }
        
        if (columnMap.locationCode !== undefined) {
          locationCode = parseStringValue(row[columnMap.locationCode])
        }
        
        if (columnMap.locationDescription !== undefined) {
          locationDescription = parseStringValue(row[columnMap.locationDescription])
        }

        // Add 'T' prefix if not present
        const formattedEmployeeNumber = employeeNumber.startsWith('T') 
          ? employeeNumber 
          : `T${employeeNumber}`

        // Validate required fields
        if (!employeeNumber || !firstName || !lastName) {
          results.errors.push({
            row: rowNumber,
            employee_number: employeeNumber || 'unknown',
            error: 'Missing required fields (employee number, first name, or last name)'
          })
          results.skipped++
          continue
        }

        // Check if employee already exists
        const { data: existing } = await adminSupabase
          .from('employees')
          .select('*')
          .eq('employee_number', formattedEmployeeNumber)
          .single()

        if (existing && mode === 'create-only') {
          results.errors.push({
            row: rowNumber,
            employee_number: formattedEmployeeNumber,
            error: 'Employee already exists'
          })
          results.skipped++
          continue
        }

        // Map craft type based on pay grade code or category
        let craftTypeId: string | null = null
        
        // First try to match by pay grade code if available
        if (craftCode) {
          const craftType = craftTypeMap.get(craftCode.toUpperCase())
          if (craftType) {
            craftTypeId = craftType.id
          }
        }
        
        // If no match by code, use default craft type for the category
        if (!craftTypeId) {
          const categoryLower = category.toLowerCase() as 'direct' | 'indirect' | 'staff'
          const defaultForCategory = craftTypesByCategory[categoryLower]
          if (defaultForCategory) {
            craftTypeId = defaultForCategory.id
          }
        }

        if (!craftTypeId) {
          results.errors.push({
            row: rowNumber,
            employee_number: formattedEmployeeNumber,
            error: 'Unable to determine craft type for category: ' + category
          })
          results.skipped++
          continue
        }

        // Handle update or create based on mode
        if (existing && mode === 'update') {
          // Build update object with only changed or blank fields
          const updates: Record<string, unknown> = {
            base_rate: baseRate || existing.base_rate, // Always update base rate
            category: category, // Always update category
            craft_type_id: craftTypeId,
            updated_at: new Date().toISOString()
          }

          // Fill in blank fields
          if (!existing.payroll_name && payrollName) {
            updates.payroll_name = payrollName
          }
          if (!existing.legal_middle_name && middleName) {
            updates.legal_middle_name = middleName
          }
          if (!existing.class && classCode) {
            updates.class = classCode
          }
          if (!existing.job_title_description && jobTitle) {
            updates.job_title_description = jobTitle
          }
          if (!existing.location_code && locationCode) {
            updates.location_code = locationCode
          }
          if (!existing.location_description && locationDescription) {
            updates.location_description = locationDescription
          }

          employeesToUpdate.push({
            id: existing.id,
            employee_number: formattedEmployeeNumber,
            updates
          })
        } else if (!existing) {
          // Add to create batch
          employeesToCreate.push({
            employee_number: formattedEmployeeNumber,
            first_name: firstName,
            last_name: lastName,
            payroll_name: payrollName || null,
            legal_middle_name: middleName || null,
            craft_type_id: craftTypeId,
            base_rate: baseRate || 0,
            category: category,
            class: classCode || null,
            job_title_description: jobTitle || null,
            location_code: locationCode || null,
            location_description: locationDescription || null,
            is_direct: isDirect,
            is_active: true
          })
        }

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          employee_number: parseStringValue(row[0]) || 'unknown',
          error: error instanceof Error ? error.message : 'Failed to parse row'
        })
        results.skipped++
      }
    }

    // Batch create employees
    if (employeesToCreate.length > 0) {
      const { data: created, error: createError } = await adminSupabase
        .from('employees')
        .insert(employeesToCreate)
        .select('id')

      if (createError) {
        console.error('Batch create error:', createError)
        return NextResponse.json(
          { error: 'Failed to create employees', details: createError },
          { status: 500 }
        )
      }

      results.imported = created?.length || 0

      // Log import activity
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'import',
        entity_type: 'employees',
        entity_id: user.id, // Use user ID as entity ID for batch imports
        changes: {
          filename: file.name,
          mode: mode,
          imported: results.imported,
          skipped: results.skipped,
          total: results.total
        }
      })
    }

    // Batch update employees
    if (employeesToUpdate.length > 0) {
      for (const emp of employeesToUpdate) {
        const { error: updateError } = await adminSupabase
          .from('employees')
          .update(emp.updates)
          .eq('id', emp.id)

        if (updateError) {
          results.errors.push({
            row: 0,
            employee_number: emp.employee_number,
            error: 'Failed to update employee'
          })
        } else {
          results.updated++
          
          // Log update
          await adminSupabase.from('audit_log').insert({
            user_id: user.id,
            action: 'update',
            entity_type: 'employee',
            entity_id: emp.id,
            changes: { 
              employee_number: emp.employee_number,
              updates: emp.updates 
            }
          })
        }
      }
    }

    // Build comprehensive response
    const response: Record<string, unknown> = {
      success: (results.imported + results.updated) > 0,
      summary: {
        total: results.total,
        imported: results.imported,
        updated: results.updated,
        skipped: results.skipped
      },
      errors: results.errors
    }

    // Always include craft type results
    if (craftTypeUpdateResults.created > 0) {
      response.craftTypes = {
        created: craftTypeUpdateResults.created,
        errors: craftTypeUpdateResults.errors
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Employee import error:', error)
    
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