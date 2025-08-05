#!/usr/bin/env tsx
/**
 * Test the weekly actuals API response format
 */

const API_BASE = 'http://localhost:3000/api'
const PROJECT_ID = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772

// Get auth token from environment or use a test token
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

if (!AUTH_TOKEN) {
  console.error('Please set AUTH_TOKEN environment variable')
  console.log('You can get a token by logging in and checking localStorage.getItem("supabase.auth.token")')
  process.exit(1)
}

async function testWeeklyActualsAPI() {
  console.log('🔍 Testing Weekly Actuals API')
  console.log('=' .repeat(60))
  console.log(`Project ID: ${PROJECT_ID}`)
  
  try {
    const response = await fetch(`${API_BASE}/labor-forecasts/weekly-actuals?project_id=${PROJECT_ID}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ API failed (${response.status}): ${error}`)
      return
    }
    
    const data = await response.json()
    console.log('\n✅ API Response received')
    
    // Check the structure
    console.log('\n📊 Response Structure:')
    console.log('- project:', data.project ? '✓' : '✗')
    console.log('- actuals:', Array.isArray(data.actuals) ? `✓ (${data.actuals.length} items)` : '✗')
    console.log('- categories:', Array.isArray(data.categories) ? `✓ (${data.categories.length} items)` : '✗')
    console.log('- summary:', data.summary ? '✓' : '✗')
    
    // Examine actuals data
    if (data.actuals && data.actuals.length > 0) {
      console.log('\n📋 Sample Actual Record:')
      const sample = data.actuals[0]
      console.log(JSON.stringify(sample, null, 2))
      
      console.log('\n🔍 Actual Fields Check:')
      console.log('- laborCategory:', sample.laborCategory ? `✓ "${sample.laborCategory}"` : '✗')
      console.log('- craftTypeId:', sample.craftTypeId ? `✓ "${sample.craftTypeId}"` : '✗')
      console.log('- weekEnding:', sample.weekEnding ? `✓ "${sample.weekEnding}"` : '✗')
      console.log('- actualHours:', sample.actualHours !== undefined ? `✓ ${sample.actualHours}` : '✗')
      console.log('- actualCost:', sample.actualCost !== undefined ? `✓ ${sample.actualCost}` : '✗')
      console.log('- totalHours:', sample.totalHours !== undefined ? `✓ ${sample.totalHours}` : '✗')
      console.log('- totalCost:', sample.totalCost !== undefined ? `✓ ${sample.totalCost}` : '✗')
      
      // Group by week to see distribution
      console.log('\n📅 Actuals by Week:')
      const byWeek = new Map<string, any[]>()
      data.actuals.forEach((actual: any) => {
        const week = actual.weekEnding.split('T')[0]
        if (!byWeek.has(week)) {
          byWeek.set(week, [])
        }
        byWeek.get(week)!.push(actual)
      })
      
      Array.from(byWeek.entries()).sort().forEach(([week, actuals]) => {
        console.log(`\n  Week ${week}:`)
        actuals.forEach(a => {
          console.log(`    - ${a.laborCategory}: ${a.actualHours || a.totalHours} hours, $${a.actualCost || a.totalCost}`)
        })
      })
    }
    
    // Check if we have laborCategory in the data
    const hasLaborCategory = data.actuals?.some((a: any) => a.laborCategory)
    const hasCraftTypeId = data.actuals?.some((a: any) => a.craftTypeId)
    
    console.log('\n📊 Data Format:')
    console.log(`- Using laborCategory: ${hasLaborCategory ? '✓ YES' : '✗ NO'}`)
    console.log(`- Using craftTypeId: ${hasCraftTypeId ? '✓ YES' : '✗ NO'}`)
    
    if (hasLaborCategory && !hasCraftTypeId) {
      console.log('\n✅ API is returning category-based data (new format)')
    } else if (!hasLaborCategory && hasCraftTypeId) {
      console.log('\n⚠️  API is returning craft-type-based data (legacy format)')
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

async function main() {
  console.log('⚠️  Make sure the Next.js dev server is running (pnpm dev)')
  console.log('⚠️  You need a valid auth token to test the API\n')
  
  await testWeeklyActualsAPI()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)