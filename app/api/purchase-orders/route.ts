import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purchase-orders - List all POs (read-only)
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = searchParams.get('limit') === 'all' ? null : parseInt(searchParams.get('limit') || '20')
    const project_id = searchParams.get('project_id')
    const sort_by = searchParams.get('sort_by')
    const sort_direction = searchParams.get('sort_direction')
    const category = searchParams.get('category') // For budget category filtering
    
    // Get column filters
    const columnFilters = new Map<string, string[]>()
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter_')) {
        const column = key.replace('filter_', '')
        columnFilters.set(column, value.split(','))
      }
    }

    // Build query with proper joins - get PO details without aggregating line items here
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        project:projects(
          id,
          job_number,
          name,
          division:divisions(id, name, code)
        ),
        cost_code:cost_codes(
          id,
          code,
          description,
          category,
          discipline
        )
      `, { count: 'exact' })

    // Apply sorting
    if (sort_by && sort_direction) {
      const ascending = sort_direction === 'asc'
      switch (sort_by) {
        case 'po_number':
          query = query.order('po_number', { ascending })
          break
        case 'vendor_name':
          query = query.order('vendor_name', { ascending })
          break
        case 'committed_amount':
          query = query.order('committed_amount', { ascending, nullsFirst: false })
          break
        case 'total_amount':
          query = query.order('total_amount', { ascending, nullsFirst: false })
          break
        case 'order_date':
          query = query.order('order_date', { ascending, nullsFirst: false })
          break
        case 'status':
          query = query.order('status', { ascending })
          break
        default:
          query = query.order('created_at', { ascending: false })
      }
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Apply filters
    if (project_id) {
      query = query.eq('project_id', project_id)
    }
    
    // Apply category filter (maps budget categories to cost code categories and cost centers)
    if (category) {
      // Map budget categories to cost centers and cost code categories
      const categoryMapping: Record<string, { costCenters: string[], costCodeCategories: string[] }> = {
        'materials': { costCenters: ['3000'], costCodeCategories: ['material'] },
        'equipment': { costCenters: ['2000'], costCodeCategories: ['equipment'] },
        'subcontracts': { costCenters: ['4000'], costCodeCategories: ['subcontract'] },
        'small tools & consumables': { costCenters: ['5000'], costCodeCategories: ['material', 'other'] },
        'add ons': { costCenters: [], costCodeCategories: ['other'] },
        'other': { costCenters: [], costCodeCategories: ['other'] }
      }
      
      const mapping = categoryMapping[category.toLowerCase()]
      
      if (mapping) {
        // Build OR conditions for category filtering
        const orConditions = []
        
        // Add cost center conditions
        if (mapping.costCenters.length > 0) {
          orConditions.push(`cost_center.in.(${mapping.costCenters.join(',')})`)
        }
        
        // Add budget category condition
        orConditions.push(`budget_category.ilike.%${category}%`)
        
        // If we have cost code categories, we need to filter by them too
        if (mapping.costCodeCategories.length > 0) {
          const { data: matchingCodes } = await supabase
            .from('cost_codes')
            .select('id')
            .in('category', mapping.costCodeCategories)
          
          if (matchingCodes && matchingCodes.length > 0) {
            const codeIds = matchingCodes.map(c => c.id)
            orConditions.push(`cost_code_id.in.(${codeIds.join(',')})`)
          }
        }
        
        // Apply the OR filter
        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','))
        }
      }
    }
    
    // Apply column filters
    for (const [column, values] of columnFilters.entries()) {
      if (values.length > 0) {
        // Special handling for related fields
        if (column === 'project_name' || column === 'project_job_number' || column === 'division_name') {
          // For related fields, we need to get matching project IDs first
          let projectQuery = supabase.from('projects').select('id')
          
          if (column === 'project_name') {
            const hasEmpty = values.includes('')
            const nonEmptyValues = values.filter(v => v !== '')
            
            if (hasEmpty && nonEmptyValues.length > 0) {
              projectQuery = projectQuery.or(`name.is.null,name.eq.,name.in.(${nonEmptyValues.join(',')})`)
            } else if (hasEmpty) {
              projectQuery = projectQuery.or(`name.is.null,name.eq.`)
            } else {
              if (nonEmptyValues.length === 1) {
                projectQuery = projectQuery.eq('name', nonEmptyValues[0])
              } else {
                projectQuery = projectQuery.in('name', nonEmptyValues)
              }
            }
          } else if (column === 'project_job_number') {
            const hasEmpty = values.includes('')
            const nonEmptyValues = values.filter(v => v !== '')
            
            if (hasEmpty && nonEmptyValues.length > 0) {
              projectQuery = projectQuery.or(`job_number.is.null,job_number.eq.,job_number.in.(${nonEmptyValues.join(',')})`)
            } else if (hasEmpty) {
              projectQuery = projectQuery.or(`job_number.is.null,job_number.eq.`)
            } else {
              if (nonEmptyValues.length === 1) {
                projectQuery = projectQuery.eq('job_number', nonEmptyValues[0])
              } else {
                projectQuery = projectQuery.in('job_number', nonEmptyValues)
              }
            }
          } else if (column === 'division_name') {
            // For division name, we need to join with divisions table
            projectQuery = supabase
              .from('projects')
              .select('id, divisions!inner(name)')
            
            const nonEmptyValues = values.filter(v => v !== '')
            
            if (nonEmptyValues.length > 0) {
              projectQuery = projectQuery.in('divisions.name', nonEmptyValues)
            }
          }
          
          // Execute the project query to get matching IDs
          const { data: matchingProjects } = await projectQuery
          
          if (matchingProjects && matchingProjects.length > 0) {
            const projectIds = matchingProjects.map(p => p.id)
            query = query.in('project_id', projectIds)
          } else {
            // No matching projects found, ensure no results
            query = query.eq('project_id', '00000000-0000-0000-0000-000000000000')
          }
        } else if (column === 'committed_amount') {
          // Special handling for amount ranges
          const orConditions = []
          for (const value of values) {
            switch (value) {
              case '$0':
                orConditions.push('committed_amount.eq.0')
                break
              case '< $10K':
                orConditions.push('committed_amount.gt.0,committed_amount.lt.10000')
                break
              case '$10K - $50K':
                orConditions.push('committed_amount.gte.10000,committed_amount.lt.50000')
                break
              case '$50K - $100K':
                orConditions.push('committed_amount.gte.50000,committed_amount.lt.100000')
                break
              case '$100K - $500K':
                orConditions.push('committed_amount.gte.100000,committed_amount.lt.500000')
                break
              case '> $500K':
                orConditions.push('committed_amount.gte.500000')
                break
              case '':
                orConditions.push('committed_amount.is.null')
                break
            }
          }
          if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
          }
        } else {
          // Handle direct fields on purchase_orders table
          const hasEmpty = values.includes('')
          const nonEmptyValues = values.filter(v => v !== '')
          
          if (hasEmpty && nonEmptyValues.length > 0) {
            // Include both null/empty and specific values
            query = query.or(`${column}.is.null,${column}.eq.,${column}.in.(${nonEmptyValues.join(',')})`)
          } else if (hasEmpty) {
            // Only null/empty values
            query = query.or(`${column}.is.null,${column}.eq.`)
          } else {
            // Only non-empty values
            if (nonEmptyValues.length === 1) {
              query = query.eq(column, nonEmptyValues[0])
            } else {
              query = query.in(column, nonEmptyValues)
            }
          }
        }
      }
    }

    // Apply pagination (only if limit is not null)
    if (limit !== null) {
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)
    }

    const { data: purchase_orders, count, error } = await query

    if (error) {
      console.error('Purchase orders query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json({ 
        error: 'Failed to fetch purchase orders',
        details: error.message 
      }, { status: 400 })
    }

    // Get line item counts and totals for the current page POs
    let poLineItemsData: Record<string, { count: number; total_amount: number }> = {}
    if (purchase_orders && purchase_orders.length > 0) {
      const poIds = purchase_orders.map(po => po.id)
      const { data: lineItemStats } = await supabase
        .from('po_line_items')
        .select('purchase_order_id, total_amount')
        .in('purchase_order_id', poIds)
      
      if (lineItemStats && Array.isArray(lineItemStats)) {
        // Aggregate by purchase_order_id with proper validation
        poLineItemsData = lineItemStats.reduce((acc, item) => {
          if (!item?.purchase_order_id) return acc
          
          if (!acc[item.purchase_order_id]) {
            acc[item.purchase_order_id] = { count: 0, total_amount: 0 }
          }
          acc[item.purchase_order_id].count += 1
          
          const amount = item.total_amount || 0
          acc[item.purchase_order_id].total_amount += (typeof amount === 'number' ? amount : 0)
          return acc
        }, {} as Record<string, { count: number; total_amount: number }>)
      }
    }

    // Calculate aggregated stats from FILTERED POs (respecting current filters)
    // Build a query for summary that applies the same filters as the main query
    let summaryQuery = supabase
      .from('purchase_orders')
      .select('id, committed_amount, total_amount')
      .eq('status', 'approved') // Only count approved POs for totals
    
    // Apply the same filters to summary query
    if (project_id) {
      summaryQuery = summaryQuery.eq('project_id', project_id)
    }
    
    // Apply category filter to summary query
    if (category) {
      const categoryMapping: Record<string, { costCenters: string[], costCodeCategories: string[] }> = {
        'materials': { costCenters: ['3000'], costCodeCategories: ['material'] },
        'equipment': { costCenters: ['2000'], costCodeCategories: ['equipment'] },
        'subcontracts': { costCenters: ['4000'], costCodeCategories: ['subcontract'] },
        'small tools & consumables': { costCenters: ['5000'], costCodeCategories: ['material', 'other'] },
        'add ons': { costCenters: [], costCodeCategories: ['other'] },
        'other': { costCenters: [], costCodeCategories: ['other'] }
      }
      
      const mapping = categoryMapping[category.toLowerCase()]
      
      if (mapping) {
        const orConditions = []
        
        if (mapping.costCenters.length > 0) {
          orConditions.push(`cost_center.in.(${mapping.costCenters.join(',')})`)
        }
        
        orConditions.push(`budget_category.ilike.%${category}%`)
        
        if (mapping.costCodeCategories.length > 0) {
          const { data: matchingCodes } = await supabase
            .from('cost_codes')
            .select('id')
            .in('category', mapping.costCodeCategories)
          
          if (matchingCodes && matchingCodes.length > 0) {
            const codeIds = matchingCodes.map(c => c.id)
            orConditions.push(`cost_code_id.in.(${codeIds.join(',')})`)
          }
        }
        
        if (orConditions.length > 0) {
          summaryQuery = summaryQuery.or(orConditions.join(','))
        }
      }
    }
    
    // Apply column filters to summary query
    for (const [column, values] of columnFilters.entries()) {
      if (values.length > 0) {
        if (column === 'project_name' || column === 'project_job_number' || column === 'division_name') {
          // For related fields, we already have the project IDs from the main query
          // We need to recreate the same filtering logic
          let projectQuery = supabase.from('projects').select('id')
          
          if (column === 'project_name') {
            const hasEmpty = values.includes('')
            const nonEmptyValues = values.filter(v => v !== '')
            
            if (hasEmpty && nonEmptyValues.length > 0) {
              projectQuery = projectQuery.or(`name.is.null,name.eq.,name.in.(${nonEmptyValues.join(',')})`)
            } else if (hasEmpty) {
              projectQuery = projectQuery.or(`name.is.null,name.eq.`)
            } else {
              if (nonEmptyValues.length === 1) {
                projectQuery = projectQuery.eq('name', nonEmptyValues[0])
              } else {
                projectQuery = projectQuery.in('name', nonEmptyValues)
              }
            }
          } else if (column === 'project_job_number') {
            const hasEmpty = values.includes('')
            const nonEmptyValues = values.filter(v => v !== '')
            
            if (hasEmpty && nonEmptyValues.length > 0) {
              projectQuery = projectQuery.or(`job_number.is.null,job_number.eq.,job_number.in.(${nonEmptyValues.join(',')})`)
            } else if (hasEmpty) {
              projectQuery = projectQuery.or(`job_number.is.null,job_number.eq.`)
            } else {
              if (nonEmptyValues.length === 1) {
                projectQuery = projectQuery.eq('job_number', nonEmptyValues[0])
              } else {
                projectQuery = projectQuery.in('job_number', nonEmptyValues)
              }
            }
          } else if (column === 'division_name') {
            projectQuery = supabase
              .from('projects')
              .select('id, divisions!inner(name)')
            
            const nonEmptyValues = values.filter(v => v !== '')
            if (nonEmptyValues.length > 0) {
              projectQuery = projectQuery.in('divisions.name', nonEmptyValues)
            }
          }
          
          const { data: matchingProjects } = await projectQuery
          
          if (matchingProjects && matchingProjects.length > 0) {
            const projectIds = matchingProjects.map(p => p.id)
            summaryQuery = summaryQuery.in('project_id', projectIds)
          } else {
            summaryQuery = summaryQuery.eq('project_id', '00000000-0000-0000-0000-000000000000')
          }
        } else if (column === 'committed_amount') {
          const orConditions = []
          for (const value of values) {
            switch (value) {
              case '$0':
                orConditions.push('committed_amount.eq.0')
                break
              case '< $10K':
                orConditions.push('committed_amount.gt.0,committed_amount.lt.10000')
                break
              case '$10K - $50K':
                orConditions.push('committed_amount.gte.10000,committed_amount.lt.50000')
                break
              case '$50K - $100K':
                orConditions.push('committed_amount.gte.50000,committed_amount.lt.100000')
                break
              case '$100K - $500K':
                orConditions.push('committed_amount.gte.100000,committed_amount.lt.500000')
                break
              case '> $500K':
                orConditions.push('committed_amount.gte.500000')
                break
              case '':
                orConditions.push('committed_amount.is.null')
                break
            }
          }
          if (orConditions.length > 0) {
            summaryQuery = summaryQuery.or(orConditions.join(','))
          }
        } else {
          const hasEmpty = values.includes('')
          const nonEmptyValues = values.filter(v => v !== '')
          
          if (hasEmpty && nonEmptyValues.length > 0) {
            summaryQuery = summaryQuery.or(`${column}.is.null,${column}.eq.,${column}.in.(${nonEmptyValues.join(',')})`)
          } else if (hasEmpty) {
            summaryQuery = summaryQuery.or(`${column}.is.null,${column}.eq.`)
          } else {
            if (nonEmptyValues.length === 1) {
              summaryQuery = summaryQuery.eq(column, nonEmptyValues[0])
            } else {
              summaryQuery = summaryQuery.in(column, nonEmptyValues)
            }
          }
        }
      }
    }
    
    const { data: filteredPOs } = await summaryQuery
    
    // Get the PO IDs for filtered line items calculation
    const filteredPOIds = filteredPOs?.map(po => po.id) || []
    
    // Calculate total invoiced from line items for filtered POs only
    let filteredLineItems: { total_amount: number }[] = []
    if (filteredPOIds.length > 0) {
      const { data } = await supabase
        .from('po_line_items')
        .select('total_amount')
        .in('purchase_order_id', filteredPOIds)
      filteredLineItems = data || []
    }
    
    let totalCommitted = 0
    let totalInvoiced = 0
    
    // Calculate totals with proper null/undefined handling
    if (filteredPOs && Array.isArray(filteredPOs)) {
      totalCommitted = filteredPOs.reduce((sum, po) => {
        // Use committed_amount if available, fallback to total_amount for backward compatibility
        const amount = po?.committed_amount ?? po?.total_amount ?? 0
        return sum + (typeof amount === 'number' ? amount : 0)
      }, 0)
    }
    
    if (filteredLineItems && Array.isArray(filteredLineItems)) {
      totalInvoiced = filteredLineItems.reduce((sum, item) => {
        const amount = item?.total_amount || 0
        return sum + (typeof amount === 'number' ? amount : 0)
      }, 0)
    }

    // Add line item data to each purchase order
    const enhancedPurchaseOrders = purchase_orders?.map(po => ({
      ...po,
      po_line_items: poLineItemsData[po.id] || { count: 0, total_amount: 0 }
    }))

    // Calculate pagination info
    const totalPages = limit ? Math.ceil((count || 0) / limit) : 1

    return NextResponse.json({
      purchase_orders: enhancedPurchaseOrders,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      },
      summary: {
        totalCommitted,
        totalInvoiced,
        totalRemaining: totalCommitted - totalInvoiced
      }
    })
  } catch (error) {
    console.error('List purchase orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}