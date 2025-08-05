#!/usr/bin/env tsx

/**
 * Test script to verify GENERAL STAFFING is properly handled as Staff Labor
 */

import { ExcelBudgetAnalyzer, BudgetSheetDiscipline } from '../lib/services/excel-budget-analyzer'

// Mock GENERAL STAFFING discipline data
const mockGeneralStaffing: BudgetSheetDiscipline = {
  discipline: 'GENERAL STAFFING',
  disciplineNumber: '21',
  directLaborHours: 0,
  indirectLaborHours: 1051,
  manhours: 1051,
  value: 97040.42,
  categories: {
    'DIRECT LABOR': { manhours: 0, value: 0, percentage: 0 },
    'INDIRECT LABOR': { manhours: 1051, value: 62157.64, percentage: 64.05 },
    'MATERIALS': { manhours: 0, value: 0, percentage: 0 },
    'EQUIPMENT': { manhours: 0, value: 0, percentage: 0 },
    'SUBCONTRACTS': { manhours: 0, value: 0, percentage: 0 },
    'SMALL TOOLS & CONSUMABLES': { manhours: 0, value: 0, percentage: 0 },
    // Add-ons
    'TAXES & INSURANCE': { manhours: 0, value: 15259.70, percentage: 15.73 },
    'PERDIEM': { manhours: 0, value: 10080.00, percentage: 10.39 },
    'ADD ONS': { manhours: 0, value: 9543.08, percentage: 9.83 },
    'SCAFFOLDING': { manhours: 0, value: 0, percentage: 0 },
    'RISK': { manhours: 0, value: 0, percentage: 0 },
    // Totals (ignored)
    'ALL LABOR': { manhours: 1051, value: 62157.64, percentage: 64.05 },
    'DISCIPLINE TOTALS': { manhours: 1051, value: 97040.42, percentage: 100 }
  }
}

// Mock another discipline for comparison
const mockElectrical: BudgetSheetDiscipline = {
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
    'TAXES & INSURANCE': { manhours: 0, value: 3000, percentage: 3 },
    'PERDIEM': { manhours: 0, value: 1000, percentage: 1 },
    'ADD ONS': { manhours: 0, value: 500, percentage: 0.5 },
    'SCAFFOLDING': { manhours: 0, value: 300, percentage: 0.3 },
    'RISK': { manhours: 0, value: 200, percentage: 0.2 },
    'ALL LABOR': { manhours: 1200, value: 60000, percentage: 60 },
    'DISCIPLINE TOTALS': { manhours: 1200, value: 100000, percentage: 100 }
  }
}

async function testGeneralStaffing() {
  console.log('🧪 Testing GENERAL STAFFING as Staff Labor\n')
  
  const analyzer = new ExcelBudgetAnalyzer()
  const lineItems = analyzer.convertDisciplinesToLineItems([mockGeneralStaffing, mockElectrical])
  
  console.log('📊 Generated Line Items:\n')
  
  // Find staff labor items
  const staffItems = lineItems.filter(item => item.subcategory === 'STAFF')
  const laborItems = lineItems.filter(item => item.category === 'LABOR')
  
  console.log(`Total line items: ${lineItems.length}`)
  console.log(`Labor items: ${laborItems.length}`)
  console.log(`Staff labor items: ${staffItems.length}\n`)
  
  if (staffItems.length === 0) {
    console.log('❌ ERROR: No Staff Labor items found!')
    console.log('GENERAL STAFFING was not converted to Staff Labor')
  } else {
    console.log('✅ Staff Labor items found:\n')
    staffItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.description}`)
      console.log(`   Discipline: ${item.discipline}`)
      console.log(`   WBS Code: ${item.wbs_code}`)
      console.log(`   Total Cost: $${item.total_cost.toLocaleString()}`)
      console.log(`   Staff Cost Component: $${item.labor_staff_cost.toLocaleString()}`)
      console.log(`   Manhours: ${item.manhours}`)
      console.log()
    })
  }
  
  // Check totals
  console.log('💰 Budget Totals:\n')
  
  const totalDirectLabor = lineItems.reduce((sum, item) => sum + item.labor_direct_cost, 0)
  const totalIndirectLabor = lineItems.reduce((sum, item) => sum + item.labor_indirect_cost, 0)
  const totalStaffLabor = lineItems.reduce((sum, item) => sum + item.labor_staff_cost, 0)
  const totalLabor = totalDirectLabor + totalIndirectLabor + totalStaffLabor
  
  console.log(`Direct Labor: $${totalDirectLabor.toLocaleString()}`)
  console.log(`Indirect Labor: $${totalIndirectLabor.toLocaleString()}`)
  console.log(`Staff Labor: $${totalStaffLabor.toLocaleString()}`)
  console.log(`Total Labor: $${totalLabor.toLocaleString()}`)
  
  // Verify GENERAL STAFFING value
  console.log('\n🔍 Verification:')
  const expectedStaffBase = 62157.64 // INDIRECT LABOR value from GENERAL STAFFING
  const expectedAddOns = 15259.70 + 10080.00 + 9543.08 // Taxes & Insurance + Perdiem + Add Ons
  const expectedStaffTotal = expectedStaffBase + expectedAddOns
  
  console.log(`Expected Staff Labor (before risk): ~$${expectedStaffTotal.toLocaleString()}`)
  console.log(`Actual Staff Labor Total: $${totalStaffLabor.toLocaleString()}`)
  
  if (Math.abs(totalStaffLabor - expectedStaffTotal) < 1000) {
    console.log('✅ Staff Labor amount is correct (within expected range with risk allocation)')
  } else {
    console.log('❌ Staff Labor amount appears incorrect')
  }
  
  // Show all items for debugging
  console.log('\n📋 All Line Items:')
  lineItems.forEach((item, index) => {
    console.log(`${index + 1}. [${item.wbs_code}] ${item.description} - $${item.total_cost.toLocaleString()}`)
  })
}

// Run the test
testGeneralStaffing().catch(console.error)