#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function checkLaborActualsCategories() {
  const supabase = createAdminClient()
  
  try {
    console.log('Checking labor actuals and their categories...\n')
    
    // Get labor actuals for the SDO project with craft type details
    const { data: laborActuals, error } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        actual_hours,
        actual_cost,
        craft_type_id,
        craft_types (
          code,
          name,
          category
        )
      `)
      .eq('project_id', (await supabase
        .from('projects')
        .select('id')
        .eq('job_number', '5800')
        .single()
      ).data?.id)
      .order('week_ending', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('Error fetching labor actuals:', error)
      return
    }
    
    console.log('Recent labor actuals for SDO Tank Replacement:\n')
    
    // Group by craft type category
    const categoryTotals: Record<string, { hours: number; cost: number }> = {
      direct: { hours: 0, cost: 0 },
      indirect: { hours: 0, cost: 0 },
      staff: { hours: 0, cost: 0 }
    }
    
    laborActuals?.forEach(actual => {
      const craftType = actual.craft_types as any
      const category = craftType?.category || 'direct'
      
      console.log(`Week ${actual.week_ending}: ${craftType?.code} (${craftType?.name})`)
      console.log(`  Category: ${category}`)
      console.log(`  Hours: ${actual.actual_hours}, Cost: $${actual.actual_cost}\n`)
      
      categoryTotals[category].hours += actual.actual_hours
      categoryTotals[category].cost += actual.actual_cost
    })
    
    console.log('\nCategory Totals:')
    Object.entries(categoryTotals).forEach(([category, totals]) => {
      if (totals.hours > 0) {
        console.log(`${category}: ${totals.hours} hours, $${totals.cost.toFixed(2)}`)
      }
    })
    
    // Check all unique craft types used in labor actuals
    const { data: allCraftTypes, error: craftError } = await supabase
      .from('labor_actuals')
      .select(`
        craft_types (
          code,
          name,
          category
        )
      `)
      .eq('project_id', (await supabase
        .from('projects')
        .select('id')
        .eq('job_number', '5800')
        .single()
      ).data?.id)
    
    if (!craftError && allCraftTypes) {
      const uniqueCrafts = new Set<string>()
      allCraftTypes.forEach(item => {
        const craft = item.craft_types as any
        if (craft) {
          uniqueCrafts.add(`${craft.code} (${craft.name}) - ${craft.category}`)
        }
      })
      
      console.log('\nUnique craft types used in this project:')
      uniqueCrafts.forEach(craft => console.log(`  - ${craft}`))
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkLaborActualsCategories()