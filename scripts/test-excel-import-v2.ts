#!/usr/bin/env tsx

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { ExcelBudgetAnalyzerV2 } from '../lib/services/excel-budget-analyzer-v2'

// Command line arguments
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/test-excel-import-v2.ts <excel-file-path>')
  console.log('Example: npx tsx scripts/test-excel-import-v2.ts ./test-data/sample-budget.xlsx')
  process.exit(1)
}

const filePath = args[0]
const saveToDb = args.includes('--save') // Add --save flag to actually save to database

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

console.log('='.repeat(80))
console.log('5-LEVEL WBS EXCEL IMPORT TEST')
console.log('='.repeat(80))
console.log(`File: ${filePath}`)
console.log(`Mode: ${saveToDb ? 'SAVE TO DATABASE' : 'PREVIEW ONLY'}`)
console.log('='.repeat(80))

async function testImport() {
  try {
    // Read Excel file
    console.log('\n📖 Reading Excel file...')
    const workbook = XLSX.readFile(filePath)
    console.log(`Sheets found: ${workbook.SheetNames.join(', ')}`)
    
    // Create analyzer
    const analyzer = new ExcelBudgetAnalyzerV2()
    
    // Extract budget data
    console.log('\n🔍 Analyzing budget data...')
    const startTime = Date.now()
    const result = await analyzer.extractBudgetData(workbook, 'test-project-id')
    const endTime = Date.now()
    
    console.log(`\n✅ Analysis complete in ${endTime - startTime}ms`)
    
    // Display results
    console.log('\n' + '='.repeat(80))
    console.log('ANALYSIS RESULTS')
    console.log('='.repeat(80))
    
    // Budget totals
    console.log('\n💰 BUDGET TOTALS:')
    console.log(`  Labor:        $${result.totals.labor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  Materials:    $${result.totals.material.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  Equipment:    $${result.totals.equipment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  Subcontracts: $${result.totals.subcontract.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  Other:        $${result.totals.other.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  GRAND TOTAL:  $${result.totals.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    
    // Disciplines from BUDGETS
    if (result.disciplineBudgets && result.disciplineBudgets.length > 0) {
      console.log('\n📊 DISCIPLINES FROM BUDGETS:')
      result.disciplineBudgets.forEach(disc => {
        console.log(`  ${disc.disciplineNumber}. ${disc.discipline}: $${disc.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      })
    }
    
    // Validation results
    if (result.validationResult) {
      console.log('\n✓ VALIDATION SUMMARY:')
      console.log(`  Status: ${result.validationResult.isValid ? '✅ VALID' : '❌ INVALID'}`)
      console.log(`  Sheets Validated: ${result.validationResult.summary.sheetsValidated}`)
      console.log(`  Total Errors: ${result.validationResult.summary.totalErrors}`)
      console.log(`  Total Warnings: ${result.validationResult.summary.totalWarnings}`)
      
      // Show errors
      if (result.validationResult.summary.totalErrors > 0) {
        console.log('\n❌ ERRORS:')
        Object.values(result.validationResult.details).forEach(detail => {
          if (detail.errors.length > 0) {
            console.log(`  ${detail.sheetName}:`)
            detail.errors.forEach(err => console.log(`    • ${err}`))
          }
        })
      }
      
      // Show warnings
      if (result.validationResult.summary.totalWarnings > 0) {
        console.log('\n⚠️  WARNINGS:')
        Object.values(result.validationResult.details).forEach(detail => {
          if (detail.warnings.length > 0) {
            console.log(`  ${detail.sheetName}:`)
            detail.warnings.forEach(warn => console.log(`    • ${warn}`))
          }
        })
      }
    }
    
    // WBS Structure
    if (result.wbsStructure5Level && result.wbsStructure5Level.length > 0) {
      console.log('\n🏗️  5-LEVEL WBS STRUCTURE:')
      displayWBSTree(result.wbsStructure5Level)
    }
    
    // Phase allocations
    if (result.phaseAllocations && result.phaseAllocations.length > 0) {
      console.log(`\n👥 PHASE ALLOCATIONS: ${result.phaseAllocations.length} entries`)
      // Show first few
      result.phaseAllocations.slice(0, 3).forEach(alloc => {
        console.log(`  ${alloc.phase} - ${alloc.role}: ${alloc.fte} FTE for ${alloc.duration_months} months`)
      })
      if (result.phaseAllocations.length > 3) {
        console.log(`  ... and ${result.phaseAllocations.length - 3} more`)
      }
    }
    
    // Direct labor allocations
    if (result.directLaborAllocations && result.directLaborAllocations.length > 0) {
      console.log(`\n🔨 DIRECT LABOR ALLOCATIONS: ${result.directLaborAllocations.length} entries`)
      // Show summary by discipline
      const byDiscipline = result.directLaborAllocations.reduce((acc, alloc) => {
        if (!acc[alloc.discipline]) acc[alloc.discipline] = 0
        acc[alloc.discipline] += alloc.manhours
        return acc
      }, {} as Record<string, number>)
      
      Object.entries(byDiscipline).forEach(([disc, hours]) => {
        console.log(`  ${disc}: ${(hours as number).toLocaleString()} manhours`)
      })
    }
    
    // Line items by sheet
    console.log('\n📋 LINE ITEMS BY SHEET:')
    Object.entries(result.details).forEach(([sheet, items]) => {
      console.log(`  ${sheet}: ${items.length} items`)
    })
    
    // Save to database if requested
    if (saveToDb) {
      console.log('\n' + '='.repeat(80))
      console.log('💾 SAVING TO DATABASE...')
      console.log('='.repeat(80))
      
      // Note: In a real scenario, you would need the actual project ID and user ID
      console.log('⚠️  Save to database not implemented in test script')
      console.log('   Use the API endpoint for actual imports')
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error)
    process.exit(1)
  }
}

function displayWBSTree(nodes: any[], indent = ''): void {
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1
    const prefix = indent + (isLast ? '└── ' : '├── ')
    const budgetStr = node.budget_total ? ` ($${node.budget_total.toLocaleString()})` : ''
    console.log(`${prefix}${node.code} ${node.description}${budgetStr}`)
    
    if (node.children && node.children.length > 0) {
      const newIndent = indent + (isLast ? '    ' : '│   ')
      displayWBSTree(node.children, newIndent)
    }
  })
}

// Run the test
testImport().catch(console.error)