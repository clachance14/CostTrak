import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  headcountBatchSchema
} from '@/lib/validations/labor-forecast-v2'
// Date conversion functions no longer needed - using week_ending directly
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/labor-forecasts/headcount - Get headcount forecast data with category rates
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    const weeksAhead = parseInt(request.nextUrl.searchParams.get('weeks_ahead') || '12', 10)
    const startDateParam = request.nextUrl.searchParams.get('start_date')
    
    console.log('[DEBUG] GET /api/labor-forecasts/headcount starting with:', { projectId, weeksAhead, startDateParam })

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Calculate date range (using week ending dates)
    const startDate = startDateParam ? new Date(startDateParam + 'T00:00:00.000Z') : new Date()
    const weeks = []
    console.log('[DEBUG] Generating weeks starting from:', startDate.toISOString())
    
    for (let i = 0; i < weeksAhead; i++) {
      const weekDate = new Date(startDate)
      weekDate.setDate(startDate.getDate() + i * 7)
      // Calculate Sunday week ending
      const dayOfWeek = weekDate.getDay()
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
      const weekEnding = new Date(weekDate)
      weekEnding.setDate(weekDate.getDate() + daysToSunday)
      weekEnding.setHours(0, 0, 0, 0)
      weeks.push(weekEnding)
      
      if (i < 10) { // Log first 10 weeks
        console.log(`[DEBUG] Week ${i}: ${weekEnding.toISOString().split('T')[0]} (${weekEnding.toLocaleDateString('en-US', { weekday: 'long' })})`)
      }
    }

    // Get category rates using the new database function
    console.log('Fetching category rates for headcount forecast...')
    const { data: categoryRates, error: ratesError } = await supabase
      .rpc('get_headcount_category_rates', {
        p_project_id: projectId,
        p_weeks_back: 8
      })
    
    if (ratesError) {
      console.error('Error fetching category rates:', ratesError)
      throw ratesError
    }

    // Create rate map
    const rateMap = new Map<string, number>()
    categoryRates?.forEach(rate => {
      rateMap.set(rate.category, Number(rate.avg_rate) || 0)
    })

    console.log('Category rates:', {
      direct: rateMap.get('direct') || 0,
      indirect: rateMap.get('indirect') || 0,
      staff: rateMap.get('staff') || 0
    })
    
    // Get all craft types to understand the data
    const { data: allCraftTypes } = await supabase
      .from('craft_types')
      .select('id, name, category')
      .order('category', { ascending: true })
    
    console.log('[DEBUG] Available craft types:')
    allCraftTypes?.forEach(ct => {
      console.log(`  - ${ct.id}: ${ct.name} (${ct.category})`)
    })

    // Debug the query parameters
    console.log('[DEBUG] Querying headcount forecasts with:')
    console.log('- project_id:', projectId)
    console.log('- week_ending >=', weeks[0].toISOString().split('T')[0])
    console.log('- week_ending <=', weeks[weeks.length - 1].toISOString().split('T')[0])
    
    // First check if ANY data exists for this project
    const { data: allProjectData, error: allError } = await supabase
      .from('labor_headcount_forecasts')
      .select('*')
      .eq('project_id', projectId)
      .limit(10)
    
    if (allError) {
      console.error('[ERROR] Failed to fetch any project data:', allError)
    } else {
      console.log('[DEBUG] Total records for project (no date filter):', allProjectData?.length || 0)
      if (allProjectData && allProjectData.length > 0) {
        console.log('[DEBUG] Sample dates from database:')
        allProjectData.forEach(record => {
          console.log(`  - ${record.week_starting} (headcount: ${record.headcount})`)
        })
      }
    }
    
    // First, try to get headcount data without the join to see if data exists
    const { data: simpleHeadcounts, error: simpleError } = await supabase
      .from('labor_headcount_forecasts')
      .select('*')
      .eq('project_id', projectId)
      .gte('week_ending', weeks[0].toISOString().split('T')[0])
      .lte('week_ending', weeks[weeks.length - 1].toISOString().split('T')[0])
    
    if (simpleError) {
      console.error('[ERROR] Simple headcount query failed:', simpleError)
    } else {
      console.log('[DEBUG] Simple query found', simpleHeadcounts?.length || 0, 'records')
      if (simpleHeadcounts && simpleHeadcounts.length > 0) {
        console.log('[DEBUG] Sample record:', simpleHeadcounts[0])
      }
    }
    
    // Get existing headcount forecasts with craft type data
    const { data: headcounts, error: headcountError } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        week_ending,
        headcount,
        avg_weekly_hours,
        craft_type_id,
        craft_types(
          id,
          name,
          code,
          category
        )
      `)
      .eq('project_id', projectId)
      .gte('week_ending', weeks[0].toISOString().split('T')[0])
      .lte('week_ending', weeks[weeks.length - 1].toISOString().split('T')[0])

    if (headcountError) {
      console.error('[ERROR] Headcount query with join failed:', headcountError)
    }
    
    console.log('Found', headcounts?.length || 0, 'headcount forecast records with craft type data')
    
    // Debug: Log actual database dates
    if (headcounts && headcounts.length > 0) {
      console.log('[DEBUG] Sample database records:')
      const uniqueDates = new Set(headcounts.map(h => h.week_starting))
      Array.from(uniqueDates).slice(0, 10).forEach(date => {
        const d = new Date(date)
        console.log(`[DEBUG] DB week_starting: ${date.split('T')[0]} (${d.toLocaleDateString('en-US', { weekday: 'long' })})`)
      })
    }

    // Always ensure we have craft type data - use joined data if available, otherwise map manually
    let finalHeadcounts = headcounts
    
    // Check if any headcount records are missing craft_types data (failed join)
    const needsMapping = headcounts?.some(hc => !hc.craft_types) || !headcounts || headcounts.length === 0
    
    if (needsMapping && simpleHeadcounts && simpleHeadcounts.length > 0) {
      console.log('[DEBUG] Mapping craft types manually for', simpleHeadcounts.length, 'records')
      
      // Create a craft type map
      const craftTypeMap = new Map<string, any>()
      allCraftTypes?.forEach(ct => {
        craftTypeMap.set(ct.id, ct)
      })
      
      console.log('[DEBUG] Available craft types:', Array.from(craftTypeMap.entries()).map(([id, ct]) => `${ct.name} (${ct.category})`))
      
      // Map the simple results
      finalHeadcounts = simpleHeadcounts.map(hc => ({
        ...hc,
        craft_types: craftTypeMap.get(hc.craft_type_id) || { 
          id: hc.craft_type_id,
          name: 'Unknown',
          category: 'direct' // Default fallback
        }
      }))
      
      console.log('[DEBUG] Successfully mapped', finalHeadcounts.length, 'records')
      // Log sample mapping
      if (finalHeadcounts.length > 0) {
        const sample = finalHeadcounts[0]
        console.log('[DEBUG] Sample mapped record:', {
          craft_type_id: sample.craft_type_id,
          category: (sample.craft_types as any)?.category,
          headcount: sample.headcount,
          week_starting: sample.week_starting
        })
      }
    }
    
    // Aggregate headcounts by week and category
    const headcountByWeekCategory = new Map<string, { direct: number; indirect: number; staff: number; hours: number }>()
    
    console.log('[DEBUG] Starting aggregation of', finalHeadcounts?.length || 0, 'headcount records')
    
    finalHeadcounts?.forEach((hc, index) => {
      // Handle both date formats - database might have date-only strings
      let weekDate: string
      try {
        if (hc.week_ending.includes('T')) {
          // Full ISO timestamp
          weekDate = new Date(hc.week_ending).toISOString().split('T')[0]
        } else {
          // Date-only string (e.g., "2025-08-04")
          weekDate = hc.week_ending
        }
      } catch (err) {
        console.error(`[ERROR] Failed to parse week_ending: ${hc.week_ending}`, err)
        weekDate = hc.week_ending // Use as-is
      }
      
      const category = (hc.craft_types as { category: string })?.category || 'direct'
      
      if (index < 3) { // Log first few for debugging
        console.log(`[DEBUG] Record ${index}: week_ending=${hc.week_ending}, category=${category}, headcount=${hc.headcount}`)
      }
      
      if (!headcountByWeekCategory.has(weekDate)) {
        headcountByWeekCategory.set(weekDate, { direct: 0, indirect: 0, staff: 0, hours: Number(hc.avg_weekly_hours) || 50 })
      }
      
      const weekData = headcountByWeekCategory.get(weekDate)!
      if (category in weekData) {
        weekData[category as 'direct' | 'indirect' | 'staff'] += hc.headcount
      }
    })
    
    console.log('[DEBUG] Aggregated data by week:')
    headcountByWeekCategory.forEach((data, weekDate) => {
      const total = data.direct + data.indirect + data.staff
      if (total > 0) {
        console.log(`  ${weekDate}: direct=${data.direct}, indirect=${data.indirect}, staff=${data.staff}`)
      }
    })
    
    console.log('[DEBUG] Aggregated headcount data:')
    headcountByWeekCategory.forEach((data, week) => {
      if (data.direct > 0 || data.indirect > 0 || data.staff > 0) {
        console.log(`  - ${week}: Direct=${data.direct}, Indirect=${data.indirect}, Staff=${data.staff}`)
      }
    })

    // Build response structure
    const weeklyData = weeks.map(weekEndingDate => {
      const weekDateOnly = weekEndingDate.toISOString().split('T')[0]
      const weekData = headcountByWeekCategory.get(weekDateOnly) || { direct: 0, indirect: 0, staff: 0, hours: 50 }
      
      // Create entries for each category
      const entries = [
        {
          laborCategory: 'direct',
          categoryName: 'Direct',
          headcount: weekData.direct,
          hoursPerPerson: weekData.hours,
          totalHours: weekData.direct * weekData.hours,
          avgRate: rateMap.get('direct') || 0,
          forecastedCost: weekData.direct * weekData.hours * (rateMap.get('direct') || 0)
        },
        {
          laborCategory: 'indirect',
          categoryName: 'Indirect',
          headcount: weekData.indirect,
          hoursPerPerson: weekData.hours,
          totalHours: weekData.indirect * weekData.hours,
          avgRate: rateMap.get('indirect') || 0,
          forecastedCost: weekData.indirect * weekData.hours * (rateMap.get('indirect') || 0)
        },
        {
          laborCategory: 'staff',
          categoryName: 'Staff',
          headcount: weekData.staff,
          hoursPerPerson: weekData.hours,
          totalHours: weekData.staff * weekData.hours,
          avgRate: rateMap.get('staff') || 0,
          forecastedCost: weekData.staff * weekData.hours * (rateMap.get('staff') || 0)
        }
      ]

      // Calculate week totals
      const weekTotals = entries.reduce((totals, entry) => ({
        headcount: totals.headcount + entry.headcount,
        totalHours: totals.totalHours + entry.totalHours,
        forecastedCost: totals.forecastedCost + entry.forecastedCost
      }), { headcount: 0, totalHours: 0, forecastedCost: 0 })

      return {
        weekEnding: weekEndingDate.toISOString(),
        entries,
        totals: weekTotals
      }
    })

    // Calculate grand totals
    const grandTotals = weeklyData.reduce((totals, week) => ({
      headcount: totals.headcount + week.totals.headcount,
      totalHours: totals.totalHours + week.totals.totalHours,
      forecastedCost: totals.forecastedCost + week.totals.forecastedCost
    }), { headcount: 0, totalHours: 0, forecastedCost: 0 })

    const response = {
      project: {
        id: project.id,
        jobNumber: project.job_number,
        name: project.name
      },
      weeks: weeklyData,
      grandTotals,
      categories: [
        { id: 'direct', name: 'Direct', laborCategory: 'direct', avgRate: rateMap.get('direct') || 0 },
        { id: 'indirect', name: 'Indirect', laborCategory: 'indirect', avgRate: rateMap.get('indirect') || 0 },
        { id: 'staff', name: 'Staff', laborCategory: 'staff', avgRate: rateMap.get('staff') || 0 }
      ]
    }
    
    console.log('Returning response with', response.weeks.length, 'weeks and', response.categories.length, 'categories')
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[ERROR] Headcount forecast fetch error:', error)
    console.error('[ERROR] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch headcount forecast', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/labor-forecasts/headcount - Save headcount forecast batch
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    console.log('[DEBUG] POST /api/labor-forecasts/headcount received:', {
      project_id: body.project_id,
      weeks_count: body.weeks?.length,
      first_week: body.weeks?.[0]
    })
    const validatedData = headcountBatchSchema.parse(body)

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validatedData.project_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get craft types for each category
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('id, category')
      .in('category', ['direct', 'indirect', 'staff'])

    // Create a map of category to craft type IDs
    const categoryToCraftTypes = new Map<string, string[]>()
    craftTypes?.forEach(ct => {
      if (!categoryToCraftTypes.has(ct.category)) {
        categoryToCraftTypes.set(ct.category, [])
      }
      categoryToCraftTypes.get(ct.category)!.push(ct.id)
    })

    const results = []
    const errors = []

    // Find or create category-level craft types
    const categoryToCraftTypeId = new Map<string, string>()
    
    // First, look for craft types that match category names exactly
    const { data: categoryLevelCraftTypes } = await supabase
      .from('craft_types')
      .select('id, name, category')
      .in('name', ['Direct Labor', 'Indirect Labor', 'Staff'])
    
    categoryLevelCraftTypes?.forEach(ct => {
      if (ct.name === 'Direct Labor' && ct.category === 'direct') {
        categoryToCraftTypeId.set('direct', ct.id)
      } else if (ct.name === 'Indirect Labor' && ct.category === 'indirect') {
        categoryToCraftTypeId.set('indirect', ct.id)
      } else if (ct.name === 'Staff' && ct.category === 'staff') {
        categoryToCraftTypeId.set('staff', ct.id)
      }
    })
    
    // If we didn't find category-level craft types, create them
    if (categoryToCraftTypeId.size < 3) {
      console.log('[DEBUG] Missing category craft types. Current mappings:', Object.fromEntries(categoryToCraftTypeId))
      const missingCategories = ['direct', 'indirect', 'staff'].filter(
        cat => !categoryToCraftTypeId.has(cat)
      )
      
      console.log('[DEBUG] Need to create craft types for:', missingCategories)
      
      // Create the missing category craft types
      for (const category of missingCategories) {
        const craftTypeData = {
          name: category === 'direct' ? 'Direct Labor' : 
                category === 'indirect' ? 'Indirect Labor' : 'Staff',
          code: category === 'direct' ? 'DL' : 
                category === 'indirect' ? 'IL' : 'ST',
          category: category as 'direct' | 'indirect' | 'staff',
          default_rate: category === 'direct' ? 50 : 
                       category === 'indirect' ? 45 : 75,
          is_active: true
        }
        
        console.log(`[DEBUG] Creating craft type:`, craftTypeData)
        
        const { data: newCraftType, error: createError } = await supabase
          .from('craft_types')
          .insert(craftTypeData)
          .select()
          .single()
          
        if (createError) {
          console.error(`Failed to create craft type for ${category}:`, createError)
          // Try to use first existing craft type in category as fallback
          const craftTypesInCategory = categoryToCraftTypes.get(category) || []
          if (craftTypesInCategory.length > 0) {
            categoryToCraftTypeId.set(category, craftTypesInCategory[0])
            console.log(`Using first existing craft type for ${category}: ${craftTypesInCategory[0]}`)
          }
        } else if (newCraftType) {
          categoryToCraftTypeId.set(category, newCraftType.id)
          console.log(`Created and using new craft type for ${category}: ${newCraftType.id}`)
        }
      }
    }
    
    console.log('Category to craft type mapping:', Object.fromEntries(categoryToCraftTypeId))
    console.log('[DEBUG] Validation passed. Processing', validatedData.weeks.length, 'weeks')

    // Process each week
    for (const week of validatedData.weeks) {
      // Use week_ending directly - no conversion needed
      const weekEndingDate = new Date(week.week_ending)
      
      // Normalize to UTC midnight for consistent storage
      weekEndingDate.setUTCHours(0, 0, 0, 0)
      const formattedWeekEnding = weekEndingDate.toISOString()
      const weekEndingDateOnly = formattedWeekEnding.split('T')[0]

      for (const entry of week.entries) {
        try {
          // The entry.craft_type_id actually contains the category name
          const category = entry.craft_type_id as string
          const craftTypeId = categoryToCraftTypeId.get(category)
          
          if (!craftTypeId) {
            console.warn(`No craft type found for category: ${category}`)
            console.log('[DEBUG] Available mappings:', Object.fromEntries(categoryToCraftTypeId))
            continue
          }
          
          console.log(`[DEBUG] Processing entry: category=${category}, headcount=${entry.headcount}, craftTypeId=${craftTypeId}`)

          // Skip if headcount is 0 (delete existing if any)
          if (entry.headcount === 0) {
            const { error: deleteError } = await supabase
              .from('labor_headcount_forecasts')
              .delete()
              .eq('project_id', validatedData.project_id)
              .eq('craft_type_id', craftTypeId)
              .eq('week_ending', formattedWeekEnding)

            if (deleteError && deleteError.code !== 'PGRST116') {
              throw deleteError
            }

            results.push({
              action: 'deleted',
              week_ending: weekEndingDateOnly,
              category: category,
              craft_type_id: craftTypeId
            })
            continue
          }

          // Check if entry exists using date-only comparison
          const { data: existing } = await supabase
            .from('labor_headcount_forecasts')
            .select('*')
            .eq('project_id', validatedData.project_id)
            .eq('craft_type_id', craftTypeId)
            .gte('week_ending', `${weekEndingDateOnly}T00:00:00`)
            .lt('week_ending', `${weekEndingDateOnly}T23:59:59`)
            .single()

          if (existing) {
            // Update existing entry
            const { error: updateError } = await supabase
              .from('labor_headcount_forecasts')
              .update({
                headcount: entry.headcount,
                avg_weekly_hours: entry.hours_per_person || 50,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)

            if (updateError) throw updateError

            results.push({
              action: 'updated',
              id: existing.id,
              week_ending: weekEndingDateOnly,
              category: category,
              craft_type_id: craftTypeId,
              headcount: entry.headcount
            })
          } else {
            // Create new entry
            const { data: created, error: createError } = await supabase
              .from('labor_headcount_forecasts')
              .insert({
                project_id: validatedData.project_id,
                craft_type_id: craftTypeId,
                week_ending: formattedWeekEnding,
                headcount: entry.headcount,
                avg_weekly_hours: entry.hours_per_person || 50
              })
              .select()
              .single()

            if (createError) throw createError

            results.push({
              action: 'created',
              id: created.id,
              week_ending: weekEndingDateOnly,
              category: category,
              craft_type_id: craftTypeId,
              headcount: entry.headcount
            })
          }
        } catch (error) {
          console.error('Entry processing error:', error)
          errors.push({
            week_ending: weekEndingDateOnly,
            category: entry.craft_type_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Log batch update to audit trail
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'batch_update',
      entity_type: 'labor_headcount_forecast',
      entity_id: validatedData.project_id,
      changes: {
        weeks_updated: validatedData.weeks.length,
        results_summary: {
          created: results.filter(r => r.action === 'created').length,
          updated: results.filter(r => r.action === 'updated').length,
          deleted: results.filter(r => r.action === 'deleted').length
        }
      }
    })

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        created: results.filter(r => r.action === 'created').length,
        updated: results.filter(r => r.action === 'updated').length,
        deleted: results.filter(r => r.action === 'deleted').length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('Headcount batch error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to save headcount forecast' },
      { status: 500 }
    )
  }
}