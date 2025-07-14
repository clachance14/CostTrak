import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET /api/clients - List all clients
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .is('deleted_at', null)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ clients: clients || [] })
  } catch (error) {
    console.error('Clients API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/clients - Create new client (for autocomplete)
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

    // Only controllers can create clients
    if (currentUser?.role !== 'controller') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate request body
    const clientSchema = z.object({
      name: z.string().min(1).max(255),
      contact_name: z.string().optional(),
      contact_email: z.string().email().optional(),
      contact_phone: z.string().optional()
    })

    const body = await request.json()
    const validatedData = clientSchema.parse(body)

    // Create client
    const { data: client, error } = await supabase
      .from('clients')
      .insert(validatedData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create client error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}