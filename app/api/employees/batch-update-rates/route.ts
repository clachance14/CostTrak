import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateRatesSchema = z.object({
  employees: z.array(z.object({
    employee_number: z.string(),
    base_rate: z.number().min(0)
  }))
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const validatedData = updateRatesSchema.parse(body)

    // Update employees in batch
    let updated = 0
    const errors: string[] = []

    for (const employee of validatedData.employees) {
      try {
        // Check if employee exists
        const { data: existingEmployee } = await adminSupabase
          .from('employees')
          .select('id, employee_number, first_name, last_name')
          .eq('employee_number', employee.employee_number)
          .single()

        if (existingEmployee) {
          // Update existing employee
          const { error: updateError } = await adminSupabase
            .from('employees')
            .update({
              base_rate: employee.base_rate,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingEmployee.id)

          if (updateError) {
            errors.push(`Failed to update ${employee.employee_number}: ${updateError.message}`)
          } else {
            updated++
            
            // Log to audit
            await adminSupabase.from('audit_log').insert({
              user_id: user.id,
              action: 'update',
              entity_type: 'employee',
              entity_id: existingEmployee.id,
              changes: {
                base_rate: employee.base_rate,
                source: 'batch_rate_update'
              }
            }).catch(err => console.error('Audit log error:', err))
          }
        } else {
          errors.push(`Employee ${employee.employee_number} not found`)
        }
      } catch (error) {
        console.error(`Error updating employee ${employee.employee_number}:`, error)
        errors.push(`Error processing ${employee.employee_number}`)
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: validatedData.employees.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Batch update rates error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}