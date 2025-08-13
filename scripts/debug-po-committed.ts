#!/usr/bin/env tsx
/**
 * Debug PO committed amounts for project 5772
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

async function debugPOCommitted() {
  console.log('🔍 Debugging PO Committed Amounts for Project 5772')
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
  console.log(`Project: ${project.name}`)
  console.log(`ID: ${projectId}`)
  
  // Get POs with all fields
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .order('po_number')
  
  console.log(`\n📋 Found ${purchaseOrders?.length || 0} approved POs`)
  
  let totalCommitted = 0
  let totalAmount = 0
  let totalInvoiced = 0
  let nullCommittedCount = 0
  let nullCommittedTotal = 0
  
  console.log('\n📊 PO Analysis:')
  purchaseOrders?.forEach((po, i) => {
    const committed = po.committed_amount
    const total = po.total_amount
    const invoiced = po.invoiced_amount || 0
    
    if (committed === null || committed === undefined) {
      nullCommittedCount++
      nullCommittedTotal += total || 0
      if (i < 5) {
        console.log(`  PO ${po.po_number}: committed=NULL, total=${formatCurrency(total || 0)}, invoiced=${formatCurrency(invoiced)}`)
      }
    } else if (i < 5) {
      console.log(`  PO ${po.po_number}: committed=${formatCurrency(committed)}, total=${formatCurrency(total || 0)}, invoiced=${formatCurrency(invoiced)}`)
    }
    
    totalCommitted += committed || total || 0  // Fallback to total if committed is null
    totalAmount += total || 0
    totalInvoiced += invoiced
  })
  
  console.log('\n💰 PO Totals:')
  console.log(`  Total Committed: ${formatCurrency(totalCommitted)}`)
  console.log(`  Total Amount: ${formatCurrency(totalAmount)}`)
  console.log(`  Total Invoiced: ${formatCurrency(totalInvoiced)}`)
  console.log(`  POs with NULL committed: ${nullCommittedCount} (${formatCurrency(nullCommittedTotal)})`)
  
  // Now check what the dashboard calculation would give
  console.log('\n🎯 Dashboard Calculation:')
  
  // Using dashboard's exact logic
  const committedPOCosts = purchaseOrders?.reduce(
    (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
    0
  ) || 0
  
  console.log(`  Dashboard PO Committed: ${formatCurrency(committedPOCosts)}`)
  
  // Get labor costs
  const { data: laborActuals } = await supabase
    .from('labor_employee_actuals')
    .select('st_wages, ot_wages, total_cost_with_burden')
    .eq('project_id', projectId)
  
  const laborActualCosts = laborActuals?.reduce(
    (sum, la) => sum + (la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
    0
  ) || 0
  
  console.log(`  Labor Actual Costs: ${formatCurrency(laborActualCosts)}`)
  console.log(`  Total Committed: ${formatCurrency(laborActualCosts + committedPOCosts)}`)
  
  // Check if the issue is with committed_amount being stored differently
  console.log('\n🔍 Checking committed_amount storage:')
  const { data: samplePOs } = await supabase
    .from('purchase_orders')
    .select('po_number, committed_amount, total_amount')
    .eq('project_id', projectId)
    .not('committed_amount', 'is', null)
    .limit(5)
  
  console.log(`  POs with non-null committed_amount: ${samplePOs?.length || 0}`)
  samplePOs?.forEach(po => {
    console.log(`    ${po.po_number}: ${formatCurrency(po.committed_amount)}`)
  })
}

debugPOCommitted().catch(console.error)