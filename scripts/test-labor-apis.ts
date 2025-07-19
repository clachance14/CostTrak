#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAPIs() {
  console.log('🧪 Testing Labor Forecast APIs...\n')

  try {
    // Get a test project
    const { data: projects } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .eq('status', 'active')
      .limit(1)

    if (!projects || projects.length === 0) {
      console.error('❌ No active projects found for testing')
      return
    }

    const projectId = projects[0].id
    console.log(`📋 Using project: ${projects[0].name} (${projects[0].job_number})\n`)

    // Test 1: Craft Types API
    console.log('1️⃣ Testing /api/craft-types...')
    const craftTypesResponse = await fetch(`http://localhost:3000/api/craft-types`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      }
    })
    const craftTypesData = await craftTypesResponse.json()
    
    if (craftTypesResponse.ok) {
      console.log(`✅ Craft Types API: Success (${craftTypesData.length} craft types)\n`)
    } else {
      console.error(`❌ Craft Types API: Failed - ${craftTypesData.error}\n`)
    }

    // Test 2: Running Averages API
    console.log('2️⃣ Testing /api/labor-forecasts/running-averages...')
    const runningAvgResponse = await fetch(
      `http://localhost:3000/api/labor-forecasts/running-averages?project_id=${projectId}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    )
    const runningAvgData = await runningAvgResponse.json()
    
    if (runningAvgResponse.ok) {
      console.log(`✅ Running Averages API: Success`)
      console.log(`   - ${runningAvgData.averages.length} craft types with averages`)
      console.log(`   - ${runningAvgData.summary.craftTypesWithData} have actual data\n`)
    } else {
      console.error(`❌ Running Averages API: Failed - ${runningAvgData.error}\n`)
    }

    // Test 3: Composite Rate API
    console.log('3️⃣ Testing /api/labor-forecasts/composite-rate...')
    const compositeRateResponse = await fetch(
      `http://localhost:3000/api/labor-forecasts/composite-rate?project_id=${projectId}&categories=direct,indirect,staff`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    )
    const compositeRateData = await compositeRateResponse.json()
    
    if (compositeRateResponse.ok) {
      console.log(`✅ Composite Rate API: Success`)
      console.log(`   - Overall rate: $${compositeRateData.compositeRate.overall.toFixed(2)}/hr`)
      console.log(`   - Total hours: ${compositeRateData.compositeRate.totalHours.toLocaleString()}`)
      console.log(`   - Weeks of data: ${compositeRateData.compositeRate.weeksOfData}\n`)
    } else {
      console.error(`❌ Composite Rate API: Failed - ${compositeRateData.error}\n`)
    }

    // Test 4: Weekly Actuals API
    console.log('4️⃣ Testing /api/labor-forecasts/weekly-actuals...')
    const weeklyActualsResponse = await fetch(
      `http://localhost:3000/api/labor-forecasts/weekly-actuals?project_id=${projectId}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    )
    const weeklyActualsData = await weeklyActualsResponse.json()
    
    if (weeklyActualsResponse.ok) {
      console.log(`✅ Weekly Actuals API: Success`)
      console.log(`   - ${weeklyActualsData.actuals.length} actual entries`)
      console.log(`   - ${weeklyActualsData.craftTypes.length} craft types available\n`)
    } else {
      console.error(`❌ Weekly Actuals API: Failed - ${weeklyActualsData.error}\n`)
    }

    console.log('✨ API testing complete!')

  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

// Run tests
testAPIs()