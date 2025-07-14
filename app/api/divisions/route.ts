import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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
  } catch {
    console.error('Divisions API error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/divisions - Create new division (for autocomplete)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's role
    const { data: currentUser } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only controllers can create divisions
    if (currentUser?.role !== 'controller') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate request body
    const divisionSchema = z.object({
      name: z.string().min(1).max(100),
      code: z.string().min(1).max(10).optional(),
      description: z.string().optional()
    })

    const body = await request.json()
    const validatedData = divisionSchema.parse(body)

    // Generate code if not provided
    const code = validatedData.code || validatedData.name.slice(0, 3).toUpperCase()

    // Create division
    const { data: division, error } = await supabase
      .from('divisions')
      .insert({
        name: validatedData.name,
        code: code,
        description: validatedData.description
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ division }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create division error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}