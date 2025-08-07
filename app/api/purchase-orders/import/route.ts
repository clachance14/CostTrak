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

// POST /api/purchase-orders/import - Import ICS PO Log CSV (OPTIMIZED)
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('Starting optimized PO import...')
  
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
    const projectIdOverride = formData.get('project_id') as string | null

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
        header: 1
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
    }).filter(row => row['Job No.'] && row['PO Number'])

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No valid data rows found in file' },
        { status: 400 }
      )
    }

    console.log(`Processing ${data.length} rows from CSV...`)

    // Initialize result tracking
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      lineItemsCreated: 0,
      errors: []
    }

    // OPTIMIZATION: Fetch all projects at once
    const { data: projects } = await supabase
      .from('projects')
      .select('id, job_number')

    const projectMap = new Map(
      projects?.map(p => [p.job_number, p.id]) || []
    )

    // Group rows by Job No. + PO Number to aggregate line items
    const poGroups = new Map<string, ICSRow[]>()
    const projectsInImport = new Set<string>()
    
    // First pass: validate and group data
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const dataRowNumber = i + 4

      try {
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

    console.log(`Grouped into ${poGroups.size} unique POs`)

    // OPTIMIZATION: Prepare all PO data first
    interface POData {
      project_id: string
      po_number: string
      vendor_name: string
      description: string
      po_value: number
      committed_amount: number
      total_amount: number
      invoiced_amount?: number
      status: 'draft' | 'approved' | 'cancelled' | 'completed'
      generation_date: string | null
      requestor: string
      sub_cost_code: string
      contract_extra_type: string
      wo_pmo: string
      cost_center: string
      budget_category: string | null
      sub_cc: string
      subsub_cc: string
      fto_sent_date: string | null
      fto_return_date: string | null
      bb_date: string | null
      created_by: string
      updated_at: string
      id?: string
    }
    
    interface LineItemData {
      po_key: string
      line_number: number
      description: string
      total_amount: number
      invoice_ticket: string
      invoice_date: string | null
      contract_extra_type: string
      material_description: string
      category: string
    }
    
    const posToProcess: POData[] = []
    const poLineItemsMap = new Map<string, LineItemData[]>()
    const poNumberToProjectId = new Map<string, string>()

    for (const [groupKey, rows] of poGroups) {
      const firstRow = rows[0]
      const jobNo = firstRow['Job No.'].trim()
      const cleanedPONumber = cleanPONumber(firstRow['PO Number'])

      // Determine project ID
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
      
      projectsInImport.add(projectId)
      poNumberToProjectId.set(`${projectId}-${cleanedPONumber}`, projectId)

      // Get the PO value from the CSV
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
        po_value: poValue,
        committed_amount: poValue,
        total_amount: 0,
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
        created_by: user.id,
        updated_at: new Date().toISOString()
      }

      posToProcess.push(poData)

      // Prepare line items
      const lineItems = []
      let totalInvoicedAmount = 0
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const invoiceTicket = row['Invoice/Ticket']
        
        if (invoiceTicket && invoiceTicket.trim() !== '') {
          const lineItemValue = parseNumericValue(row['Line Item Value'])
          totalInvoicedAmount += lineItemValue
          
          lineItems.push({
            po_key: `${projectId}-${cleanedPONumber}`,
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

      // Store line items and update PO with invoiced amount
      if (lineItems.length > 0) {
        poLineItemsMap.set(`${projectId}-${cleanedPONumber}`, lineItems)
        poData.invoiced_amount = totalInvoicedAmount
        poData.total_amount = totalInvoicedAmount
      }
    }

    console.log(`Prepared ${posToProcess.length} POs for processing`)

    // OPTIMIZATION: Batch check for existing POs
    const poIdentifiers = posToProcess.map(po => ({
      project_id: po.project_id,
      po_number: po.po_number
    }))

    console.log('Fetching existing POs in batch...')
    const checkStart = Date.now()
    
    // Build a query to get all existing POs in one go
    // Include committed_amount and po_value to check for manual edits
    const { data: existingPOs } = await adminSupabase
      .from('purchase_orders')
      .select('id, project_id, po_number, committed_amount, po_value')
      .or(poIdentifiers.map(p => 
        `and(project_id.eq.${p.project_id},po_number.eq.${p.po_number})`
      ).join(','))

    console.log(`Batch check completed in ${Date.now() - checkStart}ms`)

    // Create lookup map for existing POs with their current values
    interface ExistingPOData {
      id: string
      committed_amount: number | null
      po_value: number | null
    }
    
    const existingPOMap = new Map<string, ExistingPOData>(
      existingPOs?.map(po => [
        `${po.project_id}-${po.po_number}`, 
        { 
          id: po.id, 
          committed_amount: po.committed_amount,
          po_value: po.po_value 
        }
      ]) || []
    )

    // Separate POs into updates and inserts
    const posToUpdate: POData[] = []
    const posToInsert: POData[] = []
    const existingPOIds: string[] = []

    for (const poData of posToProcess) {
      const key = `${poData.project_id}-${poData.po_number}`
      const existingPOData = existingPOMap.get(key)
      
      if (existingPOData) {
        // For existing POs, check if committed_amount has been manually edited
        const hasManualEdit = existingPOData.committed_amount !== null && 
                             existingPOData.po_value !== null &&
                             existingPOData.committed_amount !== existingPOData.po_value
        
        // If user has manually edited committed_amount, preserve it
        const updateData = { ...poData, id: existingPOData.id }
        if (hasManualEdit) {
          // Preserve the user's manual edit to committed_amount
          updateData.committed_amount = existingPOData.committed_amount
          console.log(`Preserving manual edit for PO ${poData.po_number}: committed_amount = ${existingPOData.committed_amount}`)
        }
        
        posToUpdate.push(updateData)
        existingPOIds.push(existingPOData.id)
        result.updated++
      } else {
        posToInsert.push(poData)
        result.imported++
      }
    }

    console.log(`Will update ${posToUpdate.length} existing POs and insert ${posToInsert.length} new POs`)

    // OPTIMIZATION: Batch update existing POs
    if (posToUpdate.length > 0) {
      console.log('Batch updating existing POs...')
      const updateStart = Date.now()
      
      // Use a transaction for batch updates
      for (const batch of chunk(posToUpdate, 100)) {
        const updatePromises = batch.map(po => 
          adminSupabase
            .from('purchase_orders')
            .update({
              vendor_name: po.vendor_name,
              description: po.description,
              po_value: po.po_value,
              committed_amount: po.committed_amount,
              total_amount: po.total_amount,
              invoiced_amount: po.invoiced_amount,
              status: po.status,
              generation_date: po.generation_date,
              requestor: po.requestor,
              sub_cost_code: po.sub_cost_code,
              contract_extra_type: po.contract_extra_type,
              wo_pmo: po.wo_pmo,
              cost_center: po.cost_center,
              budget_category: po.budget_category,
              sub_cc: po.sub_cc,
              subsub_cc: po.subsub_cc,
              fto_sent_date: po.fto_sent_date,
              fto_return_date: po.fto_return_date,
              bb_date: po.bb_date,
              updated_at: po.updated_at
            })
            .eq('id', po.id)
        )
        
        await Promise.all(updatePromises)
      }
      
      console.log(`Batch update completed in ${Date.now() - updateStart}ms`)
    }

    // OPTIMIZATION: Batch insert new POs
    if (posToInsert.length > 0) {
      console.log('Batch inserting new POs...')
      const insertStart = Date.now()
      
      const { data: insertedPOs, error: insertError } = await adminSupabase
        .from('purchase_orders')
        .insert(posToInsert)
        .select('id, project_id, po_number')

      if (insertError) {
        console.error('Batch insert error:', insertError)
        result.errors.push({
          row: 0,
          message: `Failed to batch insert POs: ${insertError.message}`
        })
      } else if (insertedPOs) {
        // Add new PO IDs to the map for line item processing
        insertedPOs.forEach(po => {
          existingPOMap.set(`${po.project_id}-${po.po_number}`, {
            id: po.id,
            committed_amount: null,
            po_value: null
          })
        })
      }
      
      console.log(`Batch insert completed in ${Date.now() - insertStart}ms`)
    }

    // OPTIMIZATION: Batch delete old line items for updated POs
    if (existingPOIds.length > 0) {
      console.log('Batch deleting old line items...')
      const deleteStart = Date.now()
      
      const { error: deleteError } = await adminSupabase
        .from('po_line_items')
        .delete()
        .in('purchase_order_id', existingPOIds)

      if (deleteError) {
        console.error('Error deleting line items:', deleteError)
      }
      
      console.log(`Batch delete completed in ${Date.now() - deleteStart}ms`)
    }

    // OPTIMIZATION: Batch insert all line items
    interface DBLineItem {
      purchase_order_id: string
      line_number: number
      description: string
      total_amount: number
      invoice_ticket: string
      invoice_date: string | null
      contract_extra_type: string
      material_description: string
      category: string
    }
    
    const allLineItems: DBLineItem[] = []
    
    for (const [poKey, lineItems] of poLineItemsMap) {
      const poData = existingPOMap.get(poKey)
      if (poData) {
        lineItems.forEach(item => {
          allLineItems.push({
            purchase_order_id: poData.id,
            line_number: item.line_number,
            description: item.description,
            total_amount: item.total_amount,
            invoice_ticket: item.invoice_ticket,
            invoice_date: item.invoice_date,
            contract_extra_type: item.contract_extra_type,
            material_description: item.material_description,
            category: item.category
          })
        })
      }
    }

    if (allLineItems.length > 0) {
      console.log(`Batch inserting ${allLineItems.length} line items...`)
      const lineItemStart = Date.now()
      
      // Insert in chunks to avoid overwhelming the database
      for (const batch of chunk(allLineItems, 500)) {
        const { error: lineItemError } = await adminSupabase
          .from('po_line_items')
          .insert(batch)

        if (lineItemError) {
          console.error('Error inserting line items batch:', lineItemError)
          result.errors.push({
            row: 0,
            message: `Failed to insert line items: ${lineItemError.message}`
          })
        } else {
          result.lineItemsCreated += batch.length
        }
      }
      
      console.log(`Line items inserted in ${Date.now() - lineItemStart}ms`)
    }

    // Create import records
    const importStatus = result.errors.length === 0 ? 'success' : 
                        (result.imported + result.updated) > 0 ? 'completed_with_errors' : 'failed'
    
    const importRecordIds: string[] = []
    
    if (projectsInImport.size > 0) {
      for (const projectId of projectsInImport) {
        const { data: importData } = await adminSupabase
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
              errors: result.errors.slice(0, 100),
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
              project_override: projectIdOverride ? true : false,
              processing_time_ms: Date.now() - startTime
            }
          })
          .select()
          .single()

        if (importData) {
          importRecordIds.push(importData.id)
          
          // Update project's last PO import timestamp
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
      action: 'IMPORT_ICS_OPTIMIZED',
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
        projects_affected: Array.from(projectsInImport),
        processing_time_ms: Date.now() - startTime
      },
      changed_by: user.id
    })

    const totalTime = Date.now() - startTime
    console.log(`Import completed in ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`)
    console.log(`Performance: ${(poGroups.size / (totalTime / 1000)).toFixed(1)} POs/second`)

    return NextResponse.json({
      data: {
        ...result,
        performance: {
          total_time_ms: totalTime,
          pos_per_second: poGroups.size / (totalTime / 1000)
        }
      },
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

// Helper function to chunk arrays for batch processing
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}