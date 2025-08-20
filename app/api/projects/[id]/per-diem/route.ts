import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PerDiemCalculator } from '@/lib/services/per-diem-calculator'
import type { Database } from '@/types/database.generated'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') || 'summary'

    const calculator = new PerDiemCalculator(supabase)

    switch (view) {
      case 'summary': {
        // Get overall per diem summary
        const summary = await calculator.getProjectPerDiemSummary(projectId)
        if (!summary) {
          // Project might not have per diem enabled, return empty summary
          return NextResponse.json({
            project_id: projectId,
            per_diem_enabled: false,
            total_direct_per_diem: 0,
            total_indirect_per_diem: 0,
            total_per_diem_amount: 0,
            unique_employees: 0,
            days_with_per_diem: 0
          })
        }
        return NextResponse.json(summary)
      }

      case 'costs': {
        // Get detailed per diem costs with filters
        const startDate = searchParams.get('startDate') || undefined
        const endDate = searchParams.get('endDate') || undefined
        const employeeId = searchParams.get('employeeId') || undefined
        const employeeType = searchParams.get('employeeType') as 'Direct' | 'Indirect' | undefined

        const costs = await calculator.getProjectPerDiemCosts(projectId, {
          startDate,
          endDate,
          employeeId,
          employeeType
        })

        return NextResponse.json({ costs })
      }

      case 'pay-period': {
        // Get per diem for a specific pay period
        const payPeriodEnding = searchParams.get('payPeriodEnding')
        if (!payPeriodEnding) {
          return NextResponse.json(
            { error: 'payPeriodEnding parameter is required' },
            { status: 400 }
          )
        }

        const payPeriodData = await calculator.getPerDiemByPayPeriod(
          projectId,
          payPeriodEnding
        )

        return NextResponse.json(payPeriodData)
      }

      case 'trends': {
        // Get per diem trends for analytics
        const groupBy = (searchParams.get('groupBy') || 'week') as 'week' | 'month'
        const trends = await calculator.getPerDiemTrends(projectId, groupBy)

        return NextResponse.json({ trends })
      }

      case 'date-range': {
        // Calculate per diem for a specific date range
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Both startDate and endDate parameters are required' },
            { status: 400 }
          )
        }

        const rangeData = await calculator.calculatePerDiemForDateRange(
          projectId,
          startDate,
          endDate
        )

        return NextResponse.json(rangeData)
      }

      case 'validate': {
        // Validate per diem configuration
        const validation = await calculator.validateProjectPerDiemConfig(projectId)
        return NextResponse.json(validation)
      }

      default:
        return NextResponse.json(
          { error: `Invalid view parameter: ${view}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in per diem GET endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const action = body.action

    const calculator = new PerDiemCalculator(supabase)

    switch (action) {
      case 'recalculate': {
        // Recalculate all per diem for the project
        const result = await calculator.recalculateProjectPerDiem(projectId)
        
        if (!result) {
          return NextResponse.json(
            { error: 'Failed to recalculate per diem' },
            { status: 500 }
          )
        }

        // Log the recalculation in data_imports for audit trail
        await supabase.from('data_imports').insert({
          project_id: projectId,
          import_type: 'per_diem_recalc',
          file_name: 'manual_recalculation',
          import_status: 'success',
          imported_by: session.user.id,
          row_count: result.records_processed,
          import_notes: `Per diem recalculated. Total amount: $${result.total_per_diem_amount}`
        })

        return NextResponse.json({
          success: true,
          result
        })
      }

      case 'enable': {
        // Enable/disable per diem for the project
        const { enabled, directRate, indirectRate } = body

        const { error: updateError } = await supabase
          .from('projects')
          .update({
            per_diem_enabled: enabled,
            per_diem_rate_direct: directRate || 0,
            per_diem_rate_indirect: indirectRate || 0
          })
          .eq('id', projectId)

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update per diem configuration' },
            { status: 500 }
          )
        }

        // If enabling with rates, trigger recalculation
        if (enabled && (directRate > 0 || indirectRate > 0)) {
          const result = await calculator.recalculateProjectPerDiem(projectId)
          
          return NextResponse.json({
            success: true,
            message: 'Per diem configuration updated',
            recalculation: result
          })
        }

        return NextResponse.json({
          success: true,
          message: 'Per diem configuration updated'
        })
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in per diem POST endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}