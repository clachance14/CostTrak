#!/usr/bin/env tsx

import { createClient } from '@/lib/supabase/client'

async function debugHeadcountQuery() {
  console.log('🔍 Debugging Headcount Query')
  console.log('=' .repeat(60))
  
  const supabase = createClient()
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
  
  // First, check if there's any data at all
  console.log('1. Checking if any headcount data exists for project...')
  const { data: allData, error: allError } = await supabase
    .from('labor_headcount_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .limit(10)
    
  if (allError) {
    console.error('Error fetching all data:', allError)
  } else {
    console.log(`Found ${allData?.length || 0} total headcount records`)
    if (allData && allData.length > 0) {
      console.log('Sample records:')
      allData.forEach(record => {
        console.log(`- Week: ${record.week_starting}, Headcount: ${record.headcount}, Craft: ${record.craft_type_id}`)
      })
    }
  }
  
  // Check with the exact query from the API
  console.log('\n2. Testing API query with date range...')
  const { data: rangeData, error: rangeError } = await supabase
    .from('labor_headcount_forecasts')
    .select(`
      week_starting,
      headcount,
      weekly_hours,
      craft_type_id,
      craft_types!inner(
        id,
        name,
        code,
        category
      )
    `)
    .eq('project_id', projectId)
    .gte('week_starting', '2025-03-11')
    .lte('week_starting', '2026-09-01')
    
  if (rangeError) {
    console.error('Error with range query:', rangeError)
  } else {
    console.log(`Range query found ${rangeData?.length || 0} records`)
    if (rangeData && rangeData.length > 0) {
      console.log('Sample range records:')
      rangeData.slice(0, 5).forEach(record => {
        console.log(`- Week: ${record.week_starting}, Category: ${(record.craft_types as any)?.category}`)
      })
    }
  }
  
  // Check the craft_types join
  console.log('\n3. Checking craft types...')
  const { data: craftData, error: craftError } = await supabase
    .from('craft_types')
    .select('id, name, category')
    .in('category', ['direct', 'indirect', 'staff'])
    .limit(10)
    
  if (craftError) {
    console.error('Error fetching craft types:', craftError)
  } else {
    console.log(`Found ${craftData?.length || 0} craft types`)
    craftData?.forEach(craft => {
      console.log(`- ${craft.name} (${craft.category}): ${craft.id}`)
    })
  }
  
  process.exit(0)
}

debugHeadcountQuery().catch(console.error)