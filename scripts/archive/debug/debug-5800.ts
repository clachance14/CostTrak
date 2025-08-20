#!/usr/bin/env tsx
/**
 * Debug project 5800 calculation
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function debugProject5800() {
  console.log('🔍 Debugging Project 5800 (SDO Tank Replacement)')
  console.log('=' .repeat(60))
  
  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('job_number', '5800')
    .single()
  
  if (!project) {
    console.error('Project not found')
    return
  }
  
  const projectId = project.id
  console.log(`Project ID: ${projectId}`)
  console.log(`Original Contract: ${formatCurrency(project.original_contract || 0)}`)
  console.log(`Base Margin: ${project.base_margin_percentage || 15}%`)
  
  // Get data
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'approved')
  
  const { data: laborActuals } = await supabase
    .from('labor_employee_actuals')
    .select('*')
    .eq('project_id', projectId)
  
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'approved')
  
  // Calculate values
  const laborActualCosts = laborActuals?.reduce(
    (sum, la) => sum + (la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
    0
  ) || 0
  
  const committedPOCosts = purchaseOrders?.reduce(
    (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
    0
  ) || 0
  
  const approvedChangeOrdersTotal = changeOrders?.reduce(
    (sum, co) => sum + (co.amount || 0),
    0
  ) || 0
  
  const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal
  const totalCommitted = laborActualCosts + committedPOCosts
  const spendPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
  const baseMarginPercentage = project.base_margin_percentage || 15
  
  console.log('\n📊 Calculation Details:')
  console.log(`  Labor Costs: ${formatCurrency(laborActualCosts)}`)
  console.log(`  PO Committed: ${formatCurrency(committedPOCosts)}`)
  console.log(`  Change Orders: ${formatCurrency(approvedChangeOrdersTotal)}`)
  console.log(`  Revised Contract: ${formatCurrency(revisedContract)}`)
  console.log(`  Total Committed: ${formatCurrency(totalCommitted)}`)
  console.log(`  Spend Percentage: ${spendPercentage.toFixed(1)}%`)
  
  console.log('\n🎯 Forecasted Final Calculation:')
  if (spendPercentage < 20) {
    const marginBasedForecast = revisedContract * (1 - baseMarginPercentage / 100)
    console.log(`  Method: MARGIN-BASED (under 20%)`)
    console.log(`  Formula: ${formatCurrency(revisedContract)} × (1 - ${baseMarginPercentage}%)`)
    console.log(`  Result: ${formatCurrency(marginBasedForecast)}`)
    console.log(`  ✅ Dashboard should show: ${formatCurrency(marginBasedForecast)}`)
  } else {
    console.log(`  Method: COMMITTED-BASED (≥20%)`)
    console.log(`  Formula: Total Committed`)
    console.log(`  Result: ${formatCurrency(totalCommitted)}`)
    console.log(`  ✅ Dashboard should show: ${formatCurrency(totalCommitted)}`)
  }
  
  console.log('\n📋 Data Summary:')
  console.log(`  Labor Records: ${laborActuals?.length || 0}`)
  console.log(`  PO Records: ${purchaseOrders?.length || 0}`)
  console.log(`  Change Orders: ${changeOrders?.length || 0}`)
}

debugProject5800().catch(console.error)