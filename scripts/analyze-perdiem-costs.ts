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

async function analyzePerDiemCosts() {
  console.log('========================================')
  console.log('Per Diem Cost Analysis')
  console.log('========================================\n')

  // 1. Check which projects have per diem enabled
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, job_number, per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect')
    .eq('per_diem_enabled', true)
    .order('job_number')

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    return
  }

  console.log(`Found ${projects?.length || 0} projects with per diem enabled:\n`)

  for (const project of projects || []) {
    console.log(`Project: ${project.name} (${project.job_number})`)
    console.log(`  Direct Rate: $${project.per_diem_rate_direct}/day`)
    console.log(`  Indirect Rate: $${project.per_diem_rate_indirect}/day`)
    
    // 2. Check if per diem costs have been calculated
    const { data: perDiemCosts, error: perDiemError } = await supabase
      .from('per_diem_costs')
      .select('amount')
      .eq('project_id', project.id)

    if (!perDiemError) {
      const totalPerDiem = perDiemCosts?.reduce((sum, cost) => sum + (cost.amount || 0), 0) || 0
      const recordCount = perDiemCosts?.length || 0
      
      console.log(`  Per Diem Records: ${recordCount}`)
      console.log(`  Total Per Diem Costs: $${totalPerDiem.toFixed(2)}`)
      
      if (recordCount === 0) {
        // Check if there are labor actuals that should trigger per diem
        const { data: laborActuals, error: laborError } = await supabase
          .from('labor_employee_actuals')
          .select('id')
          .eq('project_id', project.id)
          .gt('actual_hours', 0)
          .limit(1)

        if (!laborError && laborActuals && laborActuals.length > 0) {
          console.log(`  ⚠️  WARNING: Project has labor actuals but no per diem costs calculated!`)
          console.log(`  ⚠️  Need to backfill per diem for this project`)
        }
      }
    }

    // 3. Check if per diem is included in labor costs
    const { data: laborActuals, error: laborError } = await supabase
      .from('labor_employee_actuals')
      .select('total_cost_with_burden, total_burden_amount')
      .eq('project_id', project.id)

    if (!laborError && laborActuals) {
      const totalLaborCost = laborActuals.reduce((sum, labor) => 
        sum + (labor.total_cost_with_burden || 0), 0)
      console.log(`  Total Labor Cost (with burden): $${totalLaborCost.toFixed(2)}`)
      console.log(`  Note: Per diem should be ADDED to this amount\n`)
    }
  }

  // 4. Summary of all per diem costs across all projects
  console.log('\n========================================')
  console.log('Overall Per Diem Summary')
  console.log('========================================\n')

  const { data: summary, error: summaryError } = await supabase
    .from('per_diem_summary')
    .select('*')

  if (!summaryError && summary) {
    const totalAllProjects = summary.reduce((sum, proj) => 
      sum + (proj.total_per_diem_amount || 0), 0)
    
    console.log(`Total Per Diem Across All Projects: $${totalAllProjects.toFixed(2)}`)
    console.log(`\nPer Project Breakdown:`)
    
    for (const proj of summary) {
      console.log(`  ${proj.project_name} (${proj.project_number}):`)
      console.log(`    Direct: $${proj.total_direct_per_diem?.toFixed(2) || '0.00'}`)
      console.log(`    Indirect: $${proj.total_indirect_per_diem?.toFixed(2) || '0.00'}`)
      console.log(`    Total: $${proj.total_per_diem_amount?.toFixed(2) || '0.00'}`)
    }
  }

  // 5. Check if budget vs actual includes per diem
  console.log('\n========================================')
  console.log('Budget vs Actual Check')
  console.log('========================================\n')

  console.log('Current Issue: Per diem costs are NOT being added to labor actuals')
  console.log('in the budget vs actual calculations. The API needs to be updated to:')
  console.log('1. Query per_diem_costs table for each project')
  console.log('2. Add per diem amounts to the appropriate labor category actuals')
  console.log('3. Include per diem in forecasted final calculations')
}

analyzePerDiemCosts().catch(console.error)