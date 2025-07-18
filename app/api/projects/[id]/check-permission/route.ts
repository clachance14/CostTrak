import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permission = searchParams.get('permission')
    
    if (!permission) {
      return NextResponse.json(
        { error: 'permission parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission using the database function
    const { data: hasPermission, error } = await supabase
      .rpc('user_has_project_permission', {
        p_project_id: id,
        p_permission: permission
      })

    if (error) {
      console.error('Error checking permission:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hasPermission: hasPermission || false })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/check-permission:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}