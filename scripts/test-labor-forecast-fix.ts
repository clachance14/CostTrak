/**
 * Test script to verify the labor forecast duplicate fix
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function testForecastSave() {
  console.log('🧪 Testing Labor Forecast Duplicate Fix\n')
  
  // Use a test project ID
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
  
  // Get category craft types
  const { data: craftTypes } = await supabase
    .from('craft_types')
    .select('id, name, category')
    .in('name', ['Direct Labor', 'Indirect Labor', 'Staff'])
  
  if (!craftTypes || craftTypes.length === 0) {
    console.error('❌ No category craft types found')
    return
  }
  
  const directCraftId = craftTypes.find(ct => ct.category === 'direct')?.id
  const indirectCraftId = craftTypes.find(ct => ct.category === 'indirect')?.id
  const staffCraftId = craftTypes.find(ct => ct.category === 'staff')?.id
  
  console.log('📋 Using craft types:')
  console.log(`  Direct: ${directCraftId}`)
  console.log(`  Indirect: ${indirectCraftId}`)
  console.log(`  Staff: ${staffCraftId}\n`)
  
  // Test week - use a Saturday to test normalization
  const testDate = new Date('2025-08-09') // Saturday
  const expectedSunday = new Date('2025-08-10') // Should normalize to Sunday
  expectedSunday.setUTCHours(0, 0, 0, 0)
  
  console.log(`📅 Test date: ${testDate.toISOString().split('T')[0]} (${testDate.toLocaleDateString('en-US', { weekday: 'long' })})`)
  console.log(`📅 Expected normalized: ${expectedSunday.toISOString().split('T')[0]} (Sunday)\n`)
  
  // Step 1: Clear any existing test data for this week
  console.log('🧹 Clearing existing test data...')
  const { error: clearError } = await supabase
    .from('labor_headcount_forecasts')
    .delete()
    .eq('project_id', projectId)
    .eq('week_ending', expectedSunday.toISOString())
  
  if (clearError && clearError.code !== 'PGRST116') {
    console.error('Error clearing test data:', clearError)
  }
  
  // Step 2: Initial save - simulate saving forecast
  console.log('💾 Saving initial forecast...')
  const initialData = [
    { project_id: projectId, craft_type_id: directCraftId, week_ending: testDate.toISOString(), headcount: 10, avg_weekly_hours: 50 },
    { project_id: projectId, craft_type_id: indirectCraftId, week_ending: testDate.toISOString(), headcount: 5, avg_weekly_hours: 50 },
    { project_id: projectId, craft_type_id: staffCraftId, week_ending: testDate.toISOString(), headcount: 2, avg_weekly_hours: 50 }
  ]
  
  for (const entry of initialData) {
    if (!entry.craft_type_id) continue
    
    // Normalize date like the API does
    const weekDate = new Date(entry.week_ending)
    const dayOfWeek = weekDate.getDay()
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const sundayDate = new Date(weekDate)
    sundayDate.setDate(weekDate.getDate() + daysToSunday)
    sundayDate.setUTCHours(0, 0, 0, 0)
    
    const { error: insertError } = await supabase
      .from('labor_headcount_forecasts')
      .insert({
        ...entry,
        week_ending: sundayDate.toISOString()
      })
    
    if (insertError) {
      console.error(`❌ Error inserting:`, insertError.message)
    }
  }
  
  // Step 3: Check initial count
  const { data: afterInitial } = await supabase
    .from('labor_headcount_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_ending', expectedSunday.toISOString())
  
  console.log(`✅ After initial save: ${afterInitial?.length || 0} entries\n`)
  
  // Step 4: Simulate revision - try to save same week with different values
  console.log('🔄 Revising forecast (updating headcount)...')
  const revisedData = [
    { project_id: projectId, craft_type_id: directCraftId, week_ending: testDate.toISOString(), headcount: 15, avg_weekly_hours: 50 },
    { project_id: projectId, craft_type_id: indirectCraftId, week_ending: testDate.toISOString(), headcount: 8, avg_weekly_hours: 50 },
    { project_id: projectId, craft_type_id: staffCraftId, week_ending: testDate.toISOString(), headcount: 3, avg_weekly_hours: 50 }
  ]
  
  for (const entry of revisedData) {
    if (!entry.craft_type_id) continue
    
    // Normalize date like the API does
    const weekDate = new Date(entry.week_ending)
    const dayOfWeek = weekDate.getDay()
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const sundayDate = new Date(weekDate)
    sundayDate.setDate(weekDate.getDate() + daysToSunday)
    sundayDate.setUTCHours(0, 0, 0, 0)
    
    // Check if exists
    const { data: existing } = await supabase
      .from('labor_headcount_forecasts')
      .select('*')
      .eq('project_id', entry.project_id)
      .eq('craft_type_id', entry.craft_type_id)
      .eq('week_ending', sundayDate.toISOString())
      .single()
    
    if (existing) {
      // Update
      const { error: updateError } = await supabase
        .from('labor_headcount_forecasts')
        .update({
          headcount: entry.headcount,
          avg_weekly_hours: entry.avg_weekly_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      if (updateError) {
        console.error(`❌ Error updating:`, updateError.message)
      } else {
        console.log(`  ✅ Updated: ${existing.headcount} → ${entry.headcount}`)
      }
    } else {
      // Insert (shouldn't happen if fix works)
      console.log(`  ⚠️  No existing entry found, creating new...`)
      const { error: insertError } = await supabase
        .from('labor_headcount_forecasts')
        .insert({
          ...entry,
          week_ending: sundayDate.toISOString()
        })
      
      if (insertError) {
        console.error(`❌ Error inserting:`, insertError.message)
      }
    }
  }
  
  // Step 5: Final check - should still be 3 entries, not 6
  const { data: afterRevision } = await supabase
    .from('labor_headcount_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_ending', expectedSunday.toISOString())
    .order('craft_type_id')
  
  console.log(`\n📊 Final Results:`)
  console.log(`  Total entries: ${afterRevision?.length || 0}`)
  
  if (afterRevision && afterRevision.length === 3) {
    console.log('  ✅ SUCCESS: No duplicates created!')
    console.log('\n  Final values:')
    afterRevision.forEach(entry => {
      const craftName = entry.craft_type_id === directCraftId ? 'Direct' :
                       entry.craft_type_id === indirectCraftId ? 'Indirect' : 'Staff'
      console.log(`    ${craftName}: ${entry.headcount} headcount`)
    })
  } else {
    console.log(`  ❌ FAILED: Expected 3 entries but found ${afterRevision?.length || 0}`)
    if (afterRevision) {
      console.log('\n  Duplicate entries found:')
      afterRevision.forEach(entry => {
        console.log(`    - ${entry.id}: headcount=${entry.headcount}, week=${entry.week_ending}`)
      })
    }
  }
  
  // Step 6: Test unique constraint
  console.log('\n🔒 Testing unique constraint...')
  const { error: constraintError } = await supabase
    .from('labor_headcount_forecasts')
    .insert({
      project_id: projectId,
      craft_type_id: directCraftId,
      week_ending: expectedSunday.toISOString(),
      headcount: 99,
      avg_weekly_hours: 50
    })
  
  if (constraintError) {
    if (constraintError.message.includes('unique') || constraintError.message.includes('duplicate')) {
      console.log('  ✅ Unique constraint working - duplicate prevented!')
    } else {
      console.log('  ⚠️  Insert failed:', constraintError.message)
    }
  } else {
    console.log('  ❌ Unique constraint NOT working - duplicate was allowed!')
  }
  
  console.log('\n✨ Test complete!')
}

// Run the test
testForecastSave().catch(console.error)