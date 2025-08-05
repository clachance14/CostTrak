#!/usr/bin/env tsx
/**
 * Test the composite rate API endpoint
 */

import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testCompositeRateAPI() {
  console.log('🔍 Testing Composite Rate API Endpoint')
  console.log('=' .repeat(60))
  
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  const API_URL = 'http://localhost:3000/api/labor-forecasts/composite-rate'
  
  // First, we need to get an auth token
  // For testing, we'll use a simple approach
  console.log('\n📊 Testing API endpoint...')
  console.log(`URL: ${API_URL}?project_id=${projectId}&weeks_back=16`)
  
  try {
    const response = await fetch(`${API_URL}?project_id=${projectId}&weeks_back=16`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const data = await response.json()
    console.log('\n✅ API Response:')
    console.log(JSON.stringify(data, null, 2))
    
    if (data.compositeRate) {
      console.log('\n📊 Summary:')
      console.log(`- Overall rate: $${data.compositeRate.overall}/hr`)
      console.log(`- Total hours: ${data.compositeRate.totalHours}`)
      console.log(`- Total cost: $${data.compositeRate.totalCost}`)
      console.log(`- Weeks of data: ${data.compositeRate.weeksOfData}`)
      console.log(`- Categories: ${data.categoryRates?.length || 0}`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function main() {
  console.log('⚠️  Note: Make sure the Next.js dev server is running (pnpm dev)')
  console.log('⚠️  The API requires authentication, so this test may fail with 401')
  console.log()
  
  await testCompositeRateAPI()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)