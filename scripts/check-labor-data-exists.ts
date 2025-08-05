#!/usr/bin/env tsx
/**
 * Check if labor data exists in the database
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

async function checkLaborData() {
  console.log('🔍 Checking Labor Data in Database')
  console.log('=' .repeat(60))
  
  // 1. Check total labor_employee_actuals
  const { count: totalActuals } = await supabase
    .from('labor_employee_actuals')
    .select('*', { count: 'exact', head: true })
    
  console.log(`\n📊 Total labor_employee_actuals records: ${totalActuals || 0}`)
  
  // 2. Check labor data by project
  console.log('\n📁 Labor data by project:')
  const { data: projectsWithLabor } = await supabase
    .from('labor_employee_actuals')
    .select('project_id, projects!inner(job_number, name)')
    .select('project_id')
    .select('project_id, count')
    .select('project_id')
    .limit(0) // We'll do a custom query
    
  // Get projects with labor data count
  const { data: laborByProject, error } = await supabase.rpc('get_labor_summary_by_project')
  
  // If RPC doesn't exist, do it manually
  if (error || !laborByProject) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .order('created_at', { ascending: false })
      .limit(10)
      
    for (const project of projects || []) {
      const { count } = await supabase
        .from('labor_employee_actuals')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        
      if (count && count > 0) {
        console.log(`   ✅ ${project.job_number} - ${project.name}: ${count} records`)
        
        // Get date range
        const { data: dateRange } = await supabase
          .from('labor_employee_actuals')
          .select('week_ending')
          .eq('project_id', project.id)
          .order('week_ending', { ascending: true })
          .limit(1)
          
        const { data: latestDate } = await supabase
          .from('labor_employee_actuals')
          .select('week_ending')
          .eq('project_id', project.id)
          .order('week_ending', { ascending: false })
          .limit(1)
          
        if (dateRange?.[0] && latestDate?.[0]) {
          console.log(`      Date range: ${dateRange[0].week_ending} to ${latestDate[0].week_ending}`)
        }
        
        // Check categories
        const { data: categories } = await supabase
          .from('labor_employee_actuals')
          .select('employee_id, employees!inner(category)')
          .eq('project_id', project.id)
          .limit(100)
          
        const categoryCounts = { direct: 0, indirect: 0, staff: 0 }
        categories?.forEach(c => {
          const cat = c.employees?.category || 'direct'
          categoryCounts[cat as keyof typeof categoryCounts]++
        })
        
        console.log(`      Categories: Direct=${categoryCounts.direct}, Indirect=${categoryCounts.indirect}, Staff=${categoryCounts.staff}`)
      }
    }
  }
  
  // 3. Check employees table
  console.log('\n👥 Employees data:')
  const { count: totalEmployees } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    
  console.log(`   Total employees: ${totalEmployees || 0}`)
  
  // Check by category
  const categories = ['direct', 'indirect', 'staff']
  for (const cat of categories) {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('category', cat)
      
    console.log(`   ${cat}: ${count || 0} employees`)
  }
  
  // 4. Check craft_types
  console.log('\n🔨 Craft types:')
  const { data: craftTypes } = await supabase
    .from('craft_types')
    .select('id, name, category')
    .order('category')
    
  const craftByCategory = { direct: 0, indirect: 0, staff: 0 }
  craftTypes?.forEach(ct => {
    if (ct.category in craftByCategory) {
      craftByCategory[ct.category as keyof typeof craftByCategory]++
    }
  })
  
  console.log(`   Total craft types: ${craftTypes?.length || 0}`)
  console.log(`   By category: Direct=${craftByCategory.direct}, Indirect=${craftByCategory.indirect}, Staff=${craftByCategory.staff}`)
  
  // 5. Sample data check
  console.log('\n📌 Sample labor data (first 5 records):')
  const { data: sampleData } = await supabase
    .from('labor_employee_actuals')
    .select(`
      *,
      employees!inner(
        id,
        name,
        category,
        craft_type_id
      ),
      projects!inner(
        job_number,
        name
      )
    `)
    .limit(5)
    .order('week_ending', { ascending: false })
    
  sampleData?.forEach((record, i) => {
    console.log(`\n   Record ${i + 1}:`)
    console.log(`   - Project: ${record.projects.job_number} - ${record.projects.name}`)
    console.log(`   - Employee: ${record.employees.name} (${record.employees.category})`)
    console.log(`   - Week ending: ${record.week_ending}`)
    console.log(`   - Hours: ST=${record.st_hours}, OT=${record.ot_hours}`)
    console.log(`   - Wages: ST=$${record.st_wages}, OT=$${record.ot_wages}`)
  })
  
  // 6. Check for recent imports
  console.log('\n📥 Recent labor imports:')
  const { data: recentImports } = await supabase
    .from('data_imports')
    .select('*')
    .eq('import_type', 'labor')
    .order('created_at', { ascending: false })
    .limit(5)
    
  recentImports?.forEach(imp => {
    console.log(`   - ${imp.created_at}: ${imp.status} (${imp.records_imported || 0} records)`)
  })
}

async function main() {
  await checkLaborData()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)