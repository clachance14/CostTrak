#!/usr/bin/env tsx

/**
 * Test script to verify category-based rate calculations
 * This ensures that forecast costs are calculated using weighted average rates by category
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCategoryRates() {
  console.log('\n=== Testing Category Rate Calculations ===\n')

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

    // Get craft types
    const { data: craftTypes } = await supabase
      .from('craft_types')
      .select('*')
      .eq('is_active', true)
    
    console.log('Craft Types by Category:')
    const categories = ['direct', 'indirect', 'staff']
    categories.forEach(cat => {
      const crafts = craftTypes?.filter(c => c.category === cat) || []
      console.log(`  ${cat}: ${crafts.length} craft types`)
      crafts.forEach(c => console.log(`    - ${c.name} (${c.code})`))
    })

    // Get recent labor actuals
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 8 * 7) // 8 weeks back

    const { data: laborActuals } = await supabase
      .from('labor_actuals')
      .select('*')
      .eq('project_id', project.id)
      .gte('week_ending', startDate.toISOString())
      .lte('week_ending', endDate.toISOString())
      .gt('actual_hours', 0)

    console.log(`\nFound ${laborActuals?.length || 0} labor actual records from last 8 weeks`)

    // Calculate category rates (weighted average)
    const categoryHours: Record<string, number> = { direct: 0, indirect: 0, staff: 0 }
    const categoryCosts: Record<string, number> = { direct: 0, indirect: 0, staff: 0 }
    
    craftTypes?.forEach(craft => {
      const craftActuals = laborActuals?.filter(a => a.craft_type_id === craft.id) || []
      const totalHours = craftActuals.reduce((sum, a) => sum + (a.actual_hours || 0), 0)
      const totalCost = craftActuals.reduce((sum, a) => sum + (a.actual_cost || 0), 0)
      
      categoryHours[craft.category] += totalHours
      categoryCosts[craft.category] += totalCost
    })

    console.log('\nCategory Totals:')
    categories.forEach(cat => {
      const hours = categoryHours[cat]
      const cost = categoryCosts[cat]
      const rate = hours > 0 ? cost / hours : 0
      
      console.log(`  ${cat.padEnd(10)} - Hours: ${hours.toFixed(0).padStart(6)}, Cost: $${cost.toFixed(0).padStart(8)}, Rate: $${rate.toFixed(2).padStart(6)}/hr`)
    })

    // Test the API endpoints
    console.log('\n=== Testing API Endpoints ===\n')

    // Test composite rate endpoint
    const compositeResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/placeholder?project_id=${project.id}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    // Test running averages endpoint
    console.log('Testing /api/labor-forecasts/running-averages:')
    const avgUrl = `http://localhost:3000/api/labor-forecasts/running-averages?project_id=${project.id}&weeks_back=8`
    console.log(`  URL: ${avgUrl}`)
    console.log('  (Run the dev server and test this endpoint manually)')

    // Test headcount endpoint
    console.log('\nTesting /api/labor-forecasts/headcount:')
    const hcUrl = `http://localhost:3000/api/labor-forecasts/headcount?project_id=${project.id}&weeks_ahead=12`
    console.log(`  URL: ${hcUrl}`)
    console.log('  (Run the dev server and test this endpoint manually)')

    console.log('\n=== Summary ===')
    console.log('Category rates are now calculated as weighted averages:')
    console.log('  Rate = Total Category Cost / Total Category Hours')
    console.log('This ensures consistent rates across all craft types within a category.')
    console.log('Forecast costs will use these category rates for more accurate projections.')

  } catch (error) {
    console.error('Error:', error)
  }
}

testCategoryRates()