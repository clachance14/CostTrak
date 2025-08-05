#!/usr/bin/env tsx

/**
 * Test script to verify burdened rate calculations for forecast costs
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testBurdenedRates() {
  console.log('\n=== Testing Burdened Rate Calculations ===\n')

  try {
    // Get a sample project
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .limit(1)
    
    if (!projects || projects.length === 0) {
      console.log('No projects found')
      return
    }

    const project = projects[0]
    console.log(`Testing with project: ${project.name} (${project.job_number})\n`)

    // Get recent employee actuals with burden
    const { data: employeeActuals } = await supabase
      .from('labor_employee_actuals')
      .select(`
        week_ending,
        employee_id,
        total_hours,
        st_wages,
        ot_wages,
        total_cost,
        burden_rate,
        total_cost_with_burden,
        employees!inner (
          craft_type_id,
          category
        )
      `)
      .eq('project_id', project.id)
      .order('week_ending', { ascending: false })
      .limit(100)

    console.log(`Found ${employeeActuals?.length || 0} employee actual records`)

    if (employeeActuals && employeeActuals.length > 0) {
      // Calculate category totals
      const categoryTotals: Record<string, { hours: number; cost: number; costWithBurden: number }> = {
        direct: { hours: 0, cost: 0, costWithBurden: 0 },
        indirect: { hours: 0, cost: 0, costWithBurden: 0 },
        staff: { hours: 0, cost: 0, costWithBurden: 0 }
      }

      employeeActuals.forEach(record => {
        const category = record.employees?.category || 'direct'
        categoryTotals[category].hours += record.total_hours || 0
        categoryTotals[category].cost += record.total_cost || 0
        categoryTotals[category].costWithBurden += record.total_cost_with_burden || 0
      })

      console.log('\nCategory Analysis:')
      console.log('================')
      
      Object.entries(categoryTotals).forEach(([category, totals]) => {
        if (totals.hours > 0) {
          const baseRate = totals.cost / totals.hours
          const burdenedRate = totals.costWithBurden / totals.hours
          const effectiveBurdenRate = (totals.costWithBurden - totals.cost) / totals.cost
          
          console.log(`\n${category.toUpperCase()}:`)
          console.log(`  Total Hours: ${totals.hours.toFixed(0)}`)
          console.log(`  Total Cost (Base): $${totals.cost.toFixed(0)}`)
          console.log(`  Total Cost (Burdened): $${totals.costWithBurden.toFixed(0)}`)
          console.log(`  Base Rate: $${baseRate.toFixed(2)}/hr`)
          console.log(`  Burdened Rate: $${burdenedRate.toFixed(2)}/hr`)
          console.log(`  Effective Burden %: ${(effectiveBurdenRate * 100).toFixed(1)}%`)
        }
      })

      // Show sample records
      console.log('\n\nSample Records (first 5):')
      console.log('========================')
      employeeActuals.slice(0, 5).forEach(record => {
        const baseRate = record.total_hours > 0 ? record.total_cost / record.total_hours : 0
        const burdenedRate = record.total_hours > 0 ? record.total_cost_with_burden / record.total_hours : 0
        
        console.log(`\nWeek: ${record.week_ending}`)
        console.log(`  Category: ${record.employees?.category}`)
        console.log(`  Hours: ${record.total_hours}`)
        console.log(`  Base Cost: $${record.total_cost?.toFixed(2)}`)
        console.log(`  Burdened Cost: $${record.total_cost_with_burden?.toFixed(2)}`)
        console.log(`  Base Rate: $${baseRate.toFixed(2)}/hr`)
        console.log(`  Burdened Rate: $${burdenedRate.toFixed(2)}/hr`)
        console.log(`  Burden Rate: ${((record.burden_rate || 0) * 100).toFixed(0)}%`)
      })
    }

    console.log('\n\n=== Summary ===')
    console.log('The forecast costs should now use these burdened rates:')
    console.log('- Base wages × 1.28 for straight time')
    console.log('- Overtime wages are not burdened')
    console.log('- Category rates are weighted averages of all crafts in that category')
    console.log('- This matches how actual costs are calculated')

  } catch (error) {
    console.error('Error:', error)
  }
}

testBurdenedRates()