#!/usr/bin/env tsx

/**
 * Test script to verify the simplified budget allocation logic
 * This validates that the new allocation rules work correctly:
 * - Add Ons → Indirect only
 * - Perdiem → Direct + Indirect proportionally
 * - Taxes & Insurance → All labor proportionally
 * - Scaffolding → Subcontracts only
 * - Risk → All categories proportionally
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
    'TAXES & INSURANCE': { manhours: 0, value: 3000, percentage: 3 },  // Should go to all labor
    'PERDIEM': { manhours: 0, value: 1000, percentage: 1 },            // Should go to Direct + Indirect
    'ADD ONS': { manhours: 0, value: 500, percentage: 0.5 },           // Should go to Indirect only
    'SCAFFOLDING': { manhours: 0, value: 300, percentage: 0.3 },       // Should go to Subcontracts
    'RISK': { manhours: 0, value: 200, percentage: 0.2 },              // Should spread across all
    // Totals (ignored in processing)
    'ALL LABOR': { manhours: 1200, value: 60000, percentage: 60 },
    'DISCIPLINE TOTALS': { manhours: 1200, value: 100000, percentage: 100 }
  }
}

async function testBudgetAllocation() {
  console.log('🧪 Testing Simplified Budget Allocation Logic\n')
  
  const analyzer = new ExcelBudgetAnalyzer()
  const lineItems = analyzer.convertDisciplinesToLineItems([mockDiscipline])
  
  console.log('📊 Input Data:')
  console.log(`Direct Labor Base: $${mockDiscipline.categories['DIRECT LABOR'].value.toLocaleString()}`)
  console.log(`Indirect Labor Base: $${mockDiscipline.categories['INDIRECT LABOR'].value.toLocaleString()}`)
  console.log(`Materials Base: $${mockDiscipline.categories['MATERIALS'].value.toLocaleString()}`)
  console.log(`Equipment Base: $${mockDiscipline.categories['EQUIPMENT'].value.toLocaleString()}`)
  console.log(`Subcontracts Base: $${mockDiscipline.categories['SUBCONTRACTS'].value.toLocaleString()}`)
  console.log(`Small Tools Base: $${mockDiscipline.categories['SMALL TOOLS & CONSUMABLES'].value.toLocaleString()}`)
  console.log()
  
  console.log('🎯 Add-ons to Allocate:')
  console.log(`Taxes & Insurance: $${mockDiscipline.categories['TAXES & INSURANCE'].value.toLocaleString()} (→ All Labor)`)
  console.log(`Perdiem: $${mockDiscipline.categories['PERDIEM'].value.toLocaleString()} (→ Direct + Indirect)`)
  console.log(`Add Ons: $${mockDiscipline.categories['ADD ONS'].value.toLocaleString()} (→ Indirect Only)`)
  console.log(`Scaffolding: $${mockDiscipline.categories['SCAFFOLDING'].value.toLocaleString()} (→ Subcontracts)`)
  console.log(`Risk: $${mockDiscipline.categories['RISK'].value.toLocaleString()} (→ All Categories)`)
  console.log()
  
  console.log('📋 Generated Line Items:')
  lineItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.description}`)
    console.log(`   Category: ${item.category} | Subcategory: ${item.subcategory}`)
    console.log(`   Total Cost: $${item.total_cost.toLocaleString()}`)
    console.log(`   Cost Breakdown:`)
    console.log(`     Direct Labor: $${item.labor_direct_cost.toLocaleString()}`)
    console.log(`     Indirect Labor: $${item.labor_indirect_cost.toLocaleString()}`)
    console.log(`     Staff Labor: $${item.labor_staff_cost.toLocaleString()}`)
    console.log(`     Materials: $${item.materials_cost.toLocaleString()}`)
    console.log(`     Equipment: $${item.equipment_cost.toLocaleString()}`)
    console.log(`     Subcontracts: $${item.subcontracts_cost.toLocaleString()}`)
    console.log(`     Small Tools: $${item.small_tools_cost.toLocaleString()}`)
    console.log()
  })
  
  // Verify totals
  const totals = lineItems.reduce((acc, item) => ({
    directLabor: acc.directLabor + item.labor_direct_cost,
    indirectLabor: acc.indirectLabor + item.labor_indirect_cost,
    staffLabor: acc.staffLabor + item.labor_staff_cost,
    materials: acc.materials + item.materials_cost,
    equipment: acc.equipment + item.equipment_cost,
    subcontracts: acc.subcontracts + item.subcontracts_cost,
    smallTools: acc.smallTools + item.small_tools_cost,
    grandTotal: acc.grandTotal + item.total_cost
  }), {
    directLabor: 0, indirectLabor: 0, staffLabor: 0,
    materials: 0, equipment: 0, subcontracts: 0, smallTools: 0,
    grandTotal: 0
  })
  
  console.log('✅ Final Totals Summary:')
  console.log(`Direct Labor Total: $${totals.directLabor.toLocaleString()}`)
  console.log(`Indirect Labor Total: $${totals.indirectLabor.toLocaleString()}`)
  console.log(`Staff Labor Total: $${totals.staffLabor.toLocaleString()}`)
  console.log(`Materials Total: $${totals.materials.toLocaleString()}`)
  console.log(`Equipment Total: $${totals.equipment.toLocaleString()}`)
  console.log(`Subcontracts Total: $${totals.subcontracts.toLocaleString()}`)
  console.log(`Small Tools Total: $${totals.smallTools.toLocaleString()}`)
  console.log(`Grand Total: $${totals.grandTotal.toLocaleString()}`)
  console.log()
  
  // Verify allocation logic worked correctly
  const baseTotal = 50000 + 10000 + 20000 + 5000 + 8000 + 2000  // 95,000
  const addOnsTotal = 3000 + 1000 + 500 + 300 + 200              // 5,000
  const expectedTotal = baseTotal + addOnsTotal                   // 100,000
  
  console.log('🔍 Allocation Verification:')
  console.log(`Expected Total: $${expectedTotal.toLocaleString()}`)
  console.log(`Actual Total: $${totals.grandTotal.toLocaleString()}`)
  console.log(`Match: ${totals.grandTotal === expectedTotal ? '✅' : '❌'}`)
  console.log()
  
  // Test specific allocation rules
  const directLaborBase = 50000
  const indirectLaborBase = 10000
  const totalLaborBase = directLaborBase + indirectLaborBase
  const allCategoriesBase = 95000
  
  // Expected Direct Labor = Base + proportional Taxes&Insurance + proportional Perdiem + proportional Risk
  const expectedDirectAdditions = 
    (directLaborBase / totalLaborBase) * 3000 +  // Taxes & Insurance
    (directLaborBase / totalLaborBase) * 1000 +  // Perdiem
    (directLaborBase / allCategoriesBase) * 200   // Risk
  const expectedDirectTotal = directLaborBase + expectedDirectAdditions
  
  // Expected Indirect Labor = Base + proportional Taxes&Insurance + proportional Perdiem + Add Ons + proportional Risk
  const expectedIndirectAdditions = 
    (indirectLaborBase / totalLaborBase) * 3000 + // Taxes & Insurance
    (indirectLaborBase / totalLaborBase) * 1000 + // Perdiem
    500 +                                         // Add Ons (all)
    (indirectLaborBase / allCategoriesBase) * 200 // Risk
  const expectedIndirectTotal = indirectLaborBase + expectedIndirectAdditions
  
  // Expected Subcontracts = Base + Scaffolding + proportional Risk
  const expectedSubcontractsTotal = 8000 + 300 + (8000 / allCategoriesBase) * 200
  
  console.log('🎯 Specific Allocation Tests:')
  console.log(`Direct Labor - Expected: $${Math.round(expectedDirectTotal).toLocaleString()}, Actual: $${Math.round(totals.directLabor).toLocaleString()}`)
  console.log(`Indirect Labor - Expected: $${Math.round(expectedIndirectTotal).toLocaleString()}, Actual: $${Math.round(totals.indirectLabor).toLocaleString()}`)
  console.log(`Subcontracts - Expected: $${Math.round(expectedSubcontractsTotal).toLocaleString()}, Actual: $${Math.round(totals.subcontracts).toLocaleString()}`)
  console.log()
  
  // Alignment with PO Categories
  console.log('🏷️  PO Category Alignment:')
  console.log(`Materials Budget: $${totals.materials.toLocaleString()} (aligns with PO category "Materials")`)
  console.log(`Equipment Budget: $${totals.equipment.toLocaleString()} (aligns with PO category "Equipment")`)
  console.log(`Subcontracts Budget: $${totals.subcontracts.toLocaleString()} (aligns with PO category "Subcontracts")`)
  console.log(`Small Tools Budget: $${totals.smallTools.toLocaleString()} (aligns with PO category "Small Tools & Consumables")`)
  console.log()
  
  console.log('🎉 Budget allocation test completed!')
}

// Run the test
testBudgetAllocation().catch(console.error)