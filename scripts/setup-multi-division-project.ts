#!/usr/bin/env tsx

/**
 * Setup Multi-Division Project
 * 
 * This script sets up project 5800 (SDO Tank Replacement) with multiple divisions
 * based on its budget breakdown disciplines
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') })

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupMultiDivisionProject() {
  console.log('🔧 Setting up Multi-Division Structure for Project 5800\n')

  try {
    // 1. Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('job_number', '5800')
      .single()

    if (projectError || !project) {
      console.error('Error fetching project:', projectError)
      return
    }

    console.log(`📋 Project: ${project.job_number} - ${project.name}`)
    console.log(`   Contract Value: $${project.revised_contract.toLocaleString()}\n`)

    // 2. Get divisions
    const { data: divisions, error: divError } = await supabase
      .from('divisions')
      .select('*')

    if (divError || !divisions) {
      console.error('Error fetching divisions:', divError)
      return
    }

    const divMap = new Map(divisions.map(d => [d.code, d]))
    const mechDiv = divMap.get('MEC')
    const ieDiv = divMap.get('I&E')
    const civDiv = divMap.get('CIV')

    // 3. Get budget breakdowns to determine division allocations
    const { data: breakdowns, error: breakdownError } = await supabase
      .from('project_budget_breakdowns')
      .select('discipline, cost_type, value')
      .eq('project_id', project.id)

    if (breakdownError) {
      console.error('Error fetching breakdowns:', breakdownError)
      return
    }

    // Group by division based on discipline
    const divisionBudgets = {
      mechanical: 0,
      ie: 0,
      civil: 0
    }

    breakdowns?.forEach(b => {
      if (b.discipline && b.value) {
        const disc = b.discipline.toUpperCase()
        if (disc.includes('ELECTRICAL') || disc.includes('INSTRUMENTATION')) {
          divisionBudgets.ie += b.value
        } else if (disc.includes('CIVIL') || disc.includes('GROUT')) {
          divisionBudgets.civil += b.value
        } else {
          divisionBudgets.mechanical += b.value
        }
      }
    })

    console.log('📊 Division Budget Allocations:')
    console.log(`   Mechanical: $${divisionBudgets.mechanical.toLocaleString()}`)
    console.log(`   I&E: $${divisionBudgets.ie.toLocaleString()}`)
    console.log(`   Civil: $${divisionBudgets.civil.toLocaleString()}\n`)

    // 4. Remove existing divisions (to start fresh)
    console.log('🗑️  Clearing existing division assignments...')
    await supabase
      .from('project_divisions')
      .delete()
      .eq('project_id', project.id)

    // 5. Create project_divisions entries
    console.log('✨ Creating division assignments:')

    // Mechanical Division (Lead)
    if (mechDiv && divisionBudgets.mechanical > 0) {
      const { error } = await supabase
        .from('project_divisions')
        .insert({
          project_id: project.id,
          division_id: mechDiv.id,
          division_pm_id: project.project_manager_id, // Use main PM for lead division
          is_lead_division: true,
          budget_allocated: divisionBudgets.mechanical,
          created_by: project.created_by
        })

      if (error) {
        console.error('   ❌ Error creating Mechanical division:', error)
      } else {
        console.log('   ✅ Mechanical Division (Lead)')
      }

      // Create division budget
      await supabase
        .from('division_budgets')
        .upsert({
          project_id: project.id,
          division_id: mechDiv.id,
          labor_budget: divisionBudgets.mechanical * 0.4,
          materials_budget: divisionBudgets.mechanical * 0.3,
          equipment_budget: divisionBudgets.mechanical * 0.15,
          subcontracts_budget: divisionBudgets.mechanical * 0.1,
          other_budget: divisionBudgets.mechanical * 0.05
        })
    }

    // I&E Division
    if (ieDiv && divisionBudgets.ie > 0) {
      const { error } = await supabase
        .from('project_divisions')
        .insert({
          project_id: project.id,
          division_id: ieDiv.id,
          division_pm_id: null, // Can be assigned later
          is_lead_division: false,
          budget_allocated: divisionBudgets.ie,
          created_by: project.created_by
        })

      if (error) {
        console.error('   ❌ Error creating I&E division:', error)
      } else {
        console.log('   ✅ I&E Division')
      }

      // Create division budget
      await supabase
        .from('division_budgets')
        .upsert({
          project_id: project.id,
          division_id: ieDiv.id,
          labor_budget: divisionBudgets.ie * 0.5,      // I&E is more labor intensive
          materials_budget: divisionBudgets.ie * 0.25,
          equipment_budget: divisionBudgets.ie * 0.1,
          subcontracts_budget: divisionBudgets.ie * 0.1,
          other_budget: divisionBudgets.ie * 0.05
        })
    }

    // Civil Division
    if (civDiv && divisionBudgets.civil > 0) {
      const { error } = await supabase
        .from('project_divisions')
        .insert({
          project_id: project.id,
          division_id: civDiv.id,
          division_pm_id: null, // Can be assigned later
          is_lead_division: false,
          budget_allocated: divisionBudgets.civil,
          created_by: project.created_by
        })

      if (error) {
        console.error('   ❌ Error creating Civil division:', error)
      } else {
        console.log('   ✅ Civil Division')
      }

      // Create division budget
      await supabase
        .from('division_budgets')
        .upsert({
          project_id: project.id,
          division_id: civDiv.id,
          labor_budget: divisionBudgets.civil * 0.3,
          materials_budget: divisionBudgets.civil * 0.4,   // Civil uses more materials
          equipment_budget: divisionBudgets.civil * 0.2,
          subcontracts_budget: divisionBudgets.civil * 0.05,
          other_budget: divisionBudgets.civil * 0.05
        })
    }

    // 6. Verify the setup
    const { data: projectDivisions } = await supabase
      .from('project_divisions')
      .select(`
        *,
        division:divisions!project_divisions_division_id_fkey(name, code)
      `)
      .eq('project_id', project.id)

    console.log(`\n✅ Project now has ${projectDivisions?.length || 0} divisions:`)
    projectDivisions?.forEach(pd => {
      console.log(`   • ${pd.division.name} (${pd.division.code}) - $${pd.budget_allocated.toLocaleString()} ${pd.is_lead_division ? '(Lead)' : ''}`)
    })

    // 7. Assign existing POs and labor to appropriate divisions
    console.log('\n🔄 Updating existing data with division assignments...')

    // Update POs based on discipline/cost codes
    // This would need more complex logic based on your cost code structure
    console.log('   ⚠️  POs and labor need manual division assignment or cost code mapping')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the script
setupMultiDivisionProject()
  .then(() => {
    console.log('\n✅ Multi-division setup complete!')
    console.log('\n📋 Next steps:')
    console.log('   1. Visit the project to see the division filter in Budget vs Actual')
    console.log('   2. Assign division PMs as needed')
    console.log('   3. Update POs and labor records with appropriate divisions')
  })
  .catch(console.error)