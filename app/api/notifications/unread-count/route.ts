import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unread count using the database function
    const { data, error } = await supabase.rpc('get_unread_notification_count')

    if (error) {
      console.error('Error getting unread count:', error)
      return NextResponse.json(
        { error: 'Failed to get unread notification count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ count: data || 0 })
  } catch (error) {
    console.error('Error in unread count GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}