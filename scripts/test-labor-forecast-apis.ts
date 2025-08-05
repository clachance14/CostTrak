#!/usr/bin/env npx tsx

/**
 * Test script for labor forecast APIs after optimization
 */

const API_BASE = 'http://localhost:3000/api'
const PROJECT_ID = '90cc2a33-e02e-432d-abdb-c46b0e185a00'

// Get auth token from environment or use a test token
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

if (!AUTH_TOKEN) {
  console.error('Please set AUTH_TOKEN environment variable')
  console.log('You can get a token by logging in and checking localStorage.getItem("supabase.auth.token")')
  process.exit(1)
}

async function testAPI(endpoint: string, name: string) {
  console.log(`\n📊 Testing ${name}...`)
  const start = Date.now()
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    const elapsed = Date.now() - start
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ ${name} failed (${response.status}): ${error}`)
      return { success: false, elapsed }
    }
    
    const data = await response.json()
    console.log(`✅ ${name} succeeded in ${elapsed}ms`)
    
    // Log summary data
    if (name === 'Running Averages') {
      console.log(`   - Categories: ${data.averages?.length || 0}`)
      console.log(`   - Total Hours: ${data.summary?.totalHours?.toFixed(0) || 0}`)
      console.log(`   - Overall Rate: $${data.summary?.overallAvgRate?.toFixed(2) || 0}/hr`)
    } else if (name === 'Composite Rate') {
      console.log(`   - Overall Rate: $${data.compositeRate?.overall?.toFixed(2) || 0}/hr`)
      console.log(`   - Total Hours: ${data.compositeRate?.totalHours?.toFixed(0) || 0}`)
      console.log(`   - Categories: ${data.categoryRates?.length || 0}`)
    } else if (name === 'Weekly Actuals') {
      console.log(`   - Actuals: ${data.actuals?.length || 0}`)
      console.log(`   - Total Cost: $${data.summary?.totalCost?.toFixed(0) || 0}`)
      console.log(`   - Avg Rate: $${data.summary?.avgRate?.toFixed(2) || 0}/hr`)
    } else if (name === 'Headcount Forecast') {
      console.log(`   - Weeks: ${data.weeks?.length || 0}`)
      console.log(`   - Total Forecasted Cost: $${data.grandTotals?.forecastedCost?.toFixed(0) || 0}`)
      console.log(`   - Categories: ${data.categories?.length || 0}`)
    }
    
    return { success: true, elapsed, data }
  } catch (error) {
    console.error(`❌ ${name} error:`, error)
    return { success: false, elapsed: Date.now() - start }
  }
}

async function runTests() {
  console.log('🚀 Testing Labor Forecast APIs')
  console.log(`📍 Project ID: ${PROJECT_ID}`)
  console.log(`🔗 API Base: ${API_BASE}`)
  
  const results = []
  
  // Test each API
  results.push(await testAPI(
    `/labor-forecasts/running-averages?project_id=${PROJECT_ID}&weeks_back=16`,
    'Running Averages'
  ))
  
  results.push(await testAPI(
    `/labor-forecasts/composite-rate?project_id=${PROJECT_ID}&weeks_back=16`,
    'Composite Rate'
  ))
  
  results.push(await testAPI(
    `/labor-forecasts/weekly-actuals?project_id=${PROJECT_ID}`,
    'Weekly Actuals'
  ))
  
  results.push(await testAPI(
    `/labor-forecasts/headcount?project_id=${PROJECT_ID}&weeks_ahead=26&start_date=2025-04-15`,
    'Headcount Forecast'
  ))
  
  // Summary
  console.log('\n📈 Performance Summary:')
  const successful = results.filter(r => r.success)
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0)
  const avgTime = totalTime / results.length
  
  console.log(`✅ Success Rate: ${successful.length}/${results.length}`)
  console.log(`⏱️  Average Response Time: ${avgTime.toFixed(0)}ms`)
  console.log(`⚡ Total Time: ${totalTime}ms`)
  
  if (successful.length === results.length) {
    console.log('\n🎉 All APIs working correctly!')
  } else {
    console.log('\n⚠️  Some APIs failed - check the errors above')
  }
}

// Run the tests
runTests().catch(console.error)