import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import { BudgetBreakdownImportResult } from '@/types/budget-breakdown'

// Validation schema for budget breakdown row
const budgetRowSchema = z.object({
  discipline: z.string().min(1),
  costType: z.string().min(1),
  manhours: z.union([z.number(), z.string()]).optional().nullable(),
  value: z.union([z.number(), z.string()]),
  description: z.string().optional().nullable()
})

// Helper function to parse numeric value
function parseNumericValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  
  // Remove any formatting (commas, dollar signs, etc.)
  const cleaned = value.toString().replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to normalize column names
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Map Excel column names to our schema
function mapExcelColumns(row: Record<string, unknown>): Record<string, unknown> {
  const columnMappings: Record<string, string[]> = {
    discipline: ['discipline', 'work_discipline', 'category', 'work_category'],
    costType: ['cost_type', 'costtype', 'type', 'cost_category', 'costcategory'],
    manhours: ['manhours', 'man_hours', 'hours', 'mh', 'estimated_hours'],
    value: ['value', 'amount', 'cost', 'total', 'budget', 'dollars'],
    description: ['description', 'desc', 'notes', 'comments']
  }

  const mapped: Record<string, unknown> = {}

  // Try to map each field
  for (const [targetField, possibleNames] of Object.entries(columnMappings)) {
    for (const key of Object.keys(row)) {
      const normalizedKey = normalizeColumnName(key)
      if (possibleNames.includes(normalizedKey)) {
        mapped[targetField] = row[key]
        break
      }
    }
  }

  return mapped
}

