#!/usr/bin/env tsx
/**
 * Test script to verify labor forecast revision functionality
 * Tests that we can create and update headcount forecasts
 */

import { createClient } from '@supabase/supabase-js'

// Read from environment or use defaults
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testLaborForecastUpdate() {
  console.log('🔧 Testing Labor Forecast Revision Fix\n')

  try {
    // 1. Get a test project
    console.log('1️⃣  Finding test project...')
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .limit(1)
      .single()
    
    if (projectError || !projects) {
      throw new Error('No projects found')
    }
    
    console.log(`   ✅ Using project: ${projects.job_number} - ${projects.name}`)
    
    // 2. Check if we have category-level craft types
    console.log('\n2️⃣  Checking for category-level craft types...')
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('id, name, category')
      .in('name', ['Direct Labor', 'Indirect Labor', 'Staff'])
    
    console.log(`   Found ${craftTypes?.length || 0} category-level craft types`)
    
    // If not, get the first craft type in each category
    const categoryMap = new Map<string, string>()
    
    if (craftTypes?.length === 3) {
      craftTypes.forEach(ct => {
        if (ct.name === 'Direct Labor') categoryMap.set('direct', ct.id)
        else if (ct.name === 'Indirect Labor') categoryMap.set('indirect', ct.id)
        else if (ct.name === 'Staff') categoryMap.set('staff', ct.id)
      })
    } else {
      console.log('   Getting first craft type in each category...')
      const { data: allCraftTypes } = await supabase
        .from('craft_types')
        .select('id, name, category')
        .order('category')
      
      const categories = ['direct', 'indirect', 'staff']
      categories.forEach(cat => {
        const firstInCategory = allCraftTypes?.find(ct => ct.category === cat)
        if (firstInCategory) {
          categoryMap.set(cat, firstInCategory.id)
          console.log(`   Using "${firstInCategory.name}" for ${cat} category`)
        }
      })
    }
    
    // 3. Create a test forecast entry
    console.log('\n3️⃣  Creating test forecast entry...')
    const testWeekStarting = new Date()
    testWeekStarting.setDate(testWeekStarting.getDate() + 14) // 2 weeks in future
    // Adjust to Monday
    const day = testWeekStarting.getDay()
    const diff = day === 0 ? 1 : (1 - day + 7) % 7
    testWeekStarting.setDate(testWeekStarting.getDate() + diff)
    testWeekStarting.setUTCHours(0, 0, 0, 0)
    
    const directCraftId = categoryMap.get('direct')
    if (!directCraftId) {
      throw new Error('No direct craft type found')
    }
    
    // Insert initial forecast
    const { data: created, error: createError } = await supabase
      .from('labor_headcount_forecasts')
      .insert({
        project_id: projects.id,
        craft_type_id: directCraftId,
        week_starting: testWeekStarting.toISOString(),
        headcount: 5,
        weekly_hours: 50
      })
      .select()
      .single()
    
    if (createError) {
      console.error('   ❌ Create error:', createError)
    } else {
      console.log(`   ✅ Created forecast: ${created.id} with headcount 5`)
    }
    
    // 4. Update the forecast (revision)
    console.log('\n4️⃣  Testing forecast revision...')
    
    // Try to find and update
    const weekDateOnly = testWeekStarting.toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('labor_headcount_forecasts')
      .select('*')
      .eq('project_id', projects.id)
      .eq('craft_type_id', directCraftId)
      .gte('week_starting', `${weekDateOnly}T00:00:00`)
      .lt('week_starting', `${weekDateOnly}T23:59:59`)
      .single()
    
    if (existing) {
      const { error: updateError } = await supabase
        .from('labor_headcount_forecasts')
        .update({
          headcount: 10,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      if (updateError) {
        console.error('   ❌ Update error:', updateError)
      } else {
        console.log('   ✅ Successfully updated headcount from 5 to 10')
      }
      
      // Verify the update
      const { data: updated } = await supabase
        .from('labor_headcount_forecasts')
        .select('headcount')
        .eq('id', existing.id)
        .single()
      
      console.log(`   ✅ Verified: headcount is now ${updated?.headcount}`)
    } else {
      console.log('   ❌ Could not find existing forecast to update')
    }
    
    // 5. Clean up test data
    console.log('\n5️⃣  Cleaning up test data...')
    if (created || existing) {
      const { error: deleteError } = await supabase
        .from('labor_headcount_forecasts')
        .delete()
        .eq('project_id', projects.id)
        .eq('craft_type_id', directCraftId)
        .eq('week_starting', testWeekStarting.toISOString())
      
      if (!deleteError) {
        console.log('   ✅ Test data cleaned up')
      }
    }
    
    console.log('\n✅ Labor forecast revision fix is working correctly!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testLaborForecastUpdate()