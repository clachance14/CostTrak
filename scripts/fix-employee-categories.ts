#!/usr/bin/env tsx
/**
 * Fix employee categories based on their craft type categories
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function analyzeCurrentState() {
  console.log('🔍 Analyzing current employee category state...')
  
  // Check employees with and without categories
  const { count: totalEmployees } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    
  const { count: employeesWithCategory } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .in('category', ['direct', 'indirect', 'staff'])
    
  const { count: employeesWithoutCategory } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .or('category.is.null,category.not.in.(direct,indirect,staff)')
    
  console.log(`\n📊 Employee Category Status:`)
  console.log(`   Total employees: ${totalEmployees || 0}`)
  console.log(`   With valid category: ${employeesWithCategory || 0}`)
  console.log(`   Without valid category: ${employeesWithoutCategory || 0}`)
  
  // Check craft types
  console.log(`\n🔨 Craft Type Categories:`)
  const { data: craftCategories } = await supabase
    .from('craft_types')
    .select('category')
    .select('category, count')
    
  const categoryCounts = { direct: 0, indirect: 0, staff: 0, null: 0 }
  const { data: craftTypes } = await supabase
    .from('craft_types')
    .select('id, name, category')
    
  craftTypes?.forEach(ct => {
    if (ct.category in categoryCounts) {
      categoryCounts[ct.category as keyof typeof categoryCounts]++
    } else {
      categoryCounts.null++
    }
  })
  
  console.log(`   Direct: ${categoryCounts.direct}`)
  console.log(`   Indirect: ${categoryCounts.indirect}`)
  console.log(`   Staff: ${categoryCounts.staff}`)
  console.log(`   No category: ${categoryCounts.null}`)
  
  return { employeesWithoutCategory, craftTypes }
}

async function fixEmployeeCategories(dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY RUN - ' : ''}Fixing employee categories...`)
  
  // Get all employees with their craft types
  const { data: employees, error } = await supabase
    .from('employees')
    .select(`
      id,
      first_name,
      last_name,
      category,
      craft_type_id,
      craft_types!inner(
        id,
        name,
        category
      )
    `)
    .or('category.is.null,category.not.in.(Direct,Indirect,Staff)')
    
  if (error) {
    console.error('❌ Error fetching employees:', error)
    return
  }
  
  console.log(`\n📝 Found ${employees?.length || 0} employees to update`)
  
  // Group updates by category
  const updates = {
    direct: [] as string[],
    indirect: [] as string[],
    staff: [] as string[],
    unknown: [] as string[]
  }
  
  employees?.forEach(emp => {
    const craftCategory = emp.craft_types?.category
    const empName = `${emp.first_name} ${emp.last_name}`
    if (craftCategory && craftCategory in updates) {
      updates[craftCategory as keyof typeof updates].push(emp.id)
      console.log(`   ${empName}: ${emp.category || 'null'} → ${craftCategory}`)
    } else {
      updates.unknown.push(emp.id)
      console.log(`   ${empName}: Unknown craft type category`)
    }
  })
  
  // Apply updates
  if (!dryRun) {
    console.log('\n📤 Applying updates...')
    
    for (const [category, ids] of Object.entries(updates)) {
      if (category !== 'unknown' && ids.length > 0) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ category })
          .in('id', ids)
          
        if (updateError) {
          console.error(`❌ Error updating ${category} employees:`, updateError)
        } else {
          console.log(`✅ Updated ${ids.length} employees to ${category}`)
        }
      }
    }
    
    if (updates.unknown.length > 0) {
      console.log(`⚠️  ${updates.unknown.length} employees have unknown craft type categories`)
    }
  } else {
    console.log('\n📊 Update Summary (DRY RUN):')
    console.log(`   Direct: ${updates.direct.length} employees`)
    console.log(`   Indirect: ${updates.indirect.length} employees`) 
    console.log(`   Staff: ${updates.staff.length} employees`)
    console.log(`   Unknown: ${updates.unknown.length} employees`)
  }
  
  return updates
}

async function verifyFix() {
  console.log('\n✅ Verifying fix...')
  
  const { count: employeesWithCategory } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .in('category', ['direct', 'indirect', 'staff'])
    
  const categories = ['direct', 'indirect', 'staff']
  for (const cat of categories) {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('category', cat)
      
    console.log(`   ${cat}: ${count || 0} employees`)
  }
  
  // Test the composite rate function again
  console.log('\n🧪 Testing composite rate function...')
  const { data: projects } = await supabase
    .from('projects')
    .select('id, job_number, name')
    .limit(1)
    .single()
    
  if (projects) {
    const { data, error } = await supabase.rpc('get_composite_labor_rate', {
      p_project_id: projects.id,
      p_weeks_back: 16,
      p_categories: ['direct', 'indirect', 'staff']
    })
    
    if (error) {
      console.error('❌ Function error:', error)
    } else {
      console.log('✅ Composite rate function result:')
      console.log(`   Overall rate: $${data?.overall_rate || 0}/hr`)
      console.log(`   Total hours: ${data?.total_hours || 0}`)
      console.log(`   Total cost: $${data?.total_cost || 0}`)
    }
  }
}

async function main() {
  console.log('🔧 Employee Category Fix Tool')
  console.log('=' .repeat(60))
  
  // Analyze current state
  const { employeesWithoutCategory } = await analyzeCurrentState()
  
  if (!employeesWithoutCategory || employeesWithoutCategory === 0) {
    console.log('\n✅ All employees already have valid categories!')
    return
  }
  
  // Do a dry run first
  await fixEmployeeCategories(true)
  
  // Ask for confirmation
  console.log('\n' + '='.repeat(60))
  console.log('📌 To apply these changes, run:')
  console.log('   npx tsx scripts/fix-employee-categories.ts --apply')
  
  // Check if --apply flag is present
  if (process.argv.includes('--apply')) {
    console.log('\n🚀 Applying changes...')
    await fixEmployeeCategories(false)
    await verifyFix()
  }
  
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)