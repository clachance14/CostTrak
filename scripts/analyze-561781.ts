#!/usr/bin/env tsx
/**
 * Analyze what could produce $561,781
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

async function analyze561781() {
  const TARGET = 561781
  console.log(`🔍 Analyzing what could produce ${formatCurrency(TARGET)}`)
  console.log('=' .repeat(60))
  
  // Get project 5772
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('job_number', '5772')
    .single()
  
  if (!project) return
  
  const projectId = project.id
  
  // Get all data
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
  
  // Calculate various combinations
  const laborActualCosts = laborActuals?.reduce(
    (sum, la) => sum + (la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
    0
  ) || 0
  
  const poCommitted = purchaseOrders?.reduce(
    (sum, po) => sum + (po.committed_amount || 0), 
    0
  ) || 0
  
  const poTotal = purchaseOrders?.reduce(
    (sum, po) => sum + (po.total_amount || 0), 
    0
  ) || 0
  
  const poInvoiced = purchaseOrders?.reduce(
    (sum, po) => sum + (po.invoiced_amount || 0), 
    0
  ) || 0
  
  const changeOrderTotal = changeOrders?.reduce(
    (sum, co) => sum + (co.amount || 0),
    0
  ) || 0
  
  const originalContract = project.original_contract || 0
  const revisedContract = originalContract + changeOrderTotal
  
  console.log('\n📊 Values:')
  console.log(`  Labor Costs: ${formatCurrency(laborActualCosts)}`)
  console.log(`  PO Committed: ${formatCurrency(poCommitted)}`)
  console.log(`  PO Total: ${formatCurrency(poTotal)}`)
  console.log(`  PO Invoiced: ${formatCurrency(poInvoiced)}`)
  console.log(`  Change Orders: ${formatCurrency(changeOrderTotal)}`)
  console.log(`  Original Contract: ${formatCurrency(originalContract)}`)
  console.log(`  Revised Contract: ${formatCurrency(revisedContract)}`)
  
  console.log('\n🧮 Checking combinations that might equal $561,781:')
  
  const combinations = [
    { name: 'Labor Only', value: laborActualCosts },
    { name: 'PO Committed Only', value: poCommitted },
    { name: 'PO Total Only', value: poTotal },
    { name: 'PO Invoiced Only', value: poInvoiced },
    { name: 'Labor - Some Amount', value: laborActualCosts - 131010 },
    { name: 'PO Total + Some Amount', value: poTotal + 245511 },
    { name: 'Contract × 49%', value: revisedContract * 0.49 },
    { name: 'Contract × 50%', value: revisedContract * 0.50 },
    { name: 'Labor × 81%', value: laborActualCosts * 0.81 },
    { name: 'Labor × 85%', value: laborActualCosts * 0.85 },
    { name: 'Wrong Calculation', value: laborActualCosts - poCommitted + poTotal },
  ]
  
  combinations.forEach(combo => {
    const diff = Math.abs(combo.value - TARGET)
    if (diff < 5000) {
      console.log(`  ✅ ${combo.name}: ${formatCurrency(combo.value)} (diff: ${formatCurrency(diff)})`)
    }
  })
  
  // Check if it's showing a different project
  console.log('\n🔍 Checking if it could be a different project...')
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, name, job_number, original_contract')
    .eq('status', 'active')
  
  for (const otherProject of allProjects || []) {
    if (otherProject.id === projectId) continue
    
    const { data: otherPOs } = await supabase
      .from('purchase_orders')
      .select('committed_amount, total_amount')
      .eq('project_id', otherProject.id)
      .eq('status', 'approved')
    
    const { data: otherLabor } = await supabase
      .from('labor_employee_actuals')
      .select('st_wages, ot_wages, total_cost_with_burden')
      .eq('project_id', otherProject.id)
    
    const otherLaborCost = otherLabor?.reduce(
      (sum, la) => sum + (la.total_cost_with_burden || 
        ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
      0
    ) || 0
    
    const otherPOCost = otherPOs?.reduce(
      (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
      0
    ) || 0
    
    const otherTotal = otherLaborCost + otherPOCost
    
    if (Math.abs(otherTotal - TARGET) < 5000) {
      console.log(`  ⚠️  Project ${otherProject.job_number} (${otherProject.name}): ${formatCurrency(otherTotal)}`)
    }
  }
}

analyze561781().catch(console.error)