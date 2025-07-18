import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  let importRecord: any = null
  const supabase = await createClient()
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'File and project ID are required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create import record
    const { data: importData, error: importError } = await supabase
      .from('data_imports')
      .insert({
        project_id: projectId,
        import_type: 'labor',
        import_status: 'processing',
        imported_by: user.id,
        file_name: file.name,
        metadata: { file_size: file.size }
      })
      .select()
      .single()

    if (importError) {
      console.error('Error creating import record:', importError)
      return NextResponse.json({ error: importError.message }, { status: 500 })
    }

    importRecord = importData

    // Process the file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    let recordsProcessed = 0
    let recordsFailed = 0
    const errors: any[] = []

    // Get craft types for matching
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('id, name, code')

    const craftTypeMap = new Map(
      craftTypes?.map(ct => [ct.name.toLowerCase(), ct.id]) || []
    )
    
    // Get all employees for this project to look up base rates
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_number, base_rate, craft_type_id')
      .eq('is_active', true)

    // Get default craft type for direct labor
    const directLaborCraftId = craftTypes?.find(ct => ct.code === '01-100')?.id

    // Process each row
    for (const row of data) {
      try {
        // Extract fields based on typical labor import format
        const weekEnding = row['Week Ending'] || row['week_ending']
        // const employeeName = row['Employee'] || row['employee_name']
        const employeeNumber = row['Employee Number'] || row['employee_number'] || ''
        const hours = parseFloat(row['Hours'] || row['hours'] || '0')
        const costFromFile = parseFloat(row['Cost'] || row['cost'] || '0')
        const craftName = row['Craft'] || row['craft_type'] || 'Direct Labor'

        if (!weekEnding) {
          errors.push({ row: recordsProcessed + 1, error: 'Missing week ending date' })
          recordsFailed++
          continue
        }

        // Find or use default craft type
        const craftTypeId = craftTypeMap.get(craftName.toLowerCase()) || directLaborCraftId

        if (!craftTypeId) {
          errors.push({ row: recordsProcessed + 1, error: `Unknown craft type: ${craftName}` })
          recordsFailed++
          continue
        }
        
        // Calculate actual cost using employee base rate if available
        let cost = costFromFile
        if (employeeNumber && employees) {
          const employee = employees.find(e => e.employee_number === employeeNumber)
          if (employee && employee.base_rate) {
            // Use actual pay rate to calculate cost
            cost = hours * Number(employee.base_rate)
          }
        } else if (craftTypeId && employees) {
          // Try to find employees by craft type and calculate average rate
          const craftEmployees = employees.filter(e => e.craft_type_id === craftTypeId)
          if (craftEmployees.length > 0) {
            const avgRate = craftEmployees.reduce((sum, e) => sum + Number(e.base_rate || 0), 0) / craftEmployees.length
            if (avgRate > 0) {
              cost = hours * avgRate
            }
          }
        }

        // Check if labor actual already exists for this week/craft
        const { data: existing } = await supabase
          .from('labor_actuals')
          .select('id, actual_hours, actual_cost')
          .eq('project_id', projectId)
          .eq('craft_type_id', craftTypeId)
          .eq('week_ending', weekEnding)
          .single()

        if (existing) {
          // Update existing record (accumulate values)
          await supabase
            .from('labor_actuals')
            .update({
              actual_hours: Number(existing.actual_hours) + hours,
              actual_cost: Number(existing.actual_cost) + cost,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          // Create new record
          await supabase
            .from('labor_actuals')
            .insert({
              project_id: projectId,
              craft_type_id: craftTypeId,
              week_ending: weekEnding,
              actual_hours: hours,
              actual_cost: cost
            })
        }

        recordsProcessed++
      } catch (error: any) {
        console.error('Error processing row:', error)
        errors.push({ row: recordsProcessed + 1, error: error.message })
        recordsFailed++
      }
    }

    // Update import record
    await supabase
      .from('data_imports')
      .update({
        import_status: recordsFailed === 0 ? 'success' : 'completed_with_errors',
        records_processed: recordsProcessed,
        records_failed: recordsFailed,
        error_details: errors.length > 0 ? { errors } : null
      })
      .eq('id', importRecord.id)

    // Update project's last labor import timestamp
    await supabase
      .from('projects')
      .update({
        last_labor_import_at: new Date().toISOString(),
        data_health_status: 'current',
        data_health_checked_at: new Date().toISOString()
      })
      .eq('id', projectId)

    // Calculate and update physical progress if using labor hours method
    const { data: project } = await supabase
      .from('projects')
      .select('physical_progress_method')
      .eq('id', projectId)
      .single()

    if (project?.physical_progress_method === 'labor_hours') {
      // This will be handled by the database trigger
    }

    return NextResponse.json({
      success: true,
      import_id: importRecord.id,
      records_processed: recordsProcessed,
      records_failed: recordsFailed,
      errors: errors.slice(0, 10) // Return first 10 errors
    })
  } catch (error: any) {
    console.error('Error in labor import:', error)
    
    // Update import record with error
    if (importRecord) {
      await supabase
        .from('data_imports')
        .update({
          import_status: 'failed',
          error_message: error.message
        })
        .eq('id', importRecord.id)
    }

    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}