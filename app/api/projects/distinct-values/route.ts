import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/projects/distinct-values - Get unique values for a column
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const column = searchParams.get('column')
    const search = searchParams.get('search')

    if (!column) {
      return NextResponse.json({ error: 'Column parameter is required' }, { status: 400 })
    }

    // Define allowed columns to prevent SQL injection
    const allowedColumns = {
      'job_number': 'job_number',
      'name': 'name',
      'status': 'status',
      'start_date': 'start_date',
      'end_date': 'end_date',
      'original_contract': 'original_contract',
      'revised_contract': 'revised_contract',
      'client_name': 'clients.name',
      'division_name': 'divisions.name',
      'project_manager_name': 'profiles.first_name,profiles.last_name'
    }

    if (!allowedColumns[column as keyof typeof allowedColumns]) {
      return NextResponse.json({ error: 'Invalid column parameter' }, { status: 400 })
    }

    let query
    
    // Handle different column types
    if (column === 'client_name' || column === 'division_name' || column === 'project_manager_name') {
      // For related fields, we need to join tables
      query = supabase
        .from('projects')
        .select(`
          client:clients!projects_client_id_fkey(name),
          division:divisions!projects_division_id_fkey(name),
          project_manager:profiles!projects_project_manager_id_fkey(first_name, last_name)
        `)
    } else {
      // For direct fields on projects table
      query = supabase
        .from('projects')
        .select(column)
    }

    const { data: results, error } = await query

    if (error) {
      console.error('Distinct values query error:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch distinct values',
        details: error.message 
      }, { status: 400 })
    }

    // Extract and count unique values
    const valueMap = new Map<string, number>()
    
    if (results) {
      results.forEach((row: Record<string, unknown>) => {
        let value: string | null = null
        
        switch (column) {
          case 'client_name':
            value = row.client?.name || null
            break
          case 'division_name':
            value = row.division?.name || null
            break
          case 'project_manager_name':
            if (row.project_manager) {
              value = `${row.project_manager.first_name} ${row.project_manager.last_name}`
            }
            break
          case 'start_date':
          case 'end_date':
            value = row[column] ? new Date(row[column]).toLocaleDateString() : null
            break
          case 'original_contract':
          case 'revised_contract':
            // For amounts, we'll create ranges instead of exact values
            const amount = row[column] || 0
            if (amount === 0) {
              value = '$0'
            } else if (amount < 1000000) {
              value = '< $1M'
            } else if (amount < 5000000) {
              value = '$1M - $5M'
            } else if (amount < 10000000) {
              value = '$5M - $10M'
            } else if (amount < 50000000) {
              value = '$10M - $50M'
            } else {
              value = '> $50M'
            }
            break
          default:
            value = row[column] || null
        }
        
        const key = value || '(Blank)'
        valueMap.set(key, (valueMap.get(key) || 0) + 1)
      })
    }

    // Convert to array and sort
    let distinctValues = Array.from(valueMap.entries()).map(([value, count]) => ({
      value: value === '(Blank)' ? '' : value,
      label: value,
      count
    }))

    // Apply search filter if provided
    if (search) {
      distinctValues = distinctValues.filter(item => 
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Sort alphabetically, with blanks at the end
    // Special sorting for amount ranges
    if (column === 'original_contract' || column === 'revised_contract') {
      const amountOrder = ['$0', '< $1M', '$1M - $5M', '$5M - $10M', '$10M - $50M', '> $50M', '(Blank)']
      distinctValues.sort((a, b) => {
        const aIndex = amountOrder.indexOf(a.label)
        const bIndex = amountOrder.indexOf(b.label)
        if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label)
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    } else if (column === 'status') {
      // Custom sort for status
      const statusOrder = ['planning', 'active', 'on_hold', 'completed', 'cancelled', '(Blank)']
      distinctValues.sort((a, b) => {
        const aIndex = statusOrder.indexOf(a.label)
        const bIndex = statusOrder.indexOf(b.label)
        if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label)
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    } else {
      distinctValues.sort((a, b) => {
        if (a.label === '(Blank)') return 1
        if (b.label === '(Blank)') return -1
        return a.label.localeCompare(b.label)
      })
    }

    return NextResponse.json({
      column,
      values: distinctValues,
      total: distinctValues.length
    })
  } catch (error) {
    console.error('Get distinct values error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}