import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StorageService } from '@/lib/services/storage'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Implement documents table in database
    // For now, return not implemented
    return NextResponse.json(
      { error: 'Documents feature not implemented' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error fetching document:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only controllers can delete
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'controller') {
      return NextResponse.json(
        { error: 'Only controllers can delete documents' },
        { status: 403 }
      )
    }

    // TODO: Implement documents table in database
    // For now, return not implemented
    return NextResponse.json(
      { error: 'Documents feature not implemented' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error deleting document:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}