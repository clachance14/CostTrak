import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/projects - List projects with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const divisionId = searchParams.get('division_id')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = searchParams.get('limit') === 'all' ? null : parseInt(searchParams.get('limit') || '20')
    const sort_by = searchParams.get('sort_by')
    const sort_direction = searchParams.get('sort_direction')
    
    // Get column filters
    const columnFilters = new Map<string, string[]>()
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter_')) {
        const column = key.replace('filter_', '')
        columnFilters.set(column, value.split(','))
      }
    }
    
    const offset = limit ? (page - 1) * limit : 0

    // Build query - simplified to isolate issue
    let query = supabase
      .from('projects')
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
      `, { count: 'exact' })
      .is('deleted_at', null)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (divisionId) {
      query = query.eq('division_id', divisionId)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,job_number.ilike.%${search}%`)
    }
    
    // Apply column filters
    for (const [column, values] of columnFilters.entries()) {
      if (values.length > 0) {
        // Handle special cases for amount ranges
        if (column === 'original_contract' || column === 'revised_contract') {
          const orConditions = []
          for (const value of values) {
            switch (value) {
              case '$0':
                orConditions.push(`${column}.eq.0`)
                break
              case '< $1M':
                orConditions.push(`${column}.gt.0,${column}.lt.1000000`)
                break
              case '$1M - $5M':
                orConditions.push(`${column}.gte.1000000,${column}.lt.5000000`)
                break
              case '$5M - $10M':
                orConditions.push(`${column}.gte.5000000,${column}.lt.10000000`)
                break
              case '$10M - $50M':
                orConditions.push(`${column}.gte.10000000,${column}.lt.50000000`)
                break
              case '> $50M':
                orConditions.push(`${column}.gte.50000000`)
                break
              case '':
                orConditions.push(`${column}.is.null`)
                break
            }
          }
          if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
          }
        } else {
          // Handle empty values (blanks)
          const hasEmpty = values.includes('')
          const nonEmptyValues = values.filter(v => v !== '')
          
          if (hasEmpty && nonEmptyValues.length > 0) {
            query = query.or(`${column}.is.null,${column}.eq.,${column}.in.(${nonEmptyValues.join(',')})`)
          } else if (hasEmpty) {
            query = query.or(`${column}.is.null,${column}.eq.`)
          } else {
            if (nonEmptyValues.length === 1) {
              query = query.eq(column, nonEmptyValues[0])
            } else {
              query = query.in(column, nonEmptyValues)
            }
          }
        }
      }
    }
    
    // Apply sorting
    if (sort_by && sort_direction) {
      const ascending = sort_direction === 'asc'
      query = query.order(sort_by, { ascending, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    
    // Apply pagination if limit is set
    if (limit !== null) {
      const to = offset + limit - 1
      query = query.range(offset, to)
    }

    const { data: projects, error, count } = await query

    if (error) {
      console.error('Projects fetch error:', error)
      console.error('Query details:', { 
        status, 
        divisionId, 
        search, 
        columnFilters: Object.fromEntries(columnFilters), 
        sort_by, 
        sort_direction 
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Calculate total pages
    const totalPages = limit ? Math.ceil((count || 0) / limit) : 1

    return NextResponse.json({
      projects: projects || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create new project
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

    // Validate request body
    const projectSchema = z.object({
      name: z.string().min(1).max(200),
      job_number: z.string().min(1).max(50),
      client_id: z.string().uuid(),
      division_id: z.string().uuid(),
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
      // New fields for budget and contract breakdown
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
      contract_breakdown: z.object({
        client_po_number: z.string().optional(),
        client_representative: z.string().optional(),
        uses_line_items: z.boolean().default(false),
        // Legacy fields for compatibility
        labor_po_amount: z.number().min(0).default(0),
        materials_po_amount: z.number().min(0).default(0),
        demo_po_amount: z.number().min(0).default(0),
        contract_date: z.string().optional(),
        contract_terms: z.string().optional()
      }).optional(),
      // New fields for dynamic PO line items
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
      budget_source: z.enum(['manual', 'import']).optional()
    })

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // Start a transaction to create project, budget, and contract breakdown
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: validatedData.name,
        job_number: validatedData.job_number,
        client_id: validatedData.client_id,
        division_id: validatedData.division_id,
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
      // Check for unique constraint violation
      if (projectError.code === '23505' && projectError.message.includes('job_number')) {
        return NextResponse.json(
          { error: 'Job number already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: projectError.message }, { status: 400 })
    }

    // Create project budget if provided
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
        // Don't fail the whole request, just log the error
      }
    }

    // Create contract breakdown if provided
    if (validatedData.contract_breakdown) {
      // Only include fields that exist in the database schema
      // Note: total_contract_amount is a generated column and should not be included
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
        console.error('Attempted data:', contractData)
        // Don't fail the whole request, just log the error
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
        // Don't fail the whole request, just log the error
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
        // Don't fail the whole request, just log the error
      }
    }

    // Fetch the complete project with relationships
    const { data: completeProject, error: fetchError } = await supabase
      .from('projects')
      .select(`
        *,
        client:clients!projects_client_id_fkey(id, name),
        division:divisions!projects_division_id_fkey(id, name, code),
        project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
        superintendent:profiles!projects_superintendent_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', project.id)
      .single()

    if (fetchError) {
      console.error('Fetch complete project error:', fetchError)
      // Return the basic project if we can't fetch the complete one
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

    console.error('Create project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}