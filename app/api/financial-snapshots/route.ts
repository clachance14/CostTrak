import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { Database } from '@/types/database.generated'

type FinancialSnapshot = Database['public']['Tables']['financial_snapshots']['Row']

// Query schema for listing snapshots
const querySchema = z.object({
  project_id: z.string().uuid().optional(),
  division_id: z.string().uuid().optional(),
  snapshot_type: z.enum(['project', 'division', 'company']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const validatedQuery = querySchema.parse(searchParams)

    // Build query
    let query = supabase
      .from('financial_snapshots')
      .select(`
        *,
        project:projects(job_number, name),
        division:divisions(name, code)
      `)
      .order('snapshot_date', { ascending: false })
      .limit(validatedQuery.limit)
      .range(validatedQuery.offset, validatedQuery.offset + validatedQuery.limit - 1)

    // Apply filters
    if (validatedQuery.project_id) {
      query = query.eq('project_id', validatedQuery.project_id)
    }
    
    if (validatedQuery.division_id) {
      query = query.eq('division_id', validatedQuery.division_id)
    }
    
    if (validatedQuery.snapshot_type) {
      query = query.eq('snapshot_type', validatedQuery.snapshot_type)
    }
    
    if (validatedQuery.date_from) {
      query = query.gte('snapshot_date', validatedQuery.date_from)
    }
    
    if (validatedQuery.date_to) {
      query = query.lte('snapshot_date', validatedQuery.date_to)
    }

    // Check user role and apply RLS
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, division_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Apply role-based filtering
    if (userProfile.role === 'ops_manager' && userProfile.division_id) {
      query = query.eq('division_id', userProfile.division_id)
    } else if (userProfile.role === 'project_manager') {
      // Filter to only projects they manage
      const { data: managedProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('project_manager_id', user.id)
      
      if (managedProjects && managedProjects.length > 0) {
        const projectIds = managedProjects.map(p => p.id)
        query = query.in('project_id', projectIds)
      }
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching financial snapshots:', error)
      return NextResponse.json(
        { error: 'Failed to fetch financial snapshots' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
    })
  } catch (error) {
    console.error('Error in financial snapshots GET:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}