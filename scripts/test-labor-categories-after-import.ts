#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function testLaborCategoriesAfterImport() {
  const supabase = createAdminClient()
  
  try {
    console.log('Testing labor categories after import...\n')
    
    // Get the SDO project
    const { data: project } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('job_number', '5800')
      .single()
    
    if (!project) {
      console.error('SDO project not found')
      return
    }
    
    console.log(`Project: ${project.name} (${project.job_number})\n`)
    
    // Get all labor actuals for this project with craft type details
    const { data: laborActuals, error } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        actual_hours,
        actual_cost,
        actual_cost_with_burden,
        craft_types (
          code,
          name,
          category
        )
      `)
      .eq('project_id', project.id)
      .order('week_ending', { ascending: false })
    
    if (error) {
      console.error('Error fetching labor actuals:', error)
      return
    }
    
    // Group by category
    const categoryBreakdown: Record<string, {
      hours: number
      cost: number
      costWithBurden: number
      weeks: Set<string>
    }> = {
      direct: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() },
      indirect: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() },
      staff: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() }
    }
    
    console.log('Labor Actuals by Week and Category:\n')
    
    // Group by week first
    const weeklyData: Record<string, typeof categoryBreakdown> = {}
    
    laborActuals?.forEach(actual => {
      const craftType = actual.craft_types as any
      const category = craftType?.category || 'unknown'
      const week = actual.week_ending
      
      if (!weeklyData[week]) {
        weeklyData[week] = {
          direct: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() },
          indirect: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() },
          staff: { hours: 0, cost: 0, costWithBurden: 0, weeks: new Set() }
        }
      }
      
      if (weeklyData[week][category]) {
        weeklyData[week][category].hours += actual.actual_hours
        weeklyData[week][category].cost += actual.actual_cost
        weeklyData[week][category].costWithBurden += actual.actual_cost_with_burden
      }
      
      if (categoryBreakdown[category]) {
        categoryBreakdown[category].hours += actual.actual_hours
        categoryBreakdown[category].cost += actual.actual_cost
        categoryBreakdown[category].costWithBurden += actual.actual_cost_with_burden
        categoryBreakdown[category].weeks.add(week)
      }
    })
    
    // Display weekly breakdown
    Object.entries(weeklyData).sort().reverse().forEach(([week, categories]) => {
      console.log(`Week ${week}:`)
      Object.entries(categories).forEach(([category, data]) => {
        if (data.hours > 0) {
          console.log(`  ${category.padEnd(10)}: ${data.hours.toString().padStart(4)} hrs, $${data.cost.toFixed(2).padStart(10)} (with burden: $${data.costWithBurden.toFixed(2).padStart(10)})`)
        }
      })
      console.log()
    })
    
    // Display overall totals
    console.log('\nOverall Category Totals:')
    Object.entries(categoryBreakdown).forEach(([category, data]) => {
      if (data.hours > 0) {
        const avgRate = data.cost / data.hours
        console.log(`\n${category.toUpperCase()}:`)
        console.log(`  Total Hours: ${data.hours}`)
        console.log(`  Total Cost: $${data.cost.toFixed(2)}`)
        console.log(`  Total Cost with Burden: $${data.costWithBurden.toFixed(2)}`)
        console.log(`  Average Rate: $${avgRate.toFixed(2)}/hr`)
        console.log(`  Weeks with Data: ${data.weeks.size}`)
      }
    })
    
    // Check for any labor actuals without proper categories
    const { data: unknownCategory } = await supabase
      .from('labor_actuals')
      .select(`
        craft_type_id,
        craft_types (
          code,
          name,
          category
        )
      `)
      .eq('project_id', project.id)
      .is('craft_types.category', null)
    
    if (unknownCategory && unknownCategory.length > 0) {
      console.log('\n⚠️  WARNING: Found labor actuals with unknown categories:')
      unknownCategory.forEach(item => {
        console.log(`  Craft Type ID: ${item.craft_type_id}`)
      })
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

testLaborCategoriesAfterImport()