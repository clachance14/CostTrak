#!/usr/bin/env tsx
/**
 * Debug full dashboard calculation matching exact dashboard logic
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

async function simulateDashboard() {
  console.log('🎯 Simulating Dashboard fetchProjects() for 5772')
  console.log('=' .repeat(60))
  
  // First, fetch just the project
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      job_number,
      original_contract,
      status
    `)
    .eq('job_number', '5772')
    .is('deleted_at', null)
  
  if (!projects || projects.length === 0) {
    console.error('Project not found')
    return
  }
  
  const project = projects[0]
  const projectIds = [project.id]
  
  console.log(`Found project: ${project.name} (${project.job_number})`)
  console.log(`Project ID: ${project.id}`)
  
  // Fetch purchase orders with committed amounts (EXACT dashboard query)
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('project_id, total_amount, invoiced_amount, committed_amount')
    .in('project_id', projectIds)
    .eq('status', 'approved')
  
  // Fetch labor actuals with burden (EXACT dashboard query)
  const { data: laborActuals } = await supabase
    .from('labor_employee_actuals')
    .select('project_id, st_wages, ot_wages, total_cost_with_burden')
    .in('project_id', projectIds)
  
  // Fetch labor forecasts (EXACT dashboard query)
  const { data: laborForecasts } = await supabase
    .from('labor_headcount_forecasts')
    .select('project_id, week_ending, headcount, avg_weekly_hours, craft_type_id')
    .in('project_id', projectIds)
  
  // Get weeks that have actuals (EXACT dashboard query)
  const { data: actualWeeks } = await supabase
    .from('labor_employee_actuals')
    .select('project_id, week_ending')
    .in('project_id', projectIds)
  
  // Fetch approved change orders (EXACT dashboard query)
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('project_id, amount')
    .eq('status', 'approved')
    .in('project_id', projectIds)
  
  console.log('\n📊 Data Fetched:')
  console.log(`  POs: ${purchaseOrders?.length || 0}`)
  console.log(`  Labor Actuals: ${laborActuals?.length || 0}`)
  console.log(`  Labor Forecasts: ${laborForecasts?.length || 0}`)
  console.log(`  Actual Weeks: ${actualWeeks?.length || 0}`)
  console.log(`  Change Orders: ${changeOrders?.length || 0}`)
  
  // Filter data for this project
  const projectPOs = purchaseOrders?.filter(po => po.project_id === project.id) || []
  const projectLabor = laborActuals?.filter(la => la.project_id === project.id) || []
  const projectForecasts = laborForecasts?.filter(lf => lf.project_id === project.id) || []
  const projectChangeOrders = changeOrders?.filter(co => co.project_id === project.id) || []
  
  // Calculate labor actual costs (EXACT dashboard calculation)
  const laborActualCosts = projectLabor.reduce(
    (sum, la) => sum + (la.total_cost_with_burden || 
      ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
    0
  )
  
  // Calculate PO committed costs (EXACT dashboard calculation)
  const committedPOCosts = projectPOs.reduce(
    (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
    0
  )
  
  // Calculate PO invoiced costs (EXACT dashboard calculation)
  const poInvoicedCosts = projectPOs.reduce(
    (sum, po) => sum + (po.invoiced_amount || 0), 
    0
  )
  
  // Current costs (EXACT dashboard calculation)
  const currentCosts = laborActualCosts + poInvoicedCosts
  
  // Create a set of weeks that have actual data
  const projectActualWeeks = new Set(
    actualWeeks
      ?.filter(w => w.project_id === project.id)
      .map(w => new Date(w.week_ending).toISOString().split('T')[0]) || []
  )
  
  // Filter forecasts to only include weeks without actuals (EXACT dashboard logic)
  const futureForecasts = projectForecasts.filter(f => {
    const weekEndingDate = new Date(f.week_ending).toISOString().split('T')[0]
    return !projectActualWeeks.has(weekEndingDate)
  })
  
  // Calculate remaining forecast (EXACT dashboard calculation)
  const defaultRate = 50
  const forecastedLaborCosts = futureForecasts.reduce(
    (sum, f) => sum + (f.headcount * (f.avg_weekly_hours || 50) * defaultRate), 
    0
  )
  
  // Total forecasted labor (EXACT dashboard calculation)
  const totalForecastedLabor = laborActualCosts + forecastedLaborCosts
  
  // Calculate approved change orders total (EXACT dashboard calculation)
  const approvedChangeOrdersTotal = projectChangeOrders.reduce(
    (sum, co) => sum + (co.amount || 0),
    0
  )
  
  // Calculate revised contract (EXACT dashboard calculation)
  const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal
  
  // Calculate total committed (EXACT dashboard calculation)
  const totalCommitted = laborActualCosts + committedPOCosts
  
  // Calculate spend percentage (EXACT dashboard calculation)
  const spendPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
  
  // Apply 20% threshold logic (EXACT dashboard calculation)
  let committedCosts: number
  const baseMarginPercentage = 15 // default
  
  if (spendPercentage < 20) {
    committedCosts = revisedContract * (1 - baseMarginPercentage / 100)
  } else {
    committedCosts = totalCommitted
  }
  
  // Calculate remaining and margin (EXACT dashboard calculation)
  const remainingToSpend = revisedContract - committedCosts
  const margin = revisedContract > 0 
    ? ((revisedContract - committedCosts) / revisedContract) * 100
    : 0
  
  console.log('\n💰 Calculations:')
  console.log(`  Labor Actual Costs: ${formatCurrency(laborActualCosts)}`)
  console.log(`  PO Committed Costs: ${formatCurrency(committedPOCosts)}`)
  console.log(`  PO Invoiced Costs: ${formatCurrency(poInvoicedCosts)}`)
  console.log(`  Current Costs: ${formatCurrency(currentCosts)}`)
  console.log(`  Future Forecast Labor: ${formatCurrency(forecastedLaborCosts)}`)
  console.log(`  Total Forecasted Labor: ${formatCurrency(totalForecastedLabor)}`)
  console.log(`  Approved Change Orders: ${formatCurrency(approvedChangeOrdersTotal)}`)
  console.log(`  Original Contract: ${formatCurrency(project.original_contract || 0)}`)
  console.log(`  Revised Contract: ${formatCurrency(revisedContract)}`)
  console.log(`  Total Committed: ${formatCurrency(totalCommitted)}`)
  console.log(`  Spend %: ${spendPercentage.toFixed(1)}%`)
  
  console.log('\n🎯 Final Dashboard Values:')
  console.log(`  Method: ${spendPercentage < 20 ? 'MARGIN-BASED' : 'COMMITTED-BASED'}`)
  console.log(`  Contract Value: ${formatCurrency(revisedContract)}`)
  console.log(`  Current Costs: ${formatCurrency(currentCosts)}`)
  console.log(`  Forecasted Final: ${formatCurrency(committedCosts)} ← DASHBOARD SHOULD SHOW THIS`)
  console.log(`  Margin: ${margin.toFixed(1)}%`)
  console.log(`  Remaining: ${formatCurrency(remainingToSpend)}`)
  
  console.log('\n✅ Expected vs Actual:')
  console.log(`  Expected: ${formatCurrency(1100636)}`)
  console.log(`  Dashboard Should Show: ${formatCurrency(committedCosts)}`)
  console.log(`  Match: ${Math.abs(committedCosts - 1100636) < 1000 ? '✅ YES' : '❌ NO'}`)
  
  if (Math.abs(committedCosts - 1100636) > 1000) {
    console.log('\n❌ INVESTIGATING MISMATCH...')
    console.log(`  Difference: ${formatCurrency(Math.abs(committedCosts - 1100636))}`)
    
    // If the value shown is $561,781, let's figure out what that could be
    if (Math.abs(committedCosts - 561781) < 1000) {
      console.log('\n🔍 Dashboard is showing labor-only costs!')
      console.log('  This suggests POs might not be included')
    }
  }
}

simulateDashboard().catch(console.error)