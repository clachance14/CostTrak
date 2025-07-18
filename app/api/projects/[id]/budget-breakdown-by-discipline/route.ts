import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DisciplineBreakdown {
  discipline: string
  costTypes: Array<{
    cost_type: string
    value: number
    manhours: number | null
    description?: string
  }>
  total: number
  totalManhours: number
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const projectId = params.id
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('name, job_number')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all budget breakdowns for the project
    const { data: breakdowns, error } = await supabase
      .from('project_budget_breakdowns')
      .select('*')
      .eq('project_id', projectId)
      .order('discipline', { ascending: true })
      .order('cost_type', { ascending: true })

    if (error) {
      throw error
    }

    // Group by discipline
    const disciplineMap = new Map<string, DisciplineBreakdown>()

    breakdowns?.forEach(breakdown => {
      // Only include items with value > 0
      if (breakdown.value <= 0) return

      if (!disciplineMap.has(breakdown.discipline)) {
        disciplineMap.set(breakdown.discipline, {
          discipline: breakdown.discipline,
          costTypes: [],
          total: 0,
          totalManhours: 0
        })
      }

      const discipline = disciplineMap.get(breakdown.discipline)!
      
      discipline.costTypes.push({
        cost_type: breakdown.cost_type,
        value: breakdown.value,
        manhours: breakdown.manhours,
        description: breakdown.description
      })

      discipline.total += breakdown.value
      discipline.totalManhours += breakdown.manhours || 0
    })

    // Convert map to array and sort
    const disciplines = Array.from(disciplineMap.values()).sort((a, b) => 
      a.discipline.localeCompare(b.discipline)
    )

    // Calculate grand total
    const grandTotal = disciplines.reduce((sum, d) => sum + d.total, 0)
    const grandTotalManhours = disciplines.reduce((sum, d) => sum + d.totalManhours, 0)

    return NextResponse.json({
      project,
      disciplines,
      summary: {
        disciplineCount: disciplines.length,
        grandTotal,
        grandTotalManhours,
        costTypeCount: disciplines.reduce((sum, d) => sum + d.costTypes.length, 0)
      }
    })
  } catch (error) {
    console.error('Budget breakdown by discipline error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}