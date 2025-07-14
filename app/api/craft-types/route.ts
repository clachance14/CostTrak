import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/craft-types - List all active craft types
export async function GET() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: craftTypes, error } = await supabase
      .from('craft_types')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error

    // Group by category for easier UI rendering
    const grouped = craftTypes?.reduce((acc, craft) => {
      if (!acc[craft.category]) {
        acc[craft.category] = []
      }
      acc[craft.category].push({
        id: craft.id,
        name: craft.name,
        code: craft.code,
        category: craft.category
      })
      return acc
    }, {} as Record<string, Array<{id: string; name: string; code: string; category: string}>>) || {}

    return NextResponse.json({
      craftTypes: craftTypes?.map(craft => ({
        id: craft.id,
        name: craft.name,
        code: craft.code,
        category: craft.category
      })) || [],
      grouped
    })
  } catch (error) {
    console.error('Craft types fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch craft types' },
      { status: 500 }
    )
  }
}