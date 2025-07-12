import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { Database } from '@/types/database.generated'

type Document = Database['public']['Tables']['documents']['Row']

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

    // Build query
    let query = supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!uploaded_by(first_name, last_name, email)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(validatedQuery.limit)
      .range(validatedQuery.offset, validatedQuery.offset + validatedQuery.limit - 1)

    // Apply filters
    if (validatedQuery.entity_type) {
      query = query.eq('entity_type', validatedQuery.entity_type)
    }
    
    if (validatedQuery.entity_id) {
      query = query.eq('entity_id', validatedQuery.entity_id)
    }
    
    if (validatedQuery.category) {
      query = query.eq('category', validatedQuery.category)
    }
    
    if (validatedQuery.uploaded_by) {
      query = query.eq('uploaded_by', validatedQuery.uploaded_by)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Add entity details based on type
    const documentsWithDetails = await Promise.all((data || []).map(async (doc) => {
      let entityDetails = null
      
      if (doc.entity_type === 'project') {
        const { data: project } = await supabase
          .from('projects')
          .select('job_number, name')
          .eq('id', doc.entity_id)
          .single()
        entityDetails = project
      } else if (doc.entity_type === 'purchase_order') {
        const { data: po } = await supabase
          .from('purchase_orders')
          .select('po_number, description')
          .eq('id', doc.entity_id)
          .single()
        entityDetails = po
      } else if (doc.entity_type === 'change_order') {
        const { data: co } = await supabase
          .from('change_orders')
          .select('co_number, description')
          .eq('id', doc.entity_id)
          .single()
        entityDetails = co
      }

      return {
        ...doc,
        entity_details: entityDetails,
      }
    }))

    return NextResponse.json({
      data: documentsWithDetails,
      total: count || 0,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
    })
  } catch (error) {
    console.error('Error in documents GET:', error)
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