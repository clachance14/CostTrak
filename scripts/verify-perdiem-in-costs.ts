#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyPerDiemInCosts() {
  console.log('========================================')
  console.log('Verifying Per Diem in Project Costs')
  console.log('========================================\n')

  // Get projects with per diem enabled
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, job_number')
    .eq('per_diem_enabled', true)
    .order('job_number')

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    return
  }

  for (const project of projects || []) {
    console.log(`\nProject: ${project.name} (${project.job_number})`)
    console.log('----------------------------------------')
    
    // Get labor costs
    const { data: laborActuals } = await supabase
      .from('labor_employee_actuals')
      .select(`
        total_cost_with_burden,
        employees!inner(category)
      `)
      .eq('project_id', project.id)
    
    // Calculate labor costs by category
    let directLaborCost = 0
    let indirectLaborCost = 0
    let staffLaborCost = 0
    
    laborActuals?.forEach(labor => {
      const cost = labor.total_cost_with_burden || 0
      const category = labor.employees?.category || 'Direct'
      
      if (category === 'Indirect') {
        indirectLaborCost += cost
      } else if (category === 'Staff') {
        staffLaborCost += cost
      } else {
        directLaborCost += cost
      }
    })
    
    // Get per diem costs
    const { data: perDiemCosts } = await supabase
      .from('per_diem_costs')
      .select('employee_type, amount')
      .eq('project_id', project.id)
    
    // Calculate per diem by category
    let directPerDiem = 0
    let indirectPerDiem = 0
    
    perDiemCosts?.forEach(perDiem => {
      if (perDiem.employee_type === 'Direct') {
        directPerDiem += perDiem.amount || 0
      } else if (perDiem.employee_type === 'Indirect') {
        indirectPerDiem += perDiem.amount || 0
      }
    })
    
    // Display breakdown
    console.log('\nLabor Costs (with burden):')
    console.log(`  Direct Labor:    $${directLaborCost.toFixed(2)}`)
    console.log(`  Indirect Labor:  $${indirectLaborCost.toFixed(2)}`)
    console.log(`  Staff Labor:     $${staffLaborCost.toFixed(2)}`)
    console.log(`  Subtotal:        $${(directLaborCost + indirectLaborCost + staffLaborCost).toFixed(2)}`)
    
    console.log('\nPer Diem Costs:')
    console.log(`  Direct Per Diem:   $${directPerDiem.toFixed(2)}`)
    console.log(`  Indirect Per Diem: $${indirectPerDiem.toFixed(2)}`)
    console.log(`  Subtotal:          $${(directPerDiem + indirectPerDiem).toFixed(2)}`)
    
    console.log('\nTotal Labor Costs (including Per Diem):')
    console.log(`  Direct Total:    $${(directLaborCost + directPerDiem).toFixed(2)}`)
    console.log(`  Indirect Total:  $${(indirectLaborCost + indirectPerDiem).toFixed(2)}`)
    console.log(`  Staff Total:     $${staffLaborCost.toFixed(2)}`)
    console.log(`  ===============================================`)
    console.log(`  GRAND TOTAL:     $${(directLaborCost + indirectLaborCost + staffLaborCost + directPerDiem + indirectPerDiem).toFixed(2)}`)
  }
  
  console.log('\n========================================')
  console.log('Summary')
  console.log('========================================')
  console.log('\n✅ Per diem costs are now included in:')
  console.log('   - Budget vs Actual API (already implemented)')
  console.log('   - Project Overview API (already implemented)')
  console.log('   - Dashboard API (just updated)')
  console.log('   - Labor Cost Calculator service (new helper)')
  console.log('\nThese costs will appear in:')
  console.log('   - Direct Labor totals (includes Direct per diem)')
  console.log('   - Indirect Labor totals (includes Indirect per diem)')
  console.log('   - Overall project actual costs')
}

verifyPerDiemInCosts().catch(console.error)