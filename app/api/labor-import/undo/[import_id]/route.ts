import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for route params
const paramsSchema = z.object({
  import_id: z.string().uuid('Invalid import ID')
})

// DELETE /api/labor-import/undo/[import_id] - Undo a labor import
export async function DELETE(
  request: NextRequest,
  { params }: { params: { import_id: string } }
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

    // Check permissions (same as import - all authenticated users)
    const allowedRoles = ['controller', 'ops_manager', 'project_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to undo labor import' },
        { status: 403 }
      )
    }

    // Validate import ID
    const validatedParams = paramsSchema.parse(params)

    // Get the import record
    const { data: importRecord, error: fetchError } = await adminSupabase
      .from('data_imports')
      .select('*')
      .eq('id', validatedParams.import_id)
      .eq('import_type', 'labor')
      .single()

    if (fetchError || !importRecord) {
      return NextResponse.json(
        { error: 'Import record not found' },
        { status: 404 }
      )
    }

    // Check if import can be undone (only successful or partial imports)
    if (!['success', 'partial'].includes(importRecord.import_status)) {
      return NextResponse.json(
        { error: 'Only successful or partial imports can be undone' },
        { status: 400 }
      )
    }

    // Get project details for access control
    const { data: project } = await supabase
      .from('projects')
      .select('id, project_manager_id, division_id')
      .eq('id', importRecord.project_id)
      .single()

    if (!project) {
      return NextResponse.json(
        { error: 'Associated project not found' },
        { status: 404 }
      )
    }

    // Check access permissions based on role
    if (userProfile.role === 'project_manager' && project.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    if (userProfile.role === 'ops_manager') {
      const { data: userDetails } = await supabase
        .from('profiles')
        .select('division_id')
        .eq('id', user.id)
        .single()

      if (userDetails?.division_id !== project.division_id) {
        return NextResponse.json({ error: 'Access denied to this division' }, { status: 403 })
      }
    }

    // Extract metadata for deletion
    const metadata = importRecord.metadata as any
    const weekEnding = metadata?.week_ending
    const newEmployeeNumbers = metadata?.newEmployees?.map((e: any) => e.employee_number) || []

    if (!weekEnding) {
      return NextResponse.json(
        { error: 'Cannot undo import: missing week ending date in metadata' },
        { status: 400 }
      )
    }

    // Track deletion counts
    const deletionResults = {
      labor_employee_actuals: 0,
      labor_actuals: 0,
      employees: 0,
      errors: [] as string[]
    }

    try {
      // 1. Delete labor_employee_actuals for this week
      const { data: deletedActuals, error: actualsError } = await adminSupabase
        .from('labor_employee_actuals')
        .delete()
        .eq('project_id', importRecord.project_id)
        .eq('week_ending', weekEnding)
        .select('id')

      if (actualsError) {
        deletionResults.errors.push(`Failed to delete employee actuals: ${actualsError.message}`)
      } else {
        deletionResults.labor_employee_actuals = deletedActuals?.length || 0
      }

      // 2. Delete labor_actuals for this week
      const { data: deletedAggregates, error: aggregatesError } = await adminSupabase
        .from('labor_actuals')
        .delete()
        .eq('project_id', importRecord.project_id)
        .eq('week_ending', weekEnding)
        .select('id')

      if (aggregatesError) {
        deletionResults.errors.push(`Failed to delete labor aggregates: ${aggregatesError.message}`)
      } else {
        deletionResults.labor_actuals = deletedAggregates?.length || 0
      }

      // 3. Delete new employees created during this import (if any)
      if (newEmployeeNumbers.length > 0) {
        // First check if these employees have been used in other imports
        const { data: employeeUsage } = await adminSupabase
          .from('labor_employee_actuals')
          .select('employee_id, employees!inner(employee_number)')
          .in('employees.employee_number', newEmployeeNumbers)
          .neq('week_ending', weekEnding)

        const usedEmployeeNumbers = new Set(
          employeeUsage?.map((u: any) => u.employees.employee_number) || []
        )

        const employeesToDelete = newEmployeeNumbers.filter(
          (num: string) => !usedEmployeeNumbers.has(num)
        )

        if (employeesToDelete.length > 0) {
          const { data: deletedEmployees, error: employeesError } = await adminSupabase
            .from('employees')
            .delete()
            .in('employee_number', employeesToDelete)
            .eq('base_rate', 0) // Only delete placeholder employees
            .select('id')

          if (employeesError) {
            deletionResults.errors.push(`Failed to delete employees: ${employeesError.message}`)
          } else {
            deletionResults.employees = deletedEmployees?.length || 0
          }
        }
      }

      // 4. Update import record status to 'undone'
      const { error: updateError } = await adminSupabase
        .from('data_imports')
        .update({
          import_status: 'undone',
          metadata: {
            ...metadata,
            undone_at: new Date().toISOString(),
            undone_by: user.id,
            deletion_results: deletionResults
          }
        })
        .eq('id', validatedParams.import_id)

      if (updateError) {
        deletionResults.errors.push(`Failed to update import status: ${updateError.message}`)
      }

      // 5. Create audit log entry
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'undo_import',
        entity_type: 'labor_import',
        entity_id: validatedParams.import_id,
        changes: {
          project_id: importRecord.project_id,
          week_ending: weekEnding,
          deleted_records: deletionResults,
          original_import: {
            imported: metadata.imported,
            updated: metadata.updated,
            employee_count: metadata.employee_count
          }
        }
      }).catch(err => console.error('Audit log error:', err))

      // Return results
      if (deletionResults.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Import partially undone with errors',
            deleted: deletionResults,
            errors: deletionResults.errors
          },
          { status: 207 } // Multi-status
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Import successfully undone',
        deleted: {
          labor_employee_actuals: deletionResults.labor_employee_actuals,
          labor_actuals: deletionResults.labor_actuals,
          employees: deletionResults.employees
        }
      })

    } catch (error) {
      console.error('Error during undo operation:', error)
      return NextResponse.json(
        {
          error: 'Failed to undo import',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Labor import undo error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}