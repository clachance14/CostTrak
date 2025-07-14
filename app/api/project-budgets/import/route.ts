import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import * as XLSX from 'xlsx'

// Validation schema for budget breakdown row
const budgetRowSchema = z.object({
  discipline: z.string().min(1),
  description: z.string(),
  manhours: z.number().nullable(),
  value: z.number()
})

type BudgetRow = z.infer<typeof budgetRowSchema>

// Map cost types to budget categories
const costTypeMapping: Record<string, keyof BudgetCategory> = {
  'DIRECT LABOR': 'labor',
  'INDIRECT LABOR': 'labor',
  'MATERIALS': 'materials',
  'EQUIPMENT': 'equipment',
  'SUBCONTRACTS': 'subcontracts',
  'SMALL TOOLS & CONSUMABLES': 'small_tools_consumables',
  'TAXES & INSURANCE': 'other',
  'PERDIEM': 'other',
  'PER DIEM': 'other',
  'ADD ONS': 'other',
  'RISK': 'other'
}

interface BudgetCategory {
  labor: number
  materials: number
  equipment: number
  subcontracts: number
  small_tools_consumables: number
  other: number
}

interface ImportResult {
  success: boolean
  project_id: string
  total_budget: number
  breakdown_rows_created: number
  budget_created: boolean
  budget_updated: boolean
  errors: Array<{
    row: number
    message: string
    data?: unknown
  }>
}

// Helper function to parse numeric value from Excel
function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Helper function to check if a row is a total row that should be skipped
function isTotalRow(description: string): boolean {
  const upperDesc = description.toUpperCase()
  return upperDesc.includes('TOTAL') || 
         upperDesc === 'ALL LABOR' ||
         upperDesc.includes('DISCIPLINE TOTAL')
}

