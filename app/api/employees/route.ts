import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { newEmployeeSchema, batchEmployeeSchema } from '@/lib/validations/labor-import'

export const dynamic = 'force-dynamic'

// GET /api/employees - List employees with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const craftTypeId = searchParams.get('craft_type_id')
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('employees')
      .select(`
        *,
        craft_type:craft_types!inner(
          id,
          name,
          code,
          category
        )
      `)
      .order('last_name')
      .order('first_name')

    // Apply filters
    if (craftTypeId) {
      query = query.eq('craft_type_id', craftTypeId)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%`)
    }

    const { data: employees, error } = await query

    if (error) throw error

    return NextResponse.json({
      employees: employees?.map(emp => ({
        id: emp.id,
        employeeNumber: emp.employee_number,
        firstName: emp.first_name,
        lastName: emp.last_name,
        fullName: `${emp.last_name}, ${emp.first_name}`,
        craftType: {
          id: emp.craft_type.id,
          name: emp.craft_type.name,
          code: emp.craft_type.code,
          laborCategory: emp.craft_type.category
        },
        baseRate: emp.base_rate,
        isDirect: emp.is_direct,
        isActive: emp.is_active,
        createdAt: emp.created_at,
        updatedAt: emp.updated_at
      })) || []
    })

  } catch (error) {
    console.error('Get employees error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

// POST /api/employees - Create new employee(s)
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

    // Check permissions - only certain roles can create employees
    const allowedRoles = ['controller', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create employees' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Check if batch or single employee creation
    const isBatch = Array.isArray(body.employees)
    
    if (isBatch) {
      // Batch creation
      const validatedData = batchEmployeeSchema.parse(body)
      
      const results = {
        created: [] as Array<{ id: string; employeeNumber: string; firstName: string; lastName: string; craftType: { id: string; name: string; code: string; category: string } }>,
        errors: [] as Array<{ employee_number: string; error: string }>
      }

      for (const employee of validatedData.employees) {
        try {
          // Check if employee number already exists
          const { data: existing } = await adminSupabase
            .from('employees')
            .select('id')
            .eq('employee_number', employee.employee_number)
            .single()

          if (existing) {
            results.errors.push({
              employee_number: employee.employee_number,
              error: 'Employee number already exists'
            })
            continue
          }

          // Create employee
          const { data: created, error: createError } = await adminSupabase
            .from('employees')
            .insert({
              employee_number: employee.employee_number,
              first_name: employee.first_name,
              last_name: employee.last_name,
              payroll_name: employee.payroll_name,
              legal_middle_name: employee.legal_middle_name,
              craft_type_id: employee.craft_type_id,
              base_rate: employee.base_rate,
              category: employee.category,
              class: employee.class,
              job_title_description: employee.job_title_description,
              location_code: employee.location_code,
              location_description: employee.location_description,
              is_direct: employee.is_direct,
              is_active: employee.is_active ?? true
            })
            .select(`
              *,
              craft_type:craft_types!inner(
                id,
                name,
                code,
                category
              )
            `)
            .single()

          if (createError) throw createError

          results.created.push({
            id: created.id,
            employeeNumber: created.employee_number,
            firstName: created.first_name,
            lastName: created.last_name,
            craftType: created.craft_type
          })

          // Log creation
          await adminSupabase.from('audit_log').insert({
            user_id: user.id,
            action: 'create',
            entity_type: 'employee',
            entity_id: created.id,
            changes: { created: employee }
          })

        } catch (error) {
          results.errors.push({
            employee_number: employee.employee_number,
            error: error instanceof Error ? error.message : 'Failed to create employee'
          })
        }
      }

      return NextResponse.json({
        success: results.created.length > 0,
        created: results.created,
        errors: results.errors,
        summary: {
          total: validatedData.employees.length,
          created: results.created.length,
          failed: results.errors.length
        }
      })

    } else {
      // Single employee creation
      const validatedData = newEmployeeSchema.parse(body)

      // Check if employee number already exists
      const { data: existing } = await adminSupabase
        .from('employees')
        .select('id')
        .eq('employee_number', validatedData.employee_number)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Employee number already exists' },
          { status: 400 }
        )
      }

      // Create employee
      const { data: created, error: createError } = await adminSupabase
        .from('employees')
        .insert({
          employee_number: validatedData.employee_number,
          first_name: validatedData.first_name,
          last_name: validatedData.last_name,
          payroll_name: validatedData.payroll_name,
          legal_middle_name: validatedData.legal_middle_name,
          craft_type_id: validatedData.craft_type_id,
          base_rate: validatedData.base_rate,
          category: validatedData.category,
          class: validatedData.class,
          job_title_description: validatedData.job_title_description,
          location_code: validatedData.location_code,
          location_description: validatedData.location_description,
          is_direct: validatedData.is_direct,
          is_active: validatedData.is_active ?? true
        })
        .select(`
          *,
          craft_type:craft_types!inner(
            id,
            name,
            code,
            category
          )
        `)
        .single()

      if (createError) throw createError

      // Log creation
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'employee',
        entity_id: created.id,
        changes: { created: validatedData }
      })

      return NextResponse.json({
        employee: {
          id: created.id,
          employeeNumber: created.employee_number,
          firstName: created.first_name,
          lastName: created.last_name,
          fullName: `${created.last_name}, ${created.first_name}`,
          craftType: {
            id: created.craft_type.id,
            name: created.craft_type.name,
            code: created.craft_type.code,
            laborCategory: created.craft_type.category
          },
          baseRate: created.base_rate,
          isDirect: created.is_direct,
          isActive: created.is_active,
          createdAt: created.created_at
        }
      })
    }

  } catch (error) {
    console.error('Create employee error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}