// POST /api/project-budget-breakdowns/import - Import budget breakdowns from Excel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is controller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'controller') {
      return NextResponse.json({ error: 'Only controllers can import budget breakdowns' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const clearExisting = formData.get('clearExisting') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Check project access
    // NOTE: Access control is disabled in development (RLS disabled via migration 00011)
    // Uncomment this block when re-enabling RLS for production
    /*
    const { data: hasAccess } = await supabase
      .rpc('user_has_project_access', { p_project_id: projectId })
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }
    */

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    // Look for BUDGETS sheet first, fallback to first sheet
    let worksheetName = workbook.SheetNames[0]
    if (workbook.SheetNames.includes('BUDGETS')) {
      worksheetName = 'BUDGETS'
    }
    const worksheet = workbook.Sheets[worksheetName]
    
    // Check if we should use positional parsing (for BUDGETS sheet format)
    const usePositionalParsing = worksheetName === 'BUDGETS'
    
    if (usePositionalParsing) {
      // Use same parsing logic as new project creation
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      const rows: unknown[][] = []
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row: unknown[] = []
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = worksheet[cellAddress]
          // Use formatted value (w) if available, otherwise raw value (v)
          row.push(cell ? (cell.w || cell.v) : undefined)
        }
        rows.push(row)
      }
      
      // Process budget data using positional format
      const rowsMap = new Map<string, {
        project_id: string
        discipline: string
        cost_type: string
        manhours: number | null
        value: number
        import_source: string
        import_batch_id: string
        created_by: string
      }>()
      const importBatchId = crypto.randomUUID()
      let currentDiscipline = ''
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        // Clean and extract cell values
        const disciplineName = row[1] ? String(row[1]).trim() : ''
        const description = row[3] ? String(row[3]).trim() : ''
        const manhours = row[4]
        const value = row[5]
        
        // Update current discipline immediately when found
        if (disciplineName) {
          currentDiscipline = disciplineName.toUpperCase()
          console.log(`Row ${i + 1}: Found discipline: "${currentDiscipline}"`)
        }
        
        // Skip rows without critical data
        if (!description || value === undefined || value === null || value === '') continue
        
        if (!currentDiscipline) continue
        
        if (description.toUpperCase().includes('TOTAL') || 
            description.toUpperCase() === 'ALL LABOR') continue
        
        // Parse numeric values more robustly
        let numericValue = 0
        if (typeof value === 'number') {
          numericValue = value
        } else if (value) {
          // Handle formats like " $-   " or "$0.00"
          const cleaned = String(value).replace(/[$,\s]/g, '').replace(/-+$/, '0')
          numericValue = parseFloat(cleaned) || 0
        }
        
        const numericManhours = manhours ? (typeof manhours === 'number' ? manhours : parseFloat(String(manhours).replace(/[$,]/g, '') || '0')) : null
        
        if (numericValue < 0) continue
        
        const costType = description.trim().toUpperCase()
        const key = `${projectId}_${currentDiscipline}_${costType}`
        
        // If duplicate exists, sum the values
        if (rowsMap.has(key)) {
          console.log(`Duplicate found for: ${currentDiscipline} - ${costType}, summing values`)
          const existing = rowsMap.get(key)!
          rowsMap.set(key, {
            ...existing,
            value: existing.value + numericValue,
            manhours: (existing.manhours || 0) + (numericManhours || 0) || null
          })
        } else {
          rowsMap.set(key, {
            project_id: projectId,
            discipline: currentDiscipline,
            cost_type: costType,
            manhours: numericManhours,
            value: numericValue,
            import_source: 'excel_import',
            import_batch_id: importBatchId,
            created_by: user.id
          })
          
          if (numericValue === 0) {
            console.log(`Row ${i + 1}: Added zero-value item: ${costType} for ${currentDiscipline}`)
          }
        }
      }
      
      // Convert map to array
      const validRows = Array.from(rowsMap.values())
      
      // Clear existing breakdowns if requested
      if (clearExisting) {
        const { error: deleteError } = await adminSupabase
          .from('project_budget_breakdowns')
          .delete()
          .eq('project_id', projectId)

        if (deleteError) {
          console.error('Error clearing existing breakdowns:', deleteError)
          return NextResponse.json({ 
            error: 'Failed to clear existing breakdowns',
            details: deleteError.message 
          }, { status: 400 })
        }
      }

      // Insert valid rows using admin client to bypass RLS
      const { data: inserted, error: insertError } = await adminSupabase
        .from('project_budget_breakdowns')
        .upsert(validRows, {
          onConflict: 'project_id,discipline,cost_type',
          ignoreDuplicates: false
        })
        .select()

      if (insertError) {
        console.error('Error inserting budget breakdowns:', insertError)
        return NextResponse.json({
          error: 'Database error: ' + insertError.message
        }, { status: 400 })
      }

      return NextResponse.json({
        message: 'Import completed successfully',
        data: {
          success: true,
          imported: inserted?.length || 0,
          updated: 0,
          skipped: rows.length - 1 - validRows.length,
          errors: []
        }
      })
    }
    
    // Otherwise use the existing JSON parsing logic
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null })

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json({ error: 'No data found in Excel file' }, { status: 400 })
    }

    // Process and validate rows
    const result: BudgetBreakdownImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }

    const rowsMap = new Map<string, {
      project_id: string
      discipline: string
      cost_type: string
      manhours: number | null
      value: number
      description: string | null | undefined
      import_source: string
      import_batch_id: string
      created_by: string
    }>()
    const importBatchId = crypto.randomUUID()

    for (let i = 0; i < jsonData.length; i++) {
      const rowNumber = i + 2 // Excel rows start at 1, plus header row
      const rawRow = jsonData[i] as Record<string, unknown>
      
      try {
        // Map Excel columns to our schema
        const mappedRow = mapExcelColumns(rawRow)

        // Skip empty rows
        if (!mappedRow.discipline && !mappedRow.costType) {
          result.skipped++
          continue
        }

        // Validate the row
        const validatedRow = budgetRowSchema.parse({
          discipline: mappedRow.discipline,
          costType: mappedRow.costType,
          manhours: mappedRow.manhours ? parseNumericValue(mappedRow.manhours) : null,
          value: parseNumericValue(mappedRow.value),
          description: mappedRow.description
        })

        // Skip rows with negative values (but allow zero)
        if (validatedRow.value < 0) {
          result.skipped++
          continue
        }

        const discipline = validatedRow.discipline.toUpperCase()
        const costType = validatedRow.costType.toUpperCase()
        const key = `${projectId}_${discipline}_${costType}`

        // If duplicate exists, sum the values
        if (rowsMap.has(key)) {
          console.log(`Duplicate found for: ${discipline} - ${costType}, summing values`)
          const existing = rowsMap.get(key)!
          rowsMap.set(key, {
            ...existing,
            value: existing.value + validatedRow.value,
            manhours: (existing.manhours || 0) + (validatedRow.manhours || 0) || null,
            description: existing.description || validatedRow.description
          })
        } else {
          rowsMap.set(key, {
            project_id: projectId,
            discipline: discipline,
            cost_type: costType,
            manhours: validatedRow.manhours,
            value: validatedRow.value,
            description: validatedRow.description,
            import_source: 'excel_import',
            import_batch_id: importBatchId,
            created_by: user.id
          })
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Validation error',
          data: rawRow
        })
      }
    }

    // Convert map to array
    const validRows = Array.from(rowsMap.values())

    // If no valid rows, return error
    if (validRows.length === 0) {
      result.success = false
      return NextResponse.json({ 
        error: 'No valid budget breakdown data found',
        data: result 
      }, { status: 400 })
    }

    // Clear existing breakdowns if requested
    if (clearExisting) {
      const { error: deleteError } = await adminSupabase
        .from('project_budget_breakdowns')
        .delete()
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('Error clearing existing breakdowns:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to clear existing breakdowns',
          details: deleteError.message 
        }, { status: 400 })
      }
    }

    // Insert valid rows using admin client to bypass RLS
    const { data: inserted, error: insertError } = await adminSupabase
      .from('project_budget_breakdowns')
      .upsert(validRows, {
        onConflict: 'project_id,discipline,cost_type',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('Error inserting budget breakdowns:', insertError)
      result.success = false
      result.errors.push({
        row: 0,
        message: 'Database error: ' + insertError.message
      })
    } else {
      result.imported = inserted?.length || 0
    }

    return NextResponse.json({
      message: result.success ? 'Import completed successfully' : 'Import completed with errors',
      data: result
    })
  } catch (error) {
    console.error('Import budget breakdowns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}