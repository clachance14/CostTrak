#!/usr/bin/env tsx
/**
 * Debug labor calculation discrepancy
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

async function debugLabor() {
  console.log('🔍 Debugging Labor Calculation for Project 5772')
  console.log('=' .repeat(60))
  
  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('job_number', '5772')
    .single()
  
  if (!project) {
    console.error('Project not found')
    return
  }
  
  const projectId = project.id
  
  // Method 1: Full query (what overview uses)
  const { data: laborFull } = await supabase
    .from('labor_employee_actuals')
    .select('*')
    .eq('project_id', projectId)
  
  // Method 2: Limited fields (what dashboard uses)
  const { data: laborLimited } = await supabase
    .from('labor_employee_actuals')
    .select('project_id, st_wages, ot_wages, total_cost_with_burden')
    .eq('project_id', projectId)
  
  console.log(`\n📊 Record Counts:`)
  console.log(`  Full query: ${laborFull?.length || 0} records`)
  console.log(`  Limited query: ${laborLimited?.length || 0} records`)
  
  // Calculate using full data
  const fullCalc = laborFull?.reduce((sum, la) => {
    const withBurden = la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28
    return sum + withBurden
  }, 0) || 0
  
  // Calculate using limited data (dashboard method)
  const limitedCalc = laborLimited?.reduce((sum, la) => {
    const withBurden = la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28
    return sum + withBurden
  }, 0) || 0
  
  console.log('\n💰 Calculation Results:')
  console.log(`  Full query total: ${formatCurrency(fullCalc)}`)
  console.log(`  Limited query total: ${formatCurrency(limitedCalc)}`)
  console.log(`  Expected: ${formatCurrency(692791)}`)
  console.log(`  Dashboard showing: ${formatCurrency(153935.59)}`)
  
  // Check individual components
  const stWagesTotal = laborFull?.reduce((sum, la) => sum + (la.st_wages || 0), 0) || 0
  const otWagesTotal = laborFull?.reduce((sum, la) => sum + (la.ot_wages || 0), 0) || 0
  const burdenTotal = laborFull?.reduce((sum, la) => sum + (la.total_cost_with_burden || 0), 0) || 0
  
  console.log('\n📋 Component Breakdown:')
  console.log(`  ST Wages: ${formatCurrency(stWagesTotal)}`)
  console.log(`  OT Wages: ${formatCurrency(otWagesTotal)}`)
  console.log(`  Total wages: ${formatCurrency(stWagesTotal + otWagesTotal)}`)
  console.log(`  Wages * 1.28: ${formatCurrency((stWagesTotal + otWagesTotal) * 1.28)}`)
  console.log(`  Sum of total_cost_with_burden: ${formatCurrency(burdenTotal)}`)
  
  // Check for nulls in total_cost_with_burden
  const nullBurdenCount = laborFull?.filter(la => !la.total_cost_with_burden).length || 0
  const hasPartialBurden = burdenTotal > 0 && nullBurdenCount > 0
  
  console.log('\n🔍 Data Quality:')
  console.log(`  Records with NULL total_cost_with_burden: ${nullBurdenCount}`)
  console.log(`  Records with total_cost_with_burden: ${(laborFull?.length || 0) - nullBurdenCount}`)
  console.log(`  Has partial burden data: ${hasPartialBurden}`)
  
  // Sample records
  console.log('\n📝 Sample Records:')
  laborFull?.slice(0, 3).forEach((la, i) => {
    console.log(`  Record ${i + 1}:`)
    console.log(`    ST: ${formatCurrency(la.st_wages || 0)}`)
    console.log(`    OT: ${formatCurrency(la.ot_wages || 0)}`)
    console.log(`    Burden: ${la.total_cost_with_burden ? formatCurrency(la.total_cost_with_burden) : 'NULL'}`)
    console.log(`    Calc: ${formatCurrency(la.total_cost_with_burden || ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28)}`)
  })
  
  // Check if it's a different calculation
  const wagesOnly = stWagesTotal + otWagesTotal
  console.log('\n🎯 Matching Dashboard Value:')
  console.log(`  Dashboard shows: ${formatCurrency(153935.59)}`)
  console.log(`  Wages only: ${formatCurrency(wagesOnly)}`)
  console.log(`  Wages * 0.28 (burden only): ${formatCurrency(wagesOnly * 0.28)}`)
  console.log(`  Wages * 0.223: ${formatCurrency(wagesOnly * 0.223)} (close match!)`)
  
  // This might be using wrong burden rate
  const possibleRate = 153935.59 / wagesOnly
  console.log(`  Implied rate: ${possibleRate.toFixed(4)} (should be 1.28)`)
}

debugLabor().catch(console.error)