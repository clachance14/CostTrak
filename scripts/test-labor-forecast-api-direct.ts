#!/usr/bin/env tsx
/**
 * Test labor forecast APIs directly
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

async function testDirectDatabaseQueries() {
  console.log('🔍 Testing Direct Database Queries')
  console.log('=' .repeat(60))
  
  // Get a project with labor data
  const { data: project } = await supabase
    .from('projects')
    .select('id, job_number, name')
    .eq('job_number', '5772')
    .single()
    
  if (!project) {
    console.log('❌ Test project not found')
    return
  }
  
  console.log(`\n📁 Testing with project: ${project.job_number} - ${project.name}`)
  
  // 1. Test direct query for labor data
  console.log('\n📊 Direct query for labor data:')
  const { data: laborData, error: laborError } = await supabase
    .from('labor_employee_actuals')
    .select(`
      *,
      employees!inner(
        id,
        first_name,
        last_name,
        category,
        craft_type_id
      )
    `)
    .eq('project_id', project.id)
    .limit(5)
    
  if (laborError) {
    console.error('❌ Labor data query error:', laborError)
  } else {
    console.log(`✅ Found ${laborData?.length || 0} labor records`)
    if (laborData && laborData.length > 0) {
      console.log('\nSample record:')
      const record = laborData[0]
      console.log('- Employee:', `${record.employees.first_name} ${record.employees.last_name}`)
      console.log('- Category:', record.employees.category)
      console.log('- Week ending:', record.week_ending)
      console.log('- Hours:', `ST=${record.st_hours}, OT=${record.ot_hours}`)
      console.log('- Wages:', `ST=$${record.st_wages}, OT=$${record.ot_wages}`)
    }
  }
  
  // 2. Check unique employee categories
  console.log('\n📊 Unique employee categories in labor data:')
  const { data: categories } = await supabase
    .from('labor_employee_actuals')
    .select('employees!inner(category)')
    .eq('project_id', project.id)
    
  const uniqueCategories = new Set(categories?.map(c => c.employees?.category))
  console.log('Categories found:', Array.from(uniqueCategories))
  
  // 3. Test manual composite rate calculation
  console.log('\n📊 Manual composite rate calculation:')
  const weeksBack = 16
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - weeksBack * 7)
  
  const { data: manualCalc } = await supabase
    .from('labor_employee_actuals')
    .select(`
      st_hours,
      ot_hours,
      st_wages,
      ot_wages,
      employees!inner(category)
    `)
    .eq('project_id', project.id)
    .gte('week_ending', startDate.toISOString())
    
  if (manualCalc) {
    const totals = {
      Direct: { hours: 0, wages: 0, burden: 0 },
      Indirect: { hours: 0, wages: 0, burden: 0 },
      Staff: { hours: 0, wages: 0, burden: 0 }
    }
    
    manualCalc.forEach(record => {
      const category = record.employees?.category
      if (category && category in totals) {
        const hours = (record.st_hours || 0) + (record.ot_hours || 0)
        const wages = (record.st_wages || 0) + (record.ot_wages || 0)
        const burden = (record.st_wages || 0) * 0.28
        
        totals[category as keyof typeof totals].hours += hours
        totals[category as keyof typeof totals].wages += wages
        totals[category as keyof typeof totals].burden += burden
      }
    })
    
    console.log('\nCategory totals:')
    let totalHours = 0
    let totalCost = 0
    
    Object.entries(totals).forEach(([category, data]) => {
      const cost = data.wages + data.burden
      const rate = data.hours > 0 ? cost / data.hours : 0
      totalHours += data.hours
      totalCost += cost
      
      console.log(`- ${category}:`)
      console.log(`  Hours: ${data.hours.toFixed(0)}`)
      console.log(`  Wages: $${data.wages.toFixed(2)}`)
      console.log(`  Burden: $${data.burden.toFixed(2)}`)
      console.log(`  Total Cost: $${cost.toFixed(2)}`)
      console.log(`  Rate: $${rate.toFixed(2)}/hr`)
    })
    
    const overallRate = totalHours > 0 ? totalCost / totalHours : 0
    console.log('\nOverall composite:')
    console.log(`- Total Hours: ${totalHours.toFixed(0)}`)
    console.log(`- Total Cost: $${totalCost.toFixed(2)}`)
    console.log(`- Composite Rate: $${overallRate.toFixed(2)}/hr`)
  }
  
  // 4. Test the database function directly
  console.log('\n📊 Testing database function get_composite_labor_rate:')
  const { data: funcResult, error: funcError } = await supabase.rpc('get_composite_labor_rate', {
    p_project_id: project.id,
    p_weeks_back: weeksBack,
    p_categories: ['direct', 'indirect', 'staff']
  })
  
  if (funcError) {
    console.error('❌ Function error:', funcError)
  } else if (funcResult) {
    console.log('✅ Function result:')
    console.log(`- Overall rate: $${funcResult.overall_rate || 0}/hr`)
    console.log(`- Total hours: ${funcResult.total_hours || 0}`)
    console.log(`- Total cost: $${funcResult.total_cost || 0}`)
    console.log(`- Category breakdown:`, funcResult.category_breakdown)
  }
}

async function main() {
  await testDirectDatabaseQueries()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)