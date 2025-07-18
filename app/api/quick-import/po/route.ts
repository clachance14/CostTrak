import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        import_type: 'po',
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

    // Read file content
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid')
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim())
    
    // Map headers to expected fields
    const headerMap = new Map<string, number>()
    headers.forEach((header, index) => {
      headerMap.set(header.toLowerCase().replace(/[^a-z0-9]/g, ''), index)
    })

    let recordsProcessed = 0
    let recordsFailed = 0
    const errors: any[] = []

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim())
        
        // Extract PO data based on common formats
        const poNumber = values[headerMap.get('ponumber') || headerMap.get('po') || 0]
        const vendor = values[headerMap.get('vendor') || headerMap.get('vendorname') || 1]
        const amount = parseFloat(values[headerMap.get('amount') || headerMap.get('total') || headerMap.get('povalue') || 2] || '0')
        const description = values[headerMap.get('description') || headerMap.get('scope') || 3]
        
        if (!poNumber || !vendor) {
          errors.push({ row: i + 1, error: 'Missing PO number or vendor' })
          recordsFailed++
          continue
        }

        // Check if PO already exists
        const { data: existing } = await supabase
          .from('purchase_orders')
          .select('id')
          .eq('po_number', poNumber)
          .eq('project_id', projectId)
          .single()

        if (existing) {
          // Update existing PO
          await supabase
            .from('purchase_orders')
            .update({
              vendor_name: vendor,
              total_amount: amount,
              po_value: amount,
              committed_amount: amount,
              description: description || undefined,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          // Create new PO
          await supabase
            .from('purchase_orders')
            .insert({
              project_id: projectId,
              po_number: poNumber,
              vendor_name: vendor,
              vendor: vendor,
              total_amount: amount,
              po_value: amount,
              committed_amount: amount,
              description: description,
              status: 'approved',
              order_date: new Date().toISOString().split('T')[0],
              created_by: user.id
            })
        }

        recordsProcessed++
      } catch (error: any) {
        console.error('Error processing row:', error)
        errors.push({ row: i + 1, error: error.message })
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

    // Note: The database trigger 'update_project_on_import' will automatically update
    // the project's last_po_import_at timestamp when the import status is 'success'

    return NextResponse.json({
      success: true,
      import_id: importRecord.id,
      records_processed: recordsProcessed,
      records_failed: recordsFailed,
      errors: errors.slice(0, 10) // Return first 10 errors
    })
  } catch (error: any) {
    console.error('Error in PO import:', error)
    
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