// POST /api/project-budgets/import - Import budget breakdown from Excel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // User is authenticated, proceed with import

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('project_id') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'No project ID provided' },
        { status: 400 }
      )
    }

    // Verify project exists
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel file
    let worksheet: XLSX.WorkSheet
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      
      // Check if BUDGETS sheet exists
      if (!workbook.SheetNames.includes('BUDGETS')) {
        return NextResponse.json(
          { error: 'No BUDGETS sheet found in Excel file. Please ensure your file contains a sheet named "BUDGETS".' },
          { status: 400 }
        )
      }
      
      worksheet = workbook.Sheets['BUDGETS']
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse Excel file' },
        { status: 400 }
      )
    }

    // Convert to array of arrays to handle merged cells
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const rows: unknown[][] = []
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row: unknown[] = []
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = worksheet[cellAddress]
        row.push(cell ? cell.v : undefined)
      }
      rows.push(row)
    }

    // Initialize result tracking
    const result: ImportResult = {
      success: true,
      project_id: projectId,
      total_budget: 0,
      breakdown_rows_created: 0,
      budget_created: false,
      budget_updated: false,
      errors: []
    }

    // Process rows and extract budget data
    const breakdownRows: Array<{
      discipline: string
      cost_type: string
      manhours: number | null
      value: number
      percentage_of_discipline: number | null
      cost_per_direct_manhour: number | null
      cost_per_indirect_manhour: number | null
      cost_per_total_manhour: number | null
    }> = []

    const budgetTotals: BudgetCategory = {
      labor: 0,
      materials: 0,
      equipment: 0,
      subcontracts: 0,
      small_tools_consumables: 0,
      other: 0
    }

    const otherDescriptions: string[] = []
    let currentDiscipline = ''
    
    // Skip header row, start from row 2 (index 1)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1 // Excel row numbers are 1-based
      
      // Extract values from expected columns
      // A: Discipline Number, B: Discipline Name, C: Cost Code, D: Description
      // E: Manhours, F: Value, G-J: Percentages and rates
      const disciplineNum = row[0]
      const disciplineName = row[1]
      const description = row[3]?.toString() || ''
      const manhours = row[4]
      const value = row[5]
      
      // Skip empty rows
      if (!description || !value) continue
      
      // Update current discipline if a new one is found
      if (disciplineName && typeof disciplineName === 'string' && disciplineName.trim()) {
        currentDiscipline = disciplineName.trim().toUpperCase()
      }
      
      // Skip if no discipline has been set yet
      if (!currentDiscipline) continue
      
      // Skip total rows
      if (isTotalRow(description)) continue
      
      try {
        const costType = description.trim().toUpperCase()
        const numericValue = parseNumericValue(value)
        const numericManhours = manhours ? parseNumericValue(manhours) : null
        
        // Add to breakdown rows for detailed storage
        breakdownRows.push({
          discipline: currentDiscipline,
          cost_type: costType,
          manhours: numericManhours,
          value: numericValue,
          percentage_of_discipline: row[6] ? parseNumericValue(row[6]) : null,
          cost_per_direct_manhour: row[7] ? parseNumericValue(row[7]) : null,
          cost_per_indirect_manhour: row[8] ? parseNumericValue(row[8]) : null,
          cost_per_total_manhour: row[9] ? parseNumericValue(row[9]) : null
        })
        
        // Map to budget category and accumulate
        const category = costTypeMapping[costType]
        if (category) {
          budgetTotals[category] += numericValue
          
          // Track other descriptions
          if (category === 'other' && !otherDescriptions.includes(costType)) {
            otherDescriptions.push(costType)
          }
        } else {
          // If no mapping found, put in other category
          budgetTotals.other += numericValue
          if (!otherDescriptions.includes(costType)) {
            otherDescriptions.push(costType)
          }
        }
        
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Failed to parse row',
          data: row
        })
      }
    }

    if (breakdownRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid budget data found in file' },
        { status: 400 }
      )
    }

    // Calculate total budget
    result.total_budget = Object.values(budgetTotals).reduce((sum, val) => sum + val, 0)

    // Generate import batch ID
    const importBatchId = crypto.randomUUID()

    // Start transaction
    try {
      // Check if budget already exists
      const { data: existingBudget } = await adminSupabase
        .from('project_budgets')
        .select('id')
        .eq('project_id', projectId)
        .single()

      const budgetData = {
        project_id: projectId,
        labor_budget: budgetTotals.labor,
        small_tools_consumables_budget: budgetTotals.small_tools_consumables,
        materials_budget: budgetTotals.materials,
        equipment_budget: budgetTotals.equipment,
        subcontracts_budget: budgetTotals.subcontracts,
        other_budget: budgetTotals.other,
        other_budget_description: otherDescriptions.join(', '),
        budget_status: 'draft',
        notes: `Imported from Excel: ${file.name}`,
        created_by: user.id
      }

      if (existingBudget) {
        // Update existing budget
        const { error: updateError } = await adminSupabase
          .from('project_budgets')
          .update({
            ...budgetData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBudget.id)

        if (updateError) throw updateError
        result.budget_updated = true
        
        // Delete existing breakdown rows for this project
        await adminSupabase
          .from('project_budget_breakdowns')
          .delete()
          .eq('project_id', projectId)
      } else {
        // Create new budget
        const { error: insertError } = await adminSupabase
          .from('project_budgets')
          .insert(budgetData)

        if (insertError) throw insertError
        result.budget_created = true
      }

      // Insert breakdown rows
      const breakdownInserts = breakdownRows.map(row => ({
        project_id: projectId,
        discipline: row.discipline,
        cost_type: row.cost_type,
        manhours: row.manhours,
        value: row.value,
        percentage_of_discipline: row.percentage_of_discipline,
        cost_per_direct_manhour: row.cost_per_direct_manhour,
        cost_per_indirect_manhour: row.cost_per_indirect_manhour,
        cost_per_total_manhour: row.cost_per_total_manhour,
        import_batch_id: importBatchId,
        created_by: user.id
      }))

      const { error: breakdownError } = await adminSupabase
        .from('project_budget_breakdowns')
        .insert(breakdownInserts)

      if (breakdownError) throw breakdownError
      
      result.breakdown_rows_created = breakdownRows.length

      // Log import activity
      await adminSupabase.from('audit_log').insert({
        table_name: 'project_budgets',
        record_id: projectId,
        action: 'IMPORT_BUDGET',
        new_values: {
          total_budget: result.total_budget,
          breakdown_rows: result.breakdown_rows_created,
          budget_categories: budgetTotals,
          import_batch_id: importBatchId,
          filename: file.name
        },
        changed_by: user.id
      })

    } catch (error) {
      console.error('Budget import transaction error:', error)
      result.success = false
      result.errors.push({
        row: 0,
        message: 'Failed to save budget data: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    }

    return NextResponse.json({
      data: result
    })
  } catch (error) {
    console.error('Import budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}