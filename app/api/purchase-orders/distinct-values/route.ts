import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders/distinct-values - Get unique values for a column
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
      'po_number': 'po_number',
      'vendor_name': 'vendor_name', 
      'status': 'status',
      'order_date': 'order_date',
      'description': 'description',
      'committed_amount': 'committed_amount',
      'project_name': 'projects.name',
      'project_job_number': 'projects.job_number',
      'division_name': 'divisions.name'
    }

    if (!allowedColumns[column as keyof typeof allowedColumns]) {
      return NextResponse.json({ error: 'Invalid column parameter' }, { status: 400 })
    }

    // const columnPath = allowedColumns[column as keyof typeof allowedColumns]

    let query
    
    // Handle different column types
    if (column === 'project_name' || column === 'project_job_number' || column === 'division_name') {
      // For related fields, we need to join tables
      query = supabase
        .from('purchase_orders')
        .select(`
          projects!inner(
            name,
            job_number,
            divisions!inner(name)
          )
        `)
    } else {
      // For direct fields on purchase_orders table
      query = supabase
        .from('purchase_orders')
        .select(column)
    }

    const { data: results, error } = await query

    if (error) {
      console.error('Distinct values query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        column: column
      })
      return NextResponse.json({ 
        error: 'Failed to fetch distinct values',
        details: error.message,
        column: column
      }, { status: 400 })
    }

    // Extract and count unique values
    const valueMap = new Map<string, number>()
    
    if (results) {
      results.forEach((row: Record<string, any>) => {
        let value: string | null = null
        
        switch (column) {
          case 'project_name':
            value = row.projects?.name || null
            break
          case 'project_job_number':
            value = row.projects?.job_number || null
            break
          case 'division_name':
            value = row.projects?.divisions?.name || null
            break
          case 'order_date':
            value = row.order_date ? new Date(row.order_date as string).toLocaleDateString() : null
            break
          case 'committed_amount':
            // For amounts, we'll create ranges instead of exact values
            const amount = Number(row.committed_amount || row.total_amount || 0)
            if (amount === 0) {
              value = '$0'
            } else if (amount < 10000) {
              value = '< $10K'
            } else if (amount < 50000) {
              value = '$10K - $50K'
            } else if (amount < 100000) {
              value = '$50K - $100K'
            } else if (amount < 500000) {
              value = '$100K - $500K'
            } else {
              value = '> $500K'
            }
            break
          default:
            value = row[column] ? String(row[column]) : null
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
    if (column === 'committed_amount') {
      const amountOrder = ['$0', '< $10K', '$10K - $50K', '$50K - $100K', '$100K - $500K', '> $500K', '(Blank)']
      distinctValues.sort((a, b) => {
        const aIndex = amountOrder.indexOf(a.label)
        const bIndex = amountOrder.indexOf(b.label)
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