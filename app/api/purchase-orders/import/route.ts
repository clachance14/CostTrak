import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import * as XLSX from 'xlsx'

// Validation schema for ICS PO Log CSV row
const icsRowSchema = z.object({
  'Job No.': z.string().min(1),
  'PO Number': z.string().min(1),
  'Generation Date': z.string().optional(),
  'Requestor': z.string().optional().default(''),
  'Sub Cost Code': z.string().optional().default(''),
  'Def. Contr./Extra': z.string().optional().default(''),
  'Vendor': z.string().min(1),
  'WO/PMO': z.string().optional().default(''),
  'Cost Center': z.string().optional().default(''),
  'Sub CC': z.string().optional().default(''),
  'SubSub CC': z.string().optional().default(''),
  'Est. PO Value': z.string().or(z.number()),
  'PO Status': z.string().optional().default('Active'),
  ' PO Comments': z.string().optional().default(''),
  'Invoice/Ticket': z.string().optional().default(''),
  'Inv. Date': z.string().optional(),
  'Contract/Extra': z.string().optional().default(''),
  'Line Item Value': z.string().or(z.number()),
  'FTO Sent Date': z.string().optional(),
  'FTO Ret. Date': z.string().optional(),
  ' BB Date': z.string().optional(),
  'Material Description': z.string().optional().default(''),
  'Comments': z.string().optional().default('')
})

type ICSRow = z.infer<typeof icsRowSchema>

interface ImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  lineItemsCreated: number
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: unknown
  }>
}

// Helper function to parse date from ICS format
function parseICSDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '0000-00-00') {
    return null
  }
  
  // ICS dates are in YYYY-MM-DD format
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return null
  }
  
  return dateStr
}

