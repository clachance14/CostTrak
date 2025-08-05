#!/usr/bin/env tsx
// Test script for BUDGETS sheet discipline extraction and WBS building

import * as XLSX from 'xlsx'
import { ExcelBudgetAnalyzer } from '../lib/services/excel-budget-analyzer'
import { DisciplineMapper } from '../lib/services/discipline-mapper'
import * as fs from 'fs'

async function testBudgetsSheetDisciplineExtraction() {
  console.log('=== Testing BUDGETS Sheet Discipline Extraction ===\n')
  
  // Check if test file exists
  const testFilePath = process.argv[2]
  if (!testFilePath) {
    console.error('Please provide an Excel file path as argument')
    console.error('Usage: pnpm tsx scripts/test-budgets-discipline-extraction.ts <excel-file-path>')
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
    
    // Test DisciplineMapper extraction
    console.log('\n=== Testing DisciplineMapper.extractDisciplinesFromBudgets ===')
    const budgetsSheet = workbook.Sheets['BUDGETS']
    const budgetsData = XLSX.utils.sheet_to_json(budgetsSheet, { header: 1 }) as unknown[][]
    
    const disciplines = DisciplineMapper.extractDisciplinesFromBudgets(budgetsData)
    console.log('\nExtracted disciplines:', disciplines)
    
    // Create discipline mapping
    console.log('\n=== Testing Discipline Mapping ===')
    const projectDisciplines = DisciplineMapper.createDisciplineMapping(disciplines)
    
    console.log('\nDiscipline Groups:')
    Object.entries(projectDisciplines.disciplineGroups).forEach(([parent, group]) => {
      console.log(`\n${parent}:`)
      group.childDisciplines.forEach(child => {
        console.log(`  - ${child}`)
      })
    })
    
    // Test full budget extraction with WBS building
    console.log('\n\n=== Testing Full Budget Extraction with WBS ===')
    const analyzer = new ExcelBudgetAnalyzer()
    const budgetData = await analyzer.extractBudgetData(workbook)
    
    console.log('\nWBS Structure:')
    const printWBS = (nodes: any[], indent = '') => {
      nodes.forEach(node => {
        console.log(`${indent}${node.code} - ${node.description} ($${node.budget_total.toLocaleString()})`)
        if (node.children && node.children.length > 0) {
          printWBS(node.children, indent + '  ')
        }
      })
    }
    
    printWBS(budgetData.wbsStructure)
    
    console.log('\nSummary:')
    console.log(`Total Disciplines: ${budgetData.disciplineBudgets?.length || 0}`)
    console.log(`Total WBS Nodes: ${budgetData.wbsStructure.length}`)
    console.log(`Total Budget: $${budgetData.totals.grand_total.toLocaleString()}`)
    
    // Verify discipline data matches
    if (budgetData.disciplineBudgets) {
      console.log('\nDiscipline Budget Details:')
      budgetData.disciplineBudgets.forEach(disc => {
        console.log(`\n${disc.discipline}: $${disc.value.toLocaleString()}`)
        console.log(`  Manhours: ${disc.manhours.toLocaleString()}`)
        if (disc.costPerHour) {
          console.log(`  Cost/Hour: $${disc.costPerHour.toFixed(2)}`)
        }
      })
    }
    
  } catch (error) {
    console.error('Error processing file:', error)
    process.exit(1)
  }
}

// Run the test
testBudgetsSheetDisciplineExtraction()