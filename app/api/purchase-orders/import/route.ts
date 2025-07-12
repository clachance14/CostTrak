import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import * as XLSX from 'xlsx'

// Validation schema for CSV row
const csvRowSchema = z.object({
  project_job_number: z.string().min(1),
  po_number: z.string().min(1),
  vendor_name: z.string().min(1),
  description: z.string().optional().default(''),
  committed_amount: z.number().min(0),
  invoiced_amount: z.number().min(0).optional().default(0),
  status: z.enum(['draft', 'approved', 'closed', 'cancelled']).optional().default('approved'),
  issue_date: z.string().optional(),
  expected_delivery: z.string().optional()
})

type CSVRow = z.infer<typeof csvRowSchema>

interface ImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: any
  }>
}

// POST /api/purchase-orders/import - Bulk import POs from CSV
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

    // Parse CSV/Excel file
    let data: any[]
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', dateNF: 'yyyy-mm-dd' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        dateNF: 'yyyy-mm-dd'
      })
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Failed to parse file. Please ensure it is a valid CSV or Excel file.' },
        { status: 400 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      )
    }

    // Initialize result tracking
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
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

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 2 // Excel rows start at 1, plus header

      try {
        // Convert numeric fields
        const processedRow = {
          ...row,
          committed_amount: parseFloat(row.committed_amount || '0'),
          invoiced_amount: parseFloat(row.invoiced_amount || '0')
        }

        // Validate row data
        const validatedRow = csvRowSchema.parse(processedRow)

        // Find project by job number or use override
        let projectId: string | undefined
        if (projectIdOverride) {
          projectId = projectIdOverride
        } else {
          projectId = projectMap.get(validatedRow.project_job_number)
          if (!projectId) {
            result.errors.push({
              row: rowNumber,
              field: 'project_job_number',
              message: `Project with job number '${validatedRow.project_job_number}' not found`,
              data: row
            })
            result.skipped++
            continue
          }
        }

        // Check if PO already exists (upsert logic)
        const { data: existingPO } = await adminSupabase
          .from('purchase_orders')
          .select('id, committed_amount, invoiced_amount')
          .eq('project_id', projectId)
          .eq('po_number', validatedRow.po_number)
          .is('deleted_at', null)
          .single()

        if (existingPO) {
          // Update existing PO
          const { error: updateError } = await adminSupabase
            .from('purchase_orders')
            .update({
              vendor_name: validatedRow.vendor_name,
              description: validatedRow.description,
              committed_amount: validatedRow.committed_amount,
              invoiced_amount: validatedRow.invoiced_amount,
              status: validatedRow.status,
              issue_date: validatedRow.issue_date || null,
              expected_delivery: validatedRow.expected_delivery || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPO.id)

          if (updateError) {
            result.errors.push({
              row: rowNumber,
              message: `Failed to update PO: ${updateError.message}`,
              data: row
            })
            result.skipped++
          } else {
            result.updated++
          }
        } else {
          // Create new PO
          const { error: insertError } = await adminSupabase
            .from('purchase_orders')
            .insert({
              project_id: projectId,
              po_number: validatedRow.po_number,
              vendor_name: validatedRow.vendor_name,
              description: validatedRow.description,
              committed_amount: validatedRow.committed_amount,
              invoiced_amount: validatedRow.invoiced_amount,
              status: validatedRow.status,
              issue_date: validatedRow.issue_date || null,
              expected_delivery: validatedRow.expected_delivery || null,
              created_by: user.id
            })

          if (insertError) {
            if (insertError.code === '23505') {
              result.errors.push({
                row: rowNumber,
                message: 'Duplicate PO number for this project',
                data: row
              })
            } else {
              result.errors.push({
                row: rowNumber,
                message: `Failed to create PO: ${insertError.message}`,
                data: row
              })
            }
            result.skipped++
          } else {
            result.imported++
          }
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          result.errors.push({
            row: rowNumber,
            message: 'Validation error',
            field: error.errors[0]?.path[0]?.toString(),
            data: row
          })
        } else {
          result.errors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: row
          })
        }
        result.skipped++
      }
    }

    // Determine overall success
    result.success = result.errors.length === 0 || 
                    (result.imported + result.updated) > 0

    // Log import activity
    await adminSupabase.from('audit_log').insert({
      table_name: 'purchase_orders',
      record_id: user.id,
      action: 'IMPORT',
      new_values: {
        total_rows: data.length,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        filename: file.name
      },
      changed_by: user.id
    })

    return NextResponse.json({
      data: result
    })
  } catch (error) {
    console.error('Import purchase orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}