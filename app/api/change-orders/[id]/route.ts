import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  changeOrderUpdateSchema,
  validateStatusTransition,
  validateChangeOrderAmount
} from '@/lib/validations/change-order'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/change-orders/[id] - Get single change order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details
  const { data: userDetails } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Viewers don't have access to change orders
  if (userDetails.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Fetch change order with related data
    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(
          id,
          job_number,
          name,
          project_manager_id,
          original_contract,
          revised_contract,
          division:divisions!inner(id, name, code),
          client:clients!inner(id, name)
        ),
        created_by_user:profiles!change_orders_created_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        approved_by_user:profiles!change_orders_approved_by_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', changeOrderId)
      .is('deleted_at', null)
      .single()

    if (error || !changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Check access for project managers
    if (userDetails.role === 'project_manager' && 
        changeOrder.project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get audit log for this change order
    const { data: auditLogs } = await supabase
      .from('audit_log')
      .select(`
        *,
        user:profiles!audit_log_user_id_fkey(first_name, last_name)
      `)
      .eq('entity_type', 'change_order')
      .eq('entity_id', changeOrderId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Format response with camelCase properties to match the frontend interface
    const response = {
      changeOrder: {
        id: changeOrder.id,
        projectId: changeOrder.project_id,
        coNumber: changeOrder.co_number,
        description: changeOrder.description,
        amount: changeOrder.amount,
        status: changeOrder.status,
        pricingType: changeOrder.pricing_type,
        impactScheduleDays: changeOrder.impact_schedule_days,
        reason: changeOrder.reason,
        manhours: changeOrder.manhours,
        laborAmount: changeOrder.labor_amount,
        equipmentAmount: changeOrder.equipment_amount,
        materialAmount: changeOrder.material_amount,
        subcontractAmount: changeOrder.subcontract_amount,
        markupAmount: changeOrder.markup_amount,
        taxAmount: changeOrder.tax_amount,
        submittedDate: changeOrder.submitted_date,
        approvedDate: changeOrder.approved_date,
        rejectionReason: changeOrder.rejection_reason,
        createdAt: changeOrder.created_at,
        updatedAt: changeOrder.updated_at,
        project: {
          id: changeOrder.project.id,
          jobNumber: changeOrder.project.job_number,
          name: changeOrder.project.name,
          originalContract: changeOrder.project.original_contract,
          revisedContract: changeOrder.project.revised_contract,
          division: {
            id: changeOrder.project.division.id,
            name: changeOrder.project.division.name,
            code: changeOrder.project.division.code
          },
          client: {
            id: changeOrder.project.client.id,
            name: changeOrder.project.client.name
          }
        },
        createdBy: changeOrder.created_by_user ? {
          id: changeOrder.created_by_user.id,
          name: `${changeOrder.created_by_user.first_name} ${changeOrder.created_by_user.last_name}`,
          email: changeOrder.created_by_user.email
        } : null,
        approvedBy: changeOrder.approved_by_user ? {
          id: changeOrder.approved_by_user.id,
          name: `${changeOrder.approved_by_user.first_name} ${changeOrder.approved_by_user.last_name}`,
          email: changeOrder.approved_by_user.email
        } : null
      },
      auditTrail: auditLogs?.map(log => ({
        action: log.action,
        changes: log.changes,
        timestamp: log.created_at,
        user: log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'
      })) || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Change order fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch change order' },
      { status: 500 }
    )
  }
}

// PATCH /api/change-orders/[id] - Update change order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details
  const { data: userDetails } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check permissions
  if (['viewer', 'accounting', 'executive'].includes(userDetails.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = changeOrderUpdateSchema.parse(body)

    // Get existing change order
    const { data: existingCO, error: fetchError } = await supabase
      .from('change_orders')
      .select(`
        *,
        project:projects!inner(project_manager_id)
      `)
      .eq('id', changeOrderId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingCO) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Check access for project managers
    if (userDetails.role === 'project_manager' && 
        existingCO.project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cannot edit approved or cancelled change orders
    if (['approved', 'cancelled'].includes(existingCO.status)) {
      return NextResponse.json(
        { error: 'Cannot edit change orders with status: ' + existingCO.status },
        { status: 400 }
      )
    }

    // Validate status transition if status is being changed
    if (validatedData.status && validatedData.status !== existingCO.status) {
      const statusValidation = validateStatusTransition(
        existingCO.status,
        validatedData.status,
        userDetails.role
      )
      
      if (!statusValidation.valid) {
        return NextResponse.json(
          { error: statusValidation.message },
          { status: 403 }
        )
      }

      // Validate amount for approval
      if (validatedData.status === 'approved') {
        const amount = validatedData.amount || existingCO.amount
        const amountValidation = validateChangeOrderAmount(amount, userDetails.role)
        
        if (!amountValidation.valid) {
          return NextResponse.json(
            { error: amountValidation.message },
            { status: 403 }
          )
        }
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { ...validatedData }
    
    // If approving, set approved_by and approved_date
    if (validatedData.status === 'approved') {
      updateData.approved_by = user.id
      updateData.approved_date = new Date().toISOString()
    }

    // Update the change order
    const { data: updatedCO, error: updateError } = await supabase
      .from('change_orders')
      .update(updateData)
      .eq('id', changeOrderId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log changes to audit trail
    const changes: Record<string, unknown> = {}
    Object.keys(validatedData).forEach(key => {
      if (existingCO[key] !== (validatedData as Record<string, unknown>)[key]) {
        changes[key] = {
          from: existingCO[key],
          to: (validatedData as Record<string, unknown>)[key]
        }
      }
    })

    if (Object.keys(changes).length > 0) {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'change_order',
        entity_id: changeOrderId,
        changes
      })
    }

    return NextResponse.json({
      changeOrder: {
        id: updatedCO.id,
        projectId: updatedCO.project_id,
        coNumber: updatedCO.co_number,
        description: updatedCO.description,
        amount: updatedCO.amount,
        status: updatedCO.status,
        impactScheduleDays: updatedCO.impact_schedule_days,
        submittedDate: updatedCO.submitted_date,
        approvedDate: updatedCO.approved_date
      }
    })
  } catch (error) {
    console.error('Change order update error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update change order' },
      { status: 500 }
    )
  }
}

// DELETE /api/change-orders/[id] - Soft delete change order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const changeOrderId = id
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user details
  const { data: userDetails } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userDetails) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Only controllers can delete change orders
  if (userDetails.role !== 'controller') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get existing change order
    const { data: existingCO, error: fetchError } = await supabase
      .from('change_orders')
      .select('id, status, co_number')
      .eq('id', changeOrderId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingCO) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Cannot delete approved change orders
    if (existingCO.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete approved change orders' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('change_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', changeOrderId)

    if (deleteError) throw deleteError

    // Log to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'delete',
      entity_type: 'change_order',
      entity_id: changeOrderId,
      changes: { deleted: true, co_number: existingCO.co_number }
    })

    return NextResponse.json({ 
      message: 'Change order deleted successfully' 
    })
  } catch (error) {
    console.error('Change order deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete change order' },
      { status: 500 }
    )
  }
}