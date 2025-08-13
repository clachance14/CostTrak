import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema for employee updates
const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  base_rate: z.number().min(0).optional(),
  craft_type_id: z.string().uuid().optional(),
  category: z.enum(['Direct', 'Indirect', 'Staff']).optional(),
  is_direct: z.boolean().optional(),
  is_active: z.boolean().optional(),
  payroll_name: z.string().nullable().optional(),
  legal_middle_name: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
  job_title_description: z.string().nullable().optional(),
  location_code: z.string().nullable().optional(),
  location_description: z.string().nullable().optional()
})

// GET /api/employees/[id] - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: employee, error } = await supabase
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
      .eq('id', params.id)
      .single()

    if (error || !employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        employeeNumber: employee.employee_number,
        firstName: employee.first_name,
        lastName: employee.last_name,
        fullName: `${employee.last_name}, ${employee.first_name}`,
        payrollName: employee.payroll_name,
        legalMiddleName: employee.legal_middle_name,
        craftType: {
          id: employee.craft_type.id,
          name: employee.craft_type.name,
          code: employee.craft_type.code,
          category: employee.craft_type.category
        },
        baseRate: employee.base_rate,
        category: employee.category,
        class: employee.class,
        jobTitleDescription: employee.job_title_description,
        locationCode: employee.location_code,
        locationDescription: employee.location_description,
        isDirect: employee.is_direct,
        isActive: employee.is_active,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at
      }
    })

  } catch (error) {
    console.error('Get employee error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}

// PATCH /api/employees/[id] - Update employee
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions - allow project_manager for labor import fixes
    const allowedRoles = ['controller', 'ops_manager', 'project_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update employees' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateEmployeeSchema.parse(body)

    // Get existing employee data for audit log
    const { data: existingEmployee } = await adminSupabase
      .from('employees')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // If craft_type_id is being updated, fetch the craft type to update category
    const updateData: Record<string, unknown> = { ...validatedData }
    if (validatedData.craft_type_id) {
      const { data: craftType } = await adminSupabase
        .from('craft_types')
        .select('category')
        .eq('id', validatedData.craft_type_id)
        .single()

      if (craftType) {
        // Update category and is_direct based on craft type
        updateData.category = craftType.category.charAt(0).toUpperCase() + craftType.category.slice(1)
        updateData.is_direct = craftType.category === 'direct'
      }
    }

    // Update employee
    const { data: updated, error: updateError } = await adminSupabase
      .from('employees')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
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

    if (updateError) throw updateError

    // Log the update with detailed changes
    const changes: Record<string, unknown> = {}
    Object.keys(validatedData).forEach(key => {
      const oldValue = existingEmployee[key]
      const newValue = updateData[key]
      if (oldValue !== newValue) {
        changes[key] = {
          old: oldValue,
          new: newValue
        }
      }
    })

    await adminSupabase.from('audit_log').insert({
      user_id: user.id,
      action: 'update',
      entity_type: 'employee',
      entity_id: params.id,
      changes: {
        ...changes,
        updated_by_role: userProfile.role,
        reason: body.reason || 'Labor import data fix'
      }
    })

    return NextResponse.json({
      employee: {
        id: updated.id,
        employeeNumber: updated.employee_number,
        firstName: updated.first_name,
        lastName: updated.last_name,
        fullName: `${updated.last_name}, ${updated.first_name}`,
        payrollName: updated.payroll_name,
        legalMiddleName: updated.legal_middle_name,
        craftType: {
          id: updated.craft_type.id,
          name: updated.craft_type.name,
          code: updated.craft_type.code,
          category: updated.craft_type.category
        },
        baseRate: updated.base_rate,
        category: updated.category,
        class: updated.class,
        jobTitleDescription: updated.job_title_description,
        locationCode: updated.location_code,
        locationDescription: updated.location_description,
        isDirect: updated.is_direct,
        isActive: updated.is_active,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    })

  } catch (error) {
    console.error('Update employee error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

// DELETE /api/employees/[id] - Soft delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions - only certain roles can delete
    const allowedRoles = ['controller', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete employees' },
        { status: 403 }
      )
    }

    // Soft delete by setting is_active to false
    const { error: updateError } = await adminSupabase
      .from('employees')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    // Log deletion
    await adminSupabase.from('audit_log').insert({
      user_id: user.id,
      action: 'delete',
      entity_type: 'employee',
      entity_id: params.id,
      changes: { 
        soft_deleted: true,
        deleted_by_role: userProfile.role
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete employee error:', error)
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}