// Helper function to parse numeric value
function parseNumericValue(value: string | number): number {
  if (typeof value === 'number') return value
  if (!value || value === '') return 0
  
  // Remove any non-numeric characters except decimal point and negative sign
  const cleaned = value.toString().replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to clean PO number (remove status suffix)
function cleanPONumber(poNumber: string): string {
  // Remove " (Active)" or similar suffixes
  return poNumber.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

// Helper function to map ICS status to database enum
function mapStatus(icsStatus: string): 'draft' | 'approved' | 'cancelled' | 'completed' {
  switch (icsStatus.toLowerCase()) {
    case 'active':
      return 'approved'
    case 'cancelled':
      return 'cancelled'
    case 'completed':
      return 'completed'
    default:
      return 'approved'
  }
}

// POST /api/purchase-orders/import - Import ICS PO Log CSV
export async function POST(request: NextRequest) {
  const importRecord: any = null
  
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
    const allowedRoles = ['controller', 'accounting', 'ops_manager', 'project_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to import purchase orders' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectIdOverride = formData.get('project_id') as string | null // Optional project override

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse CSV file
    let rawData: unknown[]
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', dateNF: 'yyyy-mm-dd' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rawData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        dateNF: 'yyyy-mm-dd',
        header: 1 // Get as array of arrays to handle header rows properly
      })
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse file. Please ensure it is a valid CSV file.' },
        { status: 400 }
      )
    }

    if (!rawData || rawData.length < 3) {
      return NextResponse.json(
        { error: 'Invalid ICS PO Log format. File must have header metadata and data rows.' },
        { status: 400 }
      )
    }

    // Skip first 2 rows (metadata) and use row 3 as headers
    const headers = rawData[2] as string[]
    const dataRows = rawData.slice(3)

    // Convert back to object format using headers
    const data = dataRows.map(row => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        obj[header] = (row as unknown[])[index] || ''
      })
      return obj
    }).filter(row => row['Job No.'] && row['PO Number']) // Filter out empty rows

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No valid data rows found in file' },
        { status: 400 }
      )
    }

    // Initialize result tracking
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      lineItemsCreated: 0,
      errors: []
    }

    // Get all projects for job number lookup
    const { data: projects } = await supabase
      .from('projects')
      .select('id, job_number')
      .is('deleted_at', null)

    const projectMap = new Map(
      projects?.map(p => [p.job_number, p.id]) || []
    )

    // Group rows by Job No. + PO Number to aggregate line items
    const poGroups = new Map<string, ICSRow[]>()
    const projectsInImport = new Set<string>() // Track all projects in this import
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const dataRowNumber = i + 4 // Account for 2 metadata rows + header + 0-based index

      try {
        // Validate row data
        const validatedRow = icsRowSchema.parse(row)
        
        const jobNo = validatedRow['Job No.'].trim()
        const poNumber = cleanPONumber(validatedRow['PO Number'])
        const groupKey = `${jobNo}-${poNumber}`
        
        if (!poGroups.has(groupKey)) {
          poGroups.set(groupKey, [])
        }
        poGroups.get(groupKey)!.push(validatedRow)
      } catch (error) {
        if (error instanceof z.ZodError) {
          result.errors.push({
            row: dataRowNumber,
            message: `Validation error: ${error.errors[0]?.message}`,
            field: error.errors[0]?.path[0]?.toString(),
            data: row
          })
        } else {
          result.errors.push({
            row: dataRowNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: row
          })
        }
        result.skipped++
      }
    }

    // Process each PO group
    for (const [groupKey, rows] of poGroups) {
      const firstRow = rows[0]
      const jobNo = firstRow['Job No.'].trim()
      const cleanedPONumber = cleanPONumber(firstRow['PO Number'])

      try {
        // Determine project ID - use override if provided, otherwise look up by job number
        let projectId: string
        if (projectIdOverride) {
          projectId = projectIdOverride
        } else {
          const foundProjectId = projectMap.get(jobNo)
          if (!foundProjectId) {
            result.errors.push({
              row: 0,
              field: 'Job No.',
              message: `Project with job number '${jobNo}' not found`,
              data: { groupKey, jobNo }
            })
            result.skipped++
            continue
          }
          projectId = foundProjectId
        }
        
        // Track this project
        projectsInImport.add(projectId)

        // Get the PO value from the CSV (this is the actual PO value, not an estimate)
        const poValue = parseNumericValue(firstRow['Est. PO Value'])
        
        // Map cost center to budget category
        const costCenter = firstRow['Cost Center']
        let budgetCategory: string | null = null
        if (costCenter === '2000') {
          budgetCategory = 'EQUIPMENT'
        } else if (costCenter === '3000') {
          budgetCategory = 'MATERIALS'
        } else if (costCenter === '4000') {
          budgetCategory = 'SUBCONTRACTS'
        } else if (costCenter === '5000') {
          budgetCategory = 'SMALL TOOLS & CONSUMABLES'
        }
        
        // Prepare PO data
        const poData = {
          project_id: projectId,
          po_number: cleanedPONumber,
          vendor_name: firstRow['Vendor'],
          description: firstRow[' PO Comments'],
          po_value: poValue, // Original PO value from import
          committed_amount: poValue, // Initially same as PO value, can be edited later
          total_amount: 0, // Will be updated with invoiced amount
          status: mapStatus(firstRow['PO Status']),
          generation_date: parseICSDate(firstRow['Generation Date']),
          requestor: firstRow['Requestor'],
          sub_cost_code: firstRow['Sub Cost Code'],
          contract_extra_type: firstRow['Def. Contr./Extra'],
          wo_pmo: firstRow['WO/PMO'],
          cost_center: costCenter,
          budget_category: budgetCategory,
          sub_cc: firstRow['Sub CC'],
          subsub_cc: firstRow['SubSub CC'],
          fto_sent_date: parseICSDate(firstRow['FTO Sent Date']),
          fto_return_date: parseICSDate(firstRow['FTO Ret. Date']),
          bb_date: parseICSDate(firstRow[' BB Date']),
          created_by: user.id
        }

        // Check if PO already exists
        const { data: existingPO } = await adminSupabase
          .from('purchase_orders')
          .select('id')
          .eq('project_id', projectId)
          .eq('po_number', cleanedPONumber)
          .is('deleted_at', null)
          .single()

        let poId: string

        if (existingPO) {
          // Update existing PO
          const { error: updateError } = await adminSupabase
            .from('purchase_orders')
            .update({
              ...poData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPO.id)

          if (updateError) {
            result.errors.push({
              row: 0,
              message: `Failed to update PO ${cleanedPONumber}: ${updateError.message}`,
              data: { groupKey, poData }
            })
            result.skipped++
            continue
          }
          
          poId = existingPO.id
          result.updated++
          
          // Delete existing line items to recreate them
          await adminSupabase
            .from('po_line_items')
            .delete()
            .eq('purchase_order_id', poId)
        } else {
          // Create new PO
          const { data: newPO, error: insertError } = await adminSupabase
            .from('purchase_orders')
            .insert(poData)
            .select('id')
            .single()

          if (insertError) {
            if (insertError.code === '23505') {
              result.errors.push({
                row: 0,
                message: `Duplicate PO number ${cleanedPONumber} for project ${jobNo}`,
                data: { groupKey, poData }
              })
            } else {
              result.errors.push({
                row: 0,
                message: `Failed to create PO ${cleanedPONumber}: ${insertError.message}`,
                data: { groupKey, poData }
              })
            }
            result.skipped++
            continue
          }
          
          poId = newPO.id
          result.imported++
        }

        // Create line items for each invoice/ticket
        const lineItems = []
        let totalInvoicedAmount = 0
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const invoiceTicket = row['Invoice/Ticket']
          
          if (invoiceTicket && invoiceTicket.trim() !== '') {
            const lineItemValue = parseNumericValue(row['Line Item Value'])
            totalInvoicedAmount += lineItemValue
            
            lineItems.push({
              purchase_order_id: poId,
              line_number: i + 1,
              description: row['Material Description'] || `Invoice ${invoiceTicket}`,
              total_amount: lineItemValue,
              invoice_ticket: invoiceTicket,
              invoice_date: parseICSDate(row['Inv. Date']),
              contract_extra_type: row['Contract/Extra'],
              material_description: row['Material Description'],
              category: row['Contract/Extra'] || 'Contract'
            })
          }
        }

        // Insert line items if any exist
        if (lineItems.length > 0) {
          const { error: lineItemError } = await adminSupabase
            .from('po_line_items')
            .insert(lineItems)

          if (lineItemError) {
            result.errors.push({
              row: 0,
              message: `Failed to create line items for PO ${cleanedPONumber}: ${lineItemError.message}`,
              data: { groupKey, lineItems }
            })
          } else {
            result.lineItemsCreated += lineItems.length
            
            // Update the PO with the calculated invoiced amount and total_amount
            const { error: updateInvoicedError } = await adminSupabase
              .from('purchase_orders')
              .update({ 
                invoiced_amount: totalInvoicedAmount,
                total_amount: totalInvoicedAmount, // Total amount = invoiced amount
                updated_at: new Date().toISOString()
              })
              .eq('id', poId)
              
            if (updateInvoicedError) {
              result.errors.push({
                row: 0,
                message: `Failed to update invoiced amount for PO ${cleanedPONumber}: ${updateInvoicedError.message}`,
                data: { groupKey, totalInvoicedAmount }
              })
            }
          }
        }

      } catch (error) {
        result.errors.push({
          row: 0,
          message: `Failed to process PO group ${groupKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { groupKey, firstRow }
        })
        result.skipped++
      }
    }

    // Determine overall success
    result.success = result.errors.length === 0 || 
                    (result.imported + result.updated) > 0

    // Create import records for each project affected
    const importStatus = result.errors.length === 0 ? 'success' : 
                        (result.imported + result.updated) > 0 ? 'completed_with_errors' : 'failed'
    
    const importRecordIds: string[] = []
    
    // If we have projects that were imported to, create import records
    if (projectsInImport.size > 0) {
      for (const projectId of projectsInImport) {
        const { data: importData, error: importError } = await adminSupabase
          .from('data_imports')
          .insert({
            project_id: projectId,
            import_type: 'po',
            import_status: importStatus,
            imported_by: user.id,
            file_name: file.name,
            records_processed: result.imported + result.updated,
            records_failed: result.skipped,
            error_details: result.errors.length > 0 ? { 
              errors: result.errors.slice(0, 100), // Limit stored errors
              total_errors: result.errors.length,
              line_items_created: result.lineItemsCreated
            } : null,
            metadata: {
              file_size: file.size,
              import_source: 'ics_po_log',
              total_rows: data.length,
              total_pos: poGroups.size,
              imported: result.imported,
              updated: result.updated,
              line_items_created: result.lineItemsCreated,
              project_override: projectIdOverride ? true : false
            }
          })
          .select()
          .single()

        if (!importError && importData) {
          importRecordIds.push(importData.id)
          
          // Update project's last PO import timestamp and data health status
          await adminSupabase
            .from('projects')
            .update({
              last_po_import_at: new Date().toISOString(),
              data_health_status: 'current',
              data_health_checked_at: new Date().toISOString()
            })
            .eq('id', projectId)
        }
      }
    }

    // Log import activity
    await adminSupabase.from('audit_log').insert({
      table_name: 'purchase_orders',
      record_id: user.id,
      action: 'IMPORT_ICS',
      new_values: {
        total_rows: data.length,
        total_pos: poGroups.size,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        line_items_created: result.lineItemsCreated,
        errors: result.errors.length,
        filename: file.name,
        import_record_ids: importRecordIds,
        projects_affected: Array.from(projectsInImport)
      },
      changed_by: user.id
    })

    return NextResponse.json({
      data: result,
      import_ids: importRecordIds
    })
  } catch (error) {
    console.error('Import ICS purchase orders error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}