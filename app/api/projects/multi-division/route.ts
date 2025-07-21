import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// POST /api/projects/multi-division - Create new project with multiple divisions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
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

    // Only certain roles can create projects
    const allowedRoles = ['controller', 'executive', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create projects' },
        { status: 403 }
      )
    }

    // Validate request body with division assignments
    const projectSchema = z.object({
      name: z.string().min(1).max(200),
      job_number: z.string().min(1).max(50),
      client_id: z.string().uuid(),
      division_id: z.string().uuid(), // Lead division for backward compatibility
      project_manager_id: z.string().uuid(),
      superintendent_id: z.string().uuid().optional(),
      original_contract: z.number().min(0),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      status: z.enum(['active', 'on_hold', 'completed', 'cancelled']).default('active'),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip_code: z.string().max(10).optional(),
      description: z.string().optional(),
      // Budget
      budget: z.object({
        labor_budget: z.number().min(0).default(0),
        small_tools_consumables_budget: z.number().min(0).default(0),
        materials_budget: z.number().min(0).default(0),
        equipment_budget: z.number().min(0).default(0),
        subcontracts_budget: z.number().min(0).default(0),
        other_budget: z.number().min(0).default(0),
        other_budget_description: z.string().optional(),
        notes: z.string().optional()
      }).optional(),
      // Contract breakdown
      contract_breakdown: z.object({
        client_po_number: z.string().optional(),
        client_representative: z.string().optional(),
        uses_line_items: z.boolean().default(false),
        labor_po_amount: z.number().min(0).default(0),
        materials_po_amount: z.number().min(0).default(0),
        demo_po_amount: z.number().min(0).default(0),
        contract_date: z.string().optional(),
        contract_terms: z.string().optional()
      }).optional(),
      // PO line items
      po_line_items: z.array(z.object({
        line_number: z.number().min(1),
        description: z.string().min(1),
        amount: z.number().min(0)
      })).optional(),
      // Budget breakdowns from Excel import
      budget_breakdowns: z.array(z.object({
        discipline: z.string(),
        cost_type: z.string(),
        manhours: z.number().nullable(),
        value: z.number()
      })).optional(),
      budget_source: z.enum(['manual', 'import']).optional(),
      // NEW: Division assignments
      division_assignments: z.array(z.object({
        division_id: z.string().uuid(),
        division_pm_id: z.string().uuid().optional(),
        is_lead_division: z.boolean(),
        budget_allocated: z.number().min(0).default(0)
      })).min(1)
    })

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // Ensure at least one lead division
    const hasLeadDivision = validatedData.division_assignments.some(d => d.is_lead_division)
    if (!hasLeadDivision) {
      return NextResponse.json(
        { error: 'At least one division must be marked as lead' },
        { status: 400 }
      )
    }

    // Start a transaction to create project and related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: validatedData.name,
        job_number: validatedData.job_number,
        client_id: validatedData.client_id,
        division_id: validatedData.division_id, // Lead division for backward compatibility
        project_manager_id: validatedData.project_manager_id,
        superintendent_id: validatedData.superintendent_id,
        original_contract: validatedData.original_contract,
        start_date: validatedData.start_date,
        end_date: validatedData.end_date,
        status: validatedData.status,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
        description: validatedData.description,
        created_by: user.id
      })
      .select()
      .single()

    if (projectError) {
      if (projectError.code === '23505' && projectError.message.includes('job_number')) {
        return NextResponse.json(
          { error: 'Job number already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: projectError.message }, { status: 400 })
    }

    // Create division assignments
    const divisionAssignments = validatedData.division_assignments.map(assignment => ({
      project_id: project.id,
      division_id: assignment.division_id,
      division_pm_id: assignment.division_pm_id,
      is_lead_division: assignment.is_lead_division,
      budget_allocated: assignment.budget_allocated,
      created_by: user.id
    }))

    const { error: divisionError } = await supabase
      .from('project_divisions')
      .insert(divisionAssignments)

    if (divisionError) {
      console.error('Division assignments error:', divisionError)
      // Don't fail, but log the error
    }

    // Create division budgets based on budget breakdowns
    if (validatedData.budget_breakdowns && validatedData.budget_breakdowns.length > 0) {
      // Get division discipline mappings
      const { data: mappings } = await supabase
        .from('division_discipline_mapping')
        .select('division_id, discipline_name')

      if (mappings) {
        // Group breakdowns by division
        const divisionBudgets = new Map<string, {
          labor: number
          materials: number
          equipment: number
          subcontracts: number
          other: number
        }>()

        for (const breakdown of validatedData.budget_breakdowns) {
          const mapping = mappings.find(m => m.discipline_name === breakdown.discipline)
          if (mapping) {
            if (!divisionBudgets.has(mapping.division_id)) {
              divisionBudgets.set(mapping.division_id, {
                labor: 0,
                materials: 0,
                equipment: 0,
                subcontracts: 0,
                other: 0
              })
            }

            const budget = divisionBudgets.get(mapping.division_id)!
            const costType = breakdown.cost_type.toUpperCase()

            if (costType.includes('LABOR')) {
              budget.labor += breakdown.value
            } else if (costType === 'MATERIALS') {
              budget.materials += breakdown.value
            } else if (costType === 'EQUIPMENT') {
              budget.equipment += breakdown.value
            } else if (costType === 'SUBCONTRACTS') {
              budget.subcontracts += breakdown.value
            } else {
              budget.other += breakdown.value
            }
          }
        }

        // Create division budgets
        const budgetInserts = Array.from(divisionBudgets.entries()).map(([divisionId, budget]) => ({
          project_id: project.id,
          division_id: divisionId,
          labor_budget: budget.labor,
          materials_budget: budget.materials,
          equipment_budget: budget.equipment,
          subcontracts_budget: budget.subcontracts,
          other_budget: budget.other,
          created_by: user.id
        }))

        if (budgetInserts.length > 0) {
          const { error: budgetError } = await supabase
            .from('division_budgets')
            .insert(budgetInserts)

          if (budgetError) {
            console.error('Division budgets error:', budgetError)
          }
        }
      }
    }

    // Create project budget (total) if provided
    if (validatedData.budget) {
      const { error: budgetError } = await supabase
        .from('project_budgets')
        .insert({
          project_id: project.id,
          ...validatedData.budget,
          created_by: user.id
        })

      if (budgetError) {
        console.error('Budget creation error:', budgetError)
      }
    }

    // Create contract breakdown if provided
    if (validatedData.contract_breakdown) {
      const contractData = {
        project_id: project.id,
        client_po_number: validatedData.contract_breakdown.client_po_number,
        client_representative: validatedData.contract_breakdown.client_representative,
        labor_po_amount: validatedData.contract_breakdown.labor_po_amount || 0,
        materials_po_amount: validatedData.contract_breakdown.materials_po_amount || 0,
        demo_po_amount: validatedData.contract_breakdown.demo_po_amount || 0,
        contract_date: validatedData.contract_breakdown.contract_date,
        contract_terms: validatedData.contract_breakdown.contract_terms,
        created_by: user.id
      }

      const { error: contractError } = await supabase
        .from('project_contract_breakdowns')
        .insert(contractData)

      if (contractError) {
        console.error('Contract breakdown creation error:', contractError)
      }
    }

    // Create PO line items if provided
    if (validatedData.po_line_items && validatedData.po_line_items.length > 0) {
      const lineItems = validatedData.po_line_items.map(item => ({
        project_id: project.id,
        line_number: item.line_number,
        description: item.description,
        amount: item.amount,
        created_by: user.id
      }))

      const { error: lineItemsError } = await supabase
        .from('project_po_line_items')
        .insert(lineItems)

      if (lineItemsError) {
        console.error('PO line items creation error:', lineItemsError)
      }
    }

    // Create budget breakdowns if provided (from Excel import)
    if (validatedData.budget_breakdowns && validatedData.budget_breakdowns.length > 0) {
      const importBatchId = crypto.randomUUID()
      const breakdowns = validatedData.budget_breakdowns.map(breakdown => ({
        project_id: project.id,
        discipline: breakdown.discipline,
        cost_type: breakdown.cost_type,
        manhours: breakdown.manhours,
        value: breakdown.value,
        import_source: validatedData.budget_source || 'import',
        import_batch_id: importBatchId,
        created_by: user.id
      }))

      const { error: breakdownsError } = await supabase
        .from('project_budget_breakdowns')
        .insert(breakdowns)

      if (breakdownsError) {
        console.error('Budget breakdowns creation error:', breakdownsError)
      }
    }

    // Fetch the complete project with relationships including divisions
    const { data: completeProject, error: fetchError } = await supabase
      .from('projects')
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        superintendent:profiles!projects_superintendent_id_fkey(id, first_name, last_name, email),
        project_divisions!project_divisions_project_id_fkey(
          *,
          division:divisions!project_divisions_division_id_fkey(id, name, code),
          division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email)
        )
      `)
      .eq('id', project.id)
      .single()

    if (fetchError) {
      console.error('Fetch complete project error:', fetchError)
      return NextResponse.json({ project }, { status: 201 })
    }

    return NextResponse.json({ project: completeProject }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create multi-division project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}