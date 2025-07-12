import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/divisions - List all divisions
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: divisions, error } = await supabase
      .from('divisions')
      .select('*')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ divisions: divisions || [] })
  } catch (error) {
    console.error('Divisions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}