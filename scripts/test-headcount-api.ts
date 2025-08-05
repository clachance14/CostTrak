#!/usr/bin/env node
import fetch from 'node-fetch'

// Test the headcount forecast API to verify the fix works
async function testHeadcountAPI() {
  const baseUrl = 'http://localhost:3000'
  
  // Test payload that mimics what the frontend sends
  const testPayload = {
    project_id: "test-project-id", // You'll need a real project ID
    weeks: [
      {
        week_ending: "2024-08-24T00:00:00.000Z", // Saturday date
        entries: [
          {
            craft_type_id: "test-craft-id", // You'll need a real craft type ID
            headcount: 5,
            hours_per_person: 50
          }
        ]
      }
    ]
  }
  
  console.log('Testing headcount forecast API...')
  console.log('Payload:', JSON.stringify(testPayload, null, 2))
  
  try {
    const response = await fetch(`${baseUrl}/api/labor-forecasts/headcount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add authentication headers here
      },
      body: JSON.stringify(testPayload)
    })
    
    const data = await response.json()
    
    console.log('Response status:', response.status)
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    if (response.ok) {
      console.log('✅ API call successful!')
      console.log('Summary:', data.summary)
    } else {
      console.log('❌ API call failed')
      console.log('Error:', data.error)
      if (data.details) {
        console.log('Details:', JSON.stringify(data.details, null, 2))
      }
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

// Note: This test requires:
// 1. The app to be running (pnpm dev)
// 2. Valid project_id and craft_type_id from your database
// 3. Authentication (you may need to add auth headers)

console.log(`
To use this test:
1. Update the project_id and craft_type_id with real values from your database
2. Add authentication headers if needed
3. Make sure the app is running with 'pnpm dev'
4. Run: npx tsx scripts/test-headcount-api.ts
`)

testHeadcountAPI()