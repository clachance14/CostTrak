import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { calculateFinancialSnapshot } from '@/lib/services/financial-snapshot'

// Schema for triggering snapshot calculation
const calculateSchema = z.object({
  project_id: z.string().uuid().optional(),
  division_id: z.string().uuid().optional(),
  snapshot_type: z.enum(['project', 'division', 'company']),
  snapshot_date: z.string().datetime().optional(), // Optional, defaults to now
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only controllers and executives can trigger snapshots
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['controller', 'executive'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validatedData = calculateSchema.parse(body)

    // Validate the request
    if (validatedData.snapshot_type === 'project' && !validatedData.project_id) {
      return NextResponse.json(
        { error: 'project_id is required for project snapshots' },
        { status: 400 }
      )
    }

    if (validatedData.snapshot_type === 'division' && !validatedData.division_id) {
      return NextResponse.json(
        { error: 'division_id is required for division snapshots' },
        { status: 400 }
      )
    }

    // Calculate the snapshot
    const snapshot = await calculateFinancialSnapshot(
      supabase,
      {
        type: validatedData.snapshot_type,
        projectId: validatedData.project_id,
        divisionId: validatedData.division_id,
        snapshotDate: validatedData.snapshot_date || new Date().toISOString(),
      }
    )

    // Log the snapshot creation in audit log
    await supabase.from('audit_log').insert({
      entity_type: 'financial_snapshot',
      entity_id: snapshot.id,
      action: 'create',
      changes: {
        snapshot_type: validatedData.snapshot_type,
        project_id: validatedData.project_id,
        division_id: validatedData.division_id,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      data: snapshot,
      message: 'Financial snapshot calculated successfully',
    })
  } catch (error) {
    console.error('Error calculating financial snapshot:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to calculate financial snapshot' },
      { status: 500 }
    )
  }
}