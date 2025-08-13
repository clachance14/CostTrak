#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function checkDashboard() {
  // Get project 5640
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, job_number, name, original_contract')
    .eq('job_number', '5640')
    .single()
  
  if (error || !project) {
    console.error('Error fetching project:', error)
    return
  }
  
  // Get labor costs
  const { data: labor } = await supabase
    .from('labor_employee_actuals')
    .select('total_cost_with_burden')
    .eq('project_id', project.id)
  
  const laborTotal = labor?.reduce((sum, l) => sum + (l.total_cost_with_burden || 0), 0) || 0
  
  // Get PO invoiced
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('invoiced_amount, committed_amount, total_amount')
    .eq('project_id', project.id)
    .eq('status', 'approved')
  
  const poInvoiced = pos?.reduce((sum, p) => sum + (p.invoiced_amount || 0), 0) || 0
  const poCommitted = pos?.reduce((sum, p) => sum + (p.committed_amount || p.total_amount || 0), 0) || 0
  
  // Get per diem
  const { data: perDiem } = await supabase
    .from('per_diem_costs')
    .select('amount')
    .eq('project_id', project.id)
  
  const perDiemTotal = perDiem?.reduce((sum, pd) => sum + (pd.amount || 0), 0) || 0
  
  // Get change orders
  const { data: changeOrders } = await supabase
    .from('change_orders')
    .select('amount')
    .eq('project_id', project.id)
    .eq('status', 'approved')
  
  const changeOrderTotal = changeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0
  
  console.log('\n==========================================')
  console.log(`Project 5640: ${project.name}`)
  console.log('==========================================')
  
  console.log('\nContract Values:')
  console.log('  Original Contract:', project.original_contract.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  Change Orders:', changeOrderTotal.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  Revised Contract:', (project.original_contract + changeOrderTotal).toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  
  console.log('\nCost Components:')
  console.log('  Labor (with burden):', laborTotal.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  Per Diem:', perDiemTotal.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  PO Invoiced:', poInvoiced.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  PO Committed:', poCommitted.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  
  console.log('\nCalculated Totals:')
  const currentCosts = laborTotal + poInvoiced + perDiemTotal
  const forecastedFinal = laborTotal + poCommitted + perDiemTotal
  const revisedContract = project.original_contract + changeOrderTotal
  
  console.log('  Current Costs (Actuals):', currentCosts.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  console.log('  Forecasted Final:', forecastedFinal.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  
  const margin = revisedContract > 0 ? ((revisedContract - forecastedFinal) / revisedContract) * 100 : 0
  const remaining = revisedContract - currentCosts
  
  console.log('\nFinancial Metrics:')
  console.log('  Margin:', margin.toFixed(1) + '%')
  console.log('  Remaining Budget:', remaining.toLocaleString('en-US', {style: 'currency', currency: 'USD'}))
  
  if (remaining < 0) {
    console.log('  ⚠️  PROJECT IS OVER BUDGET!')
  }
  
  console.log('\n✅ Dashboard should now show:')
  console.log('  - Current Costs includes per diem ($' + perDiemTotal.toLocaleString() + ')')
  console.log('  - Forecasted Final includes per diem')
  console.log('  - Margin calculations account for per diem')
}

checkDashboard().catch(console.error)