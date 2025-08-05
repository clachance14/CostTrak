#!/usr/bin/env tsx
// Test script for BUDGETS sheet extraction with 12-row discipline blocks

import * as XLSX from 'xlsx'
import { ExcelBudgetAnalyzer } from '../lib/services/excel-budget-analyzer'
import * as fs from 'fs'
import * as path from 'path'

async function testBudgetSheetExtraction() {
  console.log('=== Testing BUDGETS Sheet Extraction ===\n')
  
  // Check if test file exists
  const testFilePath = process.argv[2]
  if (!testFilePath) {
    console.error('Please provide an Excel file path as argument')
    console.error('Usage: pnpm tsx scripts/test-budget-sheet-extraction.ts <excel-file-path>')
    process.exit(1)
  }
  
  if (!fs.existsSync(testFilePath)) {
    console.error(`File not found: ${testFilePath}`)
    process.exit(1)
  }
  
  try {
    // Read the Excel file
    console.log(`Reading file: ${testFilePath}`)
    const workbook = XLSX.readFile(testFilePath)
    
    // Check if BUDGETS sheet exists
    if (!workbook.SheetNames.includes('BUDGETS')) {
      console.error('BUDGETS sheet not found in workbook')
      console.log('Available sheets:', workbook.SheetNames)
      process.exit(1)
    }
    
    // Create analyzer
    const analyzer = new ExcelBudgetAnalyzer()
    
    // Extract disciplines from BUDGETS sheet
    console.log('\nExtracting disciplines from BUDGETS sheet...')
    const disciplines = analyzer.extractBudgetSheetDisciplines(workbook)
    
    console.log(`\nFound ${disciplines.length} disciplines:\n`)
    
    // Display each discipline's data
    disciplines.forEach((disc, index) => {
      console.log(`${index + 1}. ${disc.discipline}`)
      console.log(`   Total Manhours: ${disc.manhours.toLocaleString()}`)
      console.log(`   Total Value: $${disc.value.toLocaleString()}`)
      if (disc.costPerHour) {
        console.log(`   Cost per Hour: $${disc.costPerHour.toFixed(2)}`)
      }
      console.log(`   Categories:`)
      
      Object.entries(disc.categories).forEach(([category, data]) => {
        if (data.value > 0) {
          console.log(`     - ${category}: $${data.value.toLocaleString()} (${data.percentage}%)`)
          if (data.manhours > 0) {
            console.log(`       Manhours: ${data.manhours.toLocaleString()}`)
          }
        }
      })
      console.log('')
    })
    
    // Test conversion to line items
    console.log('\n=== Converting to Budget Line Items ===\n')
    const lineItems = analyzer.convertDisciplinesToLineItems(disciplines)
    
    console.log(`Created ${lineItems.length} line items\n`)
    
    // Group by cost_type and show totals
    const costTypeTotals: Record<string, number> = {}
    lineItems.forEach(item => {
      const costType = item.cost_type || 'OTHER'
      costTypeTotals[costType] = (costTypeTotals[costType] || 0) + item.total_cost
    })
    
    console.log('Cost Type Summary:')
    Object.entries(costTypeTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([costType, total]) => {
        console.log(`  ${costType}: $${total.toLocaleString()}`)
      })
    
    // Calculate total perdiem across all disciplines
    const totalPerdiem = lineItems
      .filter(item => item.cost_type?.toUpperCase() === 'PERDIEM')
      .reduce((sum, item) => sum + item.total_cost, 0)
    
    console.log(`\nTotal PERDIEM across all disciplines: $${totalPerdiem.toLocaleString()}`)
    
    // Calculate total materials
    const totalMaterials = lineItems
      .filter(item => item.cost_type?.toUpperCase() === 'MATERIALS')
      .reduce((sum, item) => sum + item.total_cost, 0)
    
    console.log(`Total MATERIALS across all disciplines: $${totalMaterials.toLocaleString()}`)
    
    // Show labor breakdown
    const directLabor = lineItems
      .filter(item => item.cost_type?.toUpperCase() === 'DIRECT LABOR')
      .reduce((sum, item) => sum + item.total_cost, 0)
    
    const indirectLabor = lineItems
      .filter(item => item.cost_type?.toUpperCase() === 'INDIRECT LABOR')
      .reduce((sum, item) => sum + item.total_cost, 0)
    
    console.log(`\nLabor Breakdown:`)
    console.log(`  Direct Labor: $${directLabor.toLocaleString()}`)
    console.log(`  Indirect Labor: $${indirectLabor.toLocaleString()}`)
    console.log(`  Total Labor: $${(directLabor + indirectLabor).toLocaleString()}`)
    
  } catch (error) {
    console.error('Error processing file:', error)
    process.exit(1)
  }
}

// Run the test
testBudgetSheetExtraction()