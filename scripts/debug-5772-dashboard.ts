#!/usr/bin/env tsx
/**
 * Debug script for project 5772 dashboard calculation
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

async function debugProject5772() {
  console.log('🔍 Debugging Project 5772 (NOx Abatement Project)')
  console.log('=' .repeat(60))
  
  // Find project by job number
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('job_number', '5772')
    .single()
  
  if (!project) {
    console.error('Project 5772 not found!')
    return
  }
  
  const projectId = project.id
  console.log(`Project ID: ${projectId}`)
  console.log(`Project Name: ${project.name}`)
  console.log(`Original Contract: ${formatCurrency(project.original_contract || 0)}`)
  
  // Fetch purchase orders - matching dashboard query
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('project_id, total_amount, invoiced_amount, committed_amount')
    .eq('project_id', projectId)
    .eq('status', 'approved')
  
  // Fetch labor actuals - matching dashboard query
  const { data: laborActuals } = await supabase
    .from('labor_employee_actuals')
    .select('project_id, st_wages, ot_wages, total_cost_with_burden')
    .eq('project_id', projectId)
  
  // Fetch change orders
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('project_id, amount')
    .eq('status', 'approved')
    .eq('project_id', projectId)
  
  console.log('\n📊 Raw Data Counts:')
  console.log(`  Labor Records: ${laborActuals?.length || 0}`)
  console.log(`  PO Records: ${purchaseOrders?.length || 0}`)
  console.log(`  Change Orders: ${changeOrders?.length || 0}`)
  
  // Dashboard calculation logic
  const laborActualCosts = laborActuals?.reduce(
    (sum, la) => sum + (la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
    0
  ) || 0
  
  const committedPOCosts = purchaseOrders?.reduce(
    (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
    0
  ) || 0
  
  const poInvoicedCosts = purchaseOrders?.reduce(
    (sum, po) => sum + (po.invoiced_amount || 0), 
    0
  ) || 0
  
  const approvedChangeOrdersTotal = changeOrders?.reduce(
    (sum, co) => sum + (co.amount || 0),
    0
  ) || 0
  
  console.log('\n💰 Calculated Values:')
  console.log(`  Labor Actual Costs: ${formatCurrency(laborActualCosts)}`)
  console.log(`  PO Committed Costs: ${formatCurrency(committedPOCosts)}`)
  console.log(`  PO Invoiced Costs: ${formatCurrency(poInvoicedCosts)}`)
  console.log(`  Approved Change Orders: ${formatCurrency(approvedChangeOrdersTotal)}`)
  
  // Calculate contract and committed
  const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal
  const totalCommitted = laborActualCosts + committedPOCosts
  const currentCosts = laborActualCosts + poInvoicedCosts
  const spendPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
  
  console.log('\n📈 Key Metrics:')
  console.log(`  Revised Contract: ${formatCurrency(revisedContract)}`)
  console.log(`  Total Committed (Labor + PO): ${formatCurrency(totalCommitted)}`)
  console.log(`  Current Costs (Labor + Invoiced): ${formatCurrency(currentCosts)}`)
  console.log(`  Spend Percentage: ${spendPercentage.toFixed(1)}%`)
  
  // Apply 20% threshold logic
  const baseMarginPercentage = 15 // default
  let committedCosts: number
  
  if (spendPercentage < 20) {
    committedCosts = revisedContract * (1 - baseMarginPercentage / 100)
    console.log('\n🎯 Using MARGIN-BASED calculation (under 20%)')
    console.log(`  Formula: ${formatCurrency(revisedContract)} × 85% = ${formatCurrency(committedCosts)}`)
  } else {
    committedCosts = totalCommitted
    console.log('\n🎯 Using COMMITTED-BASED calculation (≥20%)')
    console.log(`  Formula: Total Committed = ${formatCurrency(committedCosts)}`)
  }
  
  console.log('\n✅ Dashboard Should Show:')
  console.log(`  Forecasted Final: ${formatCurrency(committedCosts)}`)
  console.log(`  Expected: ${formatCurrency(1100636)}`)
  
  if (Math.abs(committedCosts - 1100636) > 1000) {
    console.log('\n❌ MISMATCH DETECTED!')
    console.log(`  Difference: ${formatCurrency(Math.abs(committedCosts - 1100636))}`)
    
    // Check individual PO values
    console.log('\n🔍 Checking PO Details:')
    let totalCommittedCheck = 0
    let totalAmountCheck = 0
    purchaseOrders?.forEach((po, i) => {
      if (i < 5) { // Show first 5 POs
        console.log(`  PO ${i + 1}: Committed=${formatCurrency(po.committed_amount || 0)}, Total=${formatCurrency(po.total_amount || 0)}`)
      }
      totalCommittedCheck += po.committed_amount || 0
      totalAmountCheck += po.total_amount || 0
    })
    console.log(`  Total PO Committed: ${formatCurrency(totalCommittedCheck)}`)
    console.log(`  Total PO Amount: ${formatCurrency(totalAmountCheck)}`)
  } else {
    console.log('\n✅ Values match!')
  }
}

debugProject5772().catch(console.error)