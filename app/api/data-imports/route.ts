import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const importType = searchParams.get('importType')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('data_imports')
      .select(`
        *,
        project:projects!inner(id, name, job_number),
        imported_by_user:profiles!imported_by(id, first_name, last_name, email)
      `)
      .order('imported_at', { ascending: false })
      .limit(limit)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (importType) {
      query = query.eq('import_type', importType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching data imports:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in data imports GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    // Validate required fields
    const { project_id, import_type, import_status, file_name } = body
    if (!project_id || !import_type || !import_status) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, import_type, import_status' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create data import record
    const { data, error } = await supabase
      .from('data_imports')
      .insert({
        project_id,
        import_type,
        import_status,
        imported_by: user.id,
        file_name,
        records_processed: body.records_processed || 0,
        records_failed: body.records_failed || 0,
        error_message: body.error_message,
        error_details: body.error_details,
        metadata: body.metadata
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating data import:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in data imports POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}