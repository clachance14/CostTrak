#!/usr/bin/env tsx
import { ExcelBudgetAnalyzer } from '../lib/services/excel-budget-analyzer'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

async function testBudgetImport() {
  try {
    console.log('🧪 Testing budget import with new schema...\n')
    
    // Create a sample Excel workbook with BUDGETS sheet
    const wb = XLSX.utils.book_new()
    
    // Create BUDGETS sheet with correct 12-row block format
    const budgetsData = [
      ['', '', '', 'Cost Type', 'Cost', 'Manhours'], // Header row
      // CIVIL discipline block
      ['1', 'CIVIL', '', 'DIRECT LABOR', 50000, 1000],
      ['', '', '', 'INDIRECT LABOR', 15000, 300],
      ['', '', '', 'ALL LABOR', 65000, 1300],
      ['', '', '', 'TAXES & INSURANCE', 8000, 0],
      ['', '', '', 'PERDIEM', 5000, 0],
      ['', '', '', 'ADD ONS', 8000, 0],
      ['', '', '', 'SMALL TOOLS & CONSUMABLES', 2000, 0],
      ['', '', '', 'MATERIALS', 30000, 0],
      ['', '', '', 'EQUIPMENT', 0, 0],
      ['', '', '', 'SUBCONTRACTS', 0, 0],
      ['', '', '', 'RISK', 5000, 0],
      ['', '', '', 'DISCIPLINE TOTALS', 123000, 1300],
      // STRUCTURAL discipline block
      ['2', 'STRUCTURAL', '', 'DIRECT LABOR', 75000, 1500],
      ['', '', '', 'INDIRECT LABOR', 20000, 400],
      ['', '', '', 'ALL LABOR', 95000, 1900],
      ['', '', '', 'TAXES & INSURANCE', 12000, 0],
      ['', '', '', 'PERDIEM', 5000, 0],
      ['', '', '', 'ADD ONS', 12000, 0],
      ['', '', '', 'SMALL TOOLS & CONSUMABLES', 3000, 0],
      ['', '', '', 'MATERIALS', 45000, 0],
      ['', '', '', 'EQUIPMENT', 25000, 0],
      ['', '', '', 'SUBCONTRACTS', 60000, 0],
      ['', '', '', 'RISK', 15000, 0],
      ['', '', '', 'DISCIPLINE TOTALS', 272000, 1900],
      // GENERAL STAFFING discipline block
      ['3', 'GENERAL STAFFING', '', 'DIRECT LABOR', 0, 0],
      ['', '', '', 'INDIRECT LABOR', 97453, 1949],
      ['', '', '', 'ALL LABOR', 97453, 1949],
      ['', '', '', 'TAXES & INSURANCE', 15000, 0],
      ['', '', '', 'PERDIEM', 10000, 0],
      ['', '', '', 'ADD ONS', 5000, 0],
      ['', '', '', 'SMALL TOOLS & CONSUMABLES', 0, 0],
      ['', '', '', 'MATERIALS', 0, 0],
      ['', '', '', 'EQUIPMENT', 0, 0],
      ['', '', '', 'SUBCONTRACTS', 0, 0],
      ['', '', '', 'RISK', 0, 0],
      ['', '', '', 'DISCIPLINE TOTALS', 127453, 1949]
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(budgetsData)
    XLSX.utils.book_append_sheet(wb, ws, 'BUDGETS')
    
    // Initialize analyzer
    const analyzer = new ExcelBudgetAnalyzer()
    
    // Extract budget data
    console.log('📊 Extracting budget data...')
    const budgetData = await analyzer.extractBudgetData(wb)
    
    // Display results
    console.log('\n✅ Budget Totals:')
    console.log(`   Direct Labor: $${budgetData.totals.laborDirect.toLocaleString()}`)
    console.log(`   Indirect Labor: $${budgetData.totals.laborIndirect.toLocaleString()}`)
    console.log(`   Staff Labor: $${budgetData.totals.laborStaff.toLocaleString()}`)
    console.log(`   Materials: $${budgetData.totals.materials.toLocaleString()}`)
    console.log(`   Equipment: $${budgetData.totals.equipment.toLocaleString()}`)
    console.log(`   Subcontracts: $${budgetData.totals.subcontracts.toLocaleString()}`)
    console.log(`   Small Tools: $${budgetData.totals.smallTools.toLocaleString()}`)
    console.log(`   ----------------`)
    console.log(`   Total Labor: $${budgetData.totals.totalLabor.toLocaleString()}`)
    console.log(`   Total Non-Labor: $${budgetData.totals.totalNonLabor.toLocaleString()}`)
    console.log(`   Grand Total: $${budgetData.totals.grandTotal.toLocaleString()}`)
    
    console.log('\n📋 Discipline Budgets:')
    budgetData.disciplineBudgets?.forEach(disc => {
      console.log(`\n   ${disc.discipline}:`)
      console.log(`     Base Values:`)
      Object.entries(disc.categories).forEach(([cat, data]) => {
        if (data.value > 0) {
          console.log(`       ${cat}: $${data.value.toLocaleString()}`)
        }
      })
      if (disc.allocations && Object.values(disc.allocations).some(v => v > 0)) {
        console.log(`     Allocations:`)
        Object.entries(disc.allocations).forEach(([key, value]) => {
          if (value > 0) {
            console.log(`       ${key}: $${value.toLocaleString()}`)
          }
        })
      }
      console.log(`     Total: $${(disc.total || 0).toLocaleString()}`)
    })
    
    // Test line item generation
    console.log('\n🔄 Converting to line items...')
    const lineItems = analyzer.convertDisciplinesToLineItems(
      budgetData.disciplineBudgets || [],
      'test-project-id',
      'test-batch-id'
    )
    
    console.log(`\n📝 Generated ${lineItems.length} line items`)
    
    // Verify line items have new column structure
    const sampleItem = lineItems[0]
    if (sampleItem) {
      console.log('\n🔍 Sample line item structure:')
      console.log(`   labor_direct_cost: ${sampleItem.labor_direct_cost}`)
      console.log(`   labor_indirect_cost: ${sampleItem.labor_indirect_cost}`)
      console.log(`   labor_staff_cost: ${sampleItem.labor_staff_cost}`)
      console.log(`   materials_cost: ${sampleItem.materials_cost}`)
      console.log(`   equipment_cost: ${sampleItem.equipment_cost}`)
      console.log(`   subcontracts_cost: ${sampleItem.subcontracts_cost}`)
      console.log(`   small_tools_cost: ${sampleItem.small_tools_cost}`)
      console.log(`   total_cost: ${sampleItem.total_cost}`)
    }
    
    // Verify totals add up
    const calculatedTotals = lineItems.reduce((acc, item) => ({
      laborDirect: acc.laborDirect + item.labor_direct_cost,
      laborIndirect: acc.laborIndirect + item.labor_indirect_cost,
      laborStaff: acc.laborStaff + item.labor_staff_cost,
      materials: acc.materials + item.materials_cost,
      equipment: acc.equipment + item.equipment_cost,
      subcontracts: acc.subcontracts + item.subcontracts_cost,
      smallTools: acc.smallTools + item.small_tools_cost,
      total: acc.total + item.total_cost
    }), {
      laborDirect: 0,
      laborIndirect: 0,
      laborStaff: 0,
      materials: 0,
      equipment: 0,
      subcontracts: 0,
      smallTools: 0,
      total: 0
    })
    
    console.log('\n✅ Verification - Line Item Totals:')
    console.log(`   Direct Labor: $${calculatedTotals.laborDirect.toLocaleString()}`)
    console.log(`   Indirect Labor: $${calculatedTotals.laborIndirect.toLocaleString()}`)
    console.log(`   Staff Labor: $${calculatedTotals.laborStaff.toLocaleString()}`)
    console.log(`   Materials: $${calculatedTotals.materials.toLocaleString()}`)
    console.log(`   Equipment: $${calculatedTotals.equipment.toLocaleString()}`)
    console.log(`   Subcontracts: $${calculatedTotals.subcontracts.toLocaleString()}`)
    console.log(`   Small Tools: $${calculatedTotals.smallTools.toLocaleString()}`)
    console.log(`   Total: $${calculatedTotals.total.toLocaleString()}`)
    
    console.log('\n🎉 Budget import test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testBudgetImport()