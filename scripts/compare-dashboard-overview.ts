#!/usr/bin/env tsx
/**
 * Script to compare dashboard values with project overview API
 * Ensures consistency between dashboard and individual project pages
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function compareProjectValues(projectId: string) {
  try {
    console.log(`\n📊 Comparing values for project ${projectId}`)
    console.log('=' .repeat(60))
    
    // 1. Get project data from database (simulating dashboard logic)
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    
    if (!project) {
      console.error('Project not found')
      return
    }
    
    console.log(`Project: ${project.name} (${project.job_number})`)
    console.log(`Base Margin: ${project.base_margin_percentage || 15}%`)
    
    // Get POs
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'approved')
    
    // Get labor actuals
    const { data: laborActuals } = await supabase
      .from('labor_employee_actuals')
      .select('*')
      .eq('project_id', projectId)
    
    // Get change orders
    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'approved')
    
    // Calculate values using dashboard logic
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
    
    const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal
    const totalCommitted = laborActualCosts + committedPOCosts
    const spendPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
    const baseMarginPercentage = project.base_margin_percentage || 15
    
    // Apply 20% threshold logic
    let forecastedFinalCost: number
    let method: string
    
    if (spendPercentage < 20) {
      // Under 20% spent: use margin-based calculation
      forecastedFinalCost = revisedContract * (1 - baseMarginPercentage / 100)
      method = 'margin-based'
    } else {
      // 20% or more spent: use actual committed value
      forecastedFinalCost = totalCommitted
      method = 'committed-based'
    }
    
    const currentCosts = laborActualCosts + poInvoicedCosts
    const remainingToSpend = revisedContract - forecastedFinalCost
    const margin = revisedContract > 0 
      ? ((revisedContract - forecastedFinalCost) / revisedContract) * 100
      : 0
    
    // 2. Now fetch from the overview API
    const API_BASE = 'http://localhost:3002'
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/overview`, {
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you'd need proper auth headers
      },
    })
    
    let overviewData: any = null
    if (response.ok) {
      overviewData = await response.json()
    }
    
    // 3. Compare values
    console.log('\n📈 Dashboard Calculations:')
    console.log(`  Contract Value: ${formatCurrency(revisedContract)}`)
    console.log(`  Current Costs: ${formatCurrency(currentCosts)}`)
    console.log(`  Total Committed: ${formatCurrency(totalCommitted)}`)
    console.log(`  Spend %: ${spendPercentage.toFixed(1)}%`)
    console.log(`  Method: ${method}`)
    console.log(`  Forecasted Final: ${formatCurrency(forecastedFinalCost)}`)
    console.log(`  Margin: ${margin.toFixed(1)}%`)
    console.log(`  Remaining: ${formatCurrency(remainingToSpend)}`)
    
    if (overviewData) {
      const apiProjections = overviewData.financialData?.projections
      const apiSummary = apiProjections?.summary
      
      console.log('\n📊 Overview API Values:')
      console.log(`  Contract Value: ${formatCurrency(overviewData.financialData?.revisedContract || 0)}`)
      console.log(`  Current Spend: ${formatCurrency(apiSummary?.currentSpend || 0)}`)
      console.log(`  Total Committed: ${formatCurrency(overviewData.financialData?.totalCommitted || 0)}`)
      console.log(`  Spend %: ${apiProjections?.currentSpendPercentage?.toFixed(1)}%`)
      console.log(`  Method: ${apiProjections?.projectionMethod}`)
      console.log(`  Forecasted Final: ${formatCurrency(apiSummary?.projectedFinalCost || 0)}`)
      console.log(`  Margin: ${apiSummary?.projectedMargin?.toFixed(1)}%`)
      console.log(`  Remaining: ${formatCurrency(overviewData.financialData?.remainingBudget || 0)}`)
      
      // Check for discrepancies
      console.log('\n✅ Comparison Results:')
      const finalCostMatch = Math.abs(forecastedFinalCost - (apiSummary?.projectedFinalCost || 0)) < 1000
      const marginMatch = Math.abs(margin - (apiSummary?.projectedMargin || 0)) < 0.5
      
      if (finalCostMatch && marginMatch) {
        console.log('  ✅ Values match between dashboard and overview!')
      } else {
        if (!finalCostMatch) {
          console.log(`  ❌ Forecasted Final Cost mismatch:`)
          console.log(`     Dashboard: ${formatCurrency(forecastedFinalCost)}`)
          console.log(`     Overview: ${formatCurrency(apiSummary?.projectedFinalCost || 0)}`)
          console.log(`     Difference: ${formatCurrency(Math.abs(forecastedFinalCost - (apiSummary?.projectedFinalCost || 0)))}`)
        }
        if (!marginMatch) {
          console.log(`  ❌ Margin mismatch:`)
          console.log(`     Dashboard: ${margin.toFixed(1)}%`)
          console.log(`     Overview: ${apiSummary?.projectedMargin?.toFixed(1)}%`)
        }
      }
    } else {
      console.log('\n⚠️  Could not fetch overview API data for comparison')
    }
    
  } catch (error) {
    console.error('Error comparing values:', error)
  }
}

async function main() {
  console.log('=' .repeat(60))
  console.log('🔍 DASHBOARD vs OVERVIEW COMPARISON')
  console.log('Verifying consistency between dashboard and project pages')
  console.log('=' .repeat(60))
  
  // Get a few active projects to test
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, job_number')
    .eq('status', 'active')
    .limit(3)
  
  if (!projects || projects.length === 0) {
    console.log('No active projects found')
    return
  }
  
  console.log(`\nFound ${projects.length} active projects to test`)
  
  for (const project of projects) {
    await compareProjectValues(project.id)
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('✅ Comparison Complete')
  console.log('=' .repeat(60))
}

// Run the comparison
main().catch(console.error)