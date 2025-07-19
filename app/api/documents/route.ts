import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Query schema for listing documents
const querySchema = z.object({
  entity_type: z.enum(['project', 'purchase_order', 'change_order']).optional(),
  entity_id: z.string().uuid().optional(),
  category: z.enum(['contract', 'invoice', 'drawing', 'report', 'other']).optional(),
  uploaded_by: z.string().uuid().optional(),
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

    // TODO: Implement documents table in database
    // For now, return empty list
    return NextResponse.json({
      data: [],
      pagination: {
        total: 0,
        offset: validatedQuery.offset,
        limit: validatedQuery.limit,
      },
    })
  } catch (error) {
    console.error('Error listing documents:', error)
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