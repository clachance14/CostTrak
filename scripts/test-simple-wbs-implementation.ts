#!/usr/bin/env tsx

/**
 * Test script to verify the simple WBS implementation
 * This validates that WBS codes are correctly assigned to budget line items
 */

import { ExcelBudgetAnalyzer, BudgetSheetDiscipline } from '../lib/services/excel-budget-analyzer'

// Mock discipline data for testing
const mockDiscipline: BudgetSheetDiscipline = {
  discipline: 'ELECTRICAL',
  disciplineNumber: '01',
  directLaborHours: 1000,
  indirectLaborHours: 200,
  manhours: 1200,
  value: 100000,
  categories: {
    'DIRECT LABOR': { manhours: 1000, value: 50000, percentage: 50 },
    'INDIRECT LABOR': { manhours: 200, value: 10000, percentage: 10 },
    'MATERIALS': { manhours: 0, value: 20000, percentage: 20 },
    'EQUIPMENT': { manhours: 0, value: 5000, percentage: 5 },
    'SUBCONTRACTS': { manhours: 0, value: 8000, percentage: 8 },
    'SMALL TOOLS & CONSUMABLES': { manhours: 0, value: 2000, percentage: 2 },
    // Add-ons
    'TAXES & INSURANCE': { manhours: 0, value: 3000, percentage: 3 },
    'PERDIEM': { manhours: 0, value: 1000, percentage: 1 },
    'ADD ONS': { manhours: 0, value: 500, percentage: 0.5 },
    'SCAFFOLDING': { manhours: 0, value: 300, percentage: 0.3 },
    'RISK': { manhours: 0, value: 200, percentage: 0.2 },
    // Totals (ignored)
    'ALL LABOR': { manhours: 1200, value: 60000, percentage: 60 },
    'DISCIPLINE TOTALS': { manhours: 1200, value: 100000, percentage: 100 }
  }
}

// Expected WBS mapping
const wbsMapping: Record<string, { category: string; subcategory: string; description: string }> = {
  'L-001': { category: 'LABOR', subcategory: 'DIRECT', description: 'Direct Labor' },
  'L-002': { category: 'LABOR', subcategory: 'INDIRECT', description: 'Indirect Labor' },
  'L-003': { category: 'LABOR', subcategory: 'STAFF', description: 'Staff Labor' },
  'N-001': { category: 'NON_LABOR', subcategory: 'MATERIALS', description: 'Materials' },
  'N-002': { category: 'NON_LABOR', subcategory: 'EQUIPMENT', description: 'Equipment' },
  'N-003': { category: 'NON_LABOR', subcategory: 'SUBCONTRACTS', description: 'Subcontracts' },
  'N-004': { category: 'NON_LABOR', subcategory: 'SMALL_TOOLS', description: 'Small Tools & Consumables' }
}

async function testSimpleWBS() {
  console.log('🧪 Testing Simple WBS Implementation\n')
  
  const analyzer = new ExcelBudgetAnalyzer()
  const lineItems = analyzer.convertDisciplinesToLineItems([mockDiscipline])
  
  console.log('📊 Generated Line Items with WBS Codes:\n')
  
  // Check each line item for correct WBS assignment
  let allCorrect = true
  const wbsCounts: Record<string, number> = {}
  
  lineItems.forEach((item, index) => {
    const wbs = item.wbs_code || 'MISSING'
    wbsCounts[wbs] = (wbsCounts[wbs] || 0) + 1
    
    console.log(`${index + 1}. ${item.description}`)
    console.log(`   WBS Code: ${wbs}`)
    console.log(`   Category: ${item.category} | Subcategory: ${item.subcategory}`)
    console.log(`   Total Cost: $${item.total_cost.toLocaleString()}`)
    
    // Verify WBS code is correct
    if (wbs === 'MISSING') {
      console.log(`   ❌ ERROR: Missing WBS code!`)
      allCorrect = false
    } else if (!wbsMapping[wbs]) {
      console.log(`   ❌ ERROR: Invalid WBS code: ${wbs}`)
      allCorrect = false
    } else {
      const expected = wbsMapping[wbs]
      if (item.category !== expected.category || item.subcategory !== expected.subcategory) {
        console.log(`   ❌ ERROR: WBS ${wbs} mismatch - Expected ${expected.category}/${expected.subcategory}, got ${item.category}/${item.subcategory}`)
        allCorrect = false
      } else {
        console.log(`   ✅ WBS code correctly assigned`)
      }
    }
    console.log()
  })
  
  // Summary of WBS usage
  console.log('📋 WBS Code Usage Summary:')
  Object.entries(wbsMapping).forEach(([code, info]) => {
    const count = wbsCounts[code] || 0
    const status = count > 0 ? '✅' : '⚠️'
    console.log(`${status} ${code}: ${info.description} - Used ${count} time(s)`)
  })
  console.log()
  
  // Check for unexpected WBS codes
  Object.keys(wbsCounts).forEach(code => {
    if (code === 'MISSING' || !wbsMapping[code]) {
      console.log(`❌ Unexpected WBS code found: ${code}`)
      allCorrect = false
    }
  })
  
  // Final verdict
  console.log('🎯 Test Results:')
  if (allCorrect) {
    console.log('✅ All WBS codes correctly assigned!')
    console.log('✅ Simple WBS structure working as expected')
  } else {
    console.log('❌ Some WBS codes were incorrect or missing')
    console.log('Please check the implementation')
  }
  
  // Display the expected structure
  console.log('\n📚 Reference - Simple WBS Structure:')
  console.log('Labor Categories:')
  console.log('  L-001: Direct Labor')
  console.log('  L-002: Indirect Labor')
  console.log('  L-003: Staff Labor')
  console.log('Non-Labor Categories:')
  console.log('  N-001: Materials')
  console.log('  N-002: Equipment')
  console.log('  N-003: Subcontracts')
  console.log('  N-004: Small Tools & Consumables')
}

// Run the test
testSimpleWBS().catch(console.error)