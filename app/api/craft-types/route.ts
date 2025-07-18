import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { newCraftTypeSchema } from '@/lib/validations/labor-import'

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

// POST /api/craft-types - Create new craft type
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Check permissions
    const allowedRoles = ['controller', 'ops_manager']
    if (!userProfile || !allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create craft types' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Support batch creation
    const isBatch = Array.isArray(body.crafts)
    
    if (isBatch) {
      // Batch creation
      const results = {
        created: [] as Array<{ id: string; name: string; code: string; laborCategory: string }>,
        errors: [] as Array<{ code: string; error: string }>
      }

      for (const craft of body.crafts) {
        try {
          const validatedData = newCraftTypeSchema.parse(craft)

          // Check if craft code already exists
          const { data: existing } = await adminSupabase
            .from('craft_types')
            .select('id')
            .eq('code', validatedData.code)
            .single()

          if (existing) {
            results.errors.push({
              code: validatedData.code,
              error: 'Craft code already exists'
            })
            continue
          }

          // Create craft type
          const { data: created, error: createError } = await adminSupabase
            .from('craft_types')
            .insert({
              name: validatedData.name,
              code: validatedData.code,
              category: validatedData.labor_category,
              default_rate: validatedData.default_rate,
              is_active: validatedData.is_active ?? true
            })
            .select()
            .single()

          if (createError) throw createError

          results.created.push({
            id: created.id,
            name: created.name,
            code: created.code,
            laborCategory: created.category
          })

          // Log creation
          await adminSupabase.from('audit_log').insert({
            user_id: user.id,
            action: 'create',
            entity_type: 'craft_type',
            entity_id: created.id,
            changes: { created: validatedData }
          })

        } catch (error) {
          results.errors.push({
            code: craft.code,
            error: error instanceof Error ? error.message : 'Failed to create craft type'
          })
        }
      }

      return NextResponse.json({
        success: results.created.length > 0,
        created: results.created,
        errors: results.errors,
        summary: {
          total: body.crafts.length,
          created: results.created.length,
          failed: results.errors.length
        }
      })

    } else {
      // Single craft creation
      const validatedData = newCraftTypeSchema.parse(body)

      // Check if craft code already exists
      const { data: existing } = await adminSupabase
        .from('craft_types')
        .select('id')
        .eq('code', validatedData.code)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Craft code already exists' },
          { status: 400 }
        )
      }

      // Create craft type
      const { data: created, error: createError } = await adminSupabase
        .from('craft_types')
        .insert({
          name: validatedData.name,
          code: validatedData.code,
          category: validatedData.labor_category,
          default_rate: validatedData.default_rate,
          is_active: validatedData.is_active ?? true
        })
        .select()
        .single()

      if (createError) throw createError

      // Log creation
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'craft_type',
        entity_id: created.id,
        changes: { created: validatedData }
      })

      return NextResponse.json({
        craftType: {
          id: created.id,
          name: created.name,
          code: created.code,
          laborCategory: created.category,
          defaultRate: created.default_rate,
          isActive: created.is_active,
          createdAt: created.created_at
        }
      })
    }

  } catch (error) {
    console.error('Create craft type error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create craft type' },
      { status: 500 }
    )
  }
}