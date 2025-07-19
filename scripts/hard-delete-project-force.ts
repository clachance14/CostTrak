import { createAdminClient } from '@/lib/supabase/admin'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function hardDeleteProject(jobNumber: string, force: boolean = false) {
  console.log(`\n🗑️  HARD DELETE PROJECT: ${jobNumber}`)
  console.log('=' .repeat(50))
  
  const adminSupabase = createAdminClient()
  
  try {
    // Step 1: Find the project
    console.log('\n📋 Finding project...')
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('job_number', jobNumber)
      .single()
    
    if (projectError || !project) {
      console.error('❌ Project not found:', projectError?.message || 'No project with this job number')
      return
    }
    
    const projectId = project.id
    console.log(`✓ Found project: ${project.name} (ID: ${projectId})`)
    console.log(`  Status: ${project.status}`)
    console.log(`  Created: ${new Date(project.created_at).toLocaleDateString()}`)
    if (project.deleted_at) {
      console.log(`  ⚠️  Already soft deleted on: ${new Date(project.deleted_at).toLocaleDateString()}`)
    }
    
    // Step 2: Count all related data
    console.log('\n📊 Analyzing related data...')
    
    const dataCounts = {
      labor_employee_actuals: 0,
      labor_actuals: 0,
      labor_headcount_forecasts: 0,
      labor_running_averages: 0,
      po_line_items: 0,
      purchase_orders: 0,
      change_orders: 0,
      co_attachments: 0,
      invoices: 0,
      financial_snapshots: 0,
      project_budget_breakdowns: 0,
      project_budgets: 0,
      project_contract_breakdowns: 0,
      data_imports: 0,
      monthly_forecasts: 0,
      audit_log: 0
    }
    
    // Count labor data
    const { count: laborEmpCount } = await adminSupabase
      .from('labor_employee_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.labor_employee_actuals = laborEmpCount || 0
    
    const { count: laborCount } = await adminSupabase
      .from('labor_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.labor_actuals = laborCount || 0
    
    const { count: headcountCount } = await adminSupabase
      .from('labor_headcount_forecasts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.labor_headcount_forecasts = headcountCount || 0
    
    const { count: avgCount } = await adminSupabase
      .from('labor_running_averages')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.labor_running_averages = avgCount || 0
    
    // Count PO data
    const { data: pos } = await adminSupabase
      .from('purchase_orders')
      .select('id')
      .eq('project_id', projectId)
    
    const poIds = pos?.map(po => po.id) || []
    dataCounts.purchase_orders = poIds.length
    
    if (poIds.length > 0) {
      const { count: lineCount } = await adminSupabase
        .from('po_line_items')
        .select('*', { count: 'exact', head: true })
        .in('purchase_order_id', poIds)
      dataCounts.po_line_items = lineCount || 0
    }
    
    // Count change orders
    const { data: cos } = await adminSupabase
      .from('change_orders')
      .select('id')
      .eq('project_id', projectId)
    
    const coIds = cos?.map(co => co.id) || []
    dataCounts.change_orders = coIds.length
    
    if (coIds.length > 0) {
      const { count: attachCount } = await adminSupabase
        .from('co_attachments')
        .select('*', { count: 'exact', head: true })
        .in('change_order_id', coIds)
      dataCounts.co_attachments = attachCount || 0
    }
    
    // Count other data
    const { count: invoiceCount } = await adminSupabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.invoices = invoiceCount || 0
    
    const { count: snapshotCount } = await adminSupabase
      .from('financial_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.financial_snapshots = snapshotCount || 0
    
    const { count: breakdownCount } = await adminSupabase
      .from('project_budget_breakdowns')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_budget_breakdowns = breakdownCount || 0
    
    const { count: budgetCount } = await adminSupabase
      .from('project_budgets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_budgets = budgetCount || 0
    
    const { count: contractCount } = await adminSupabase
      .from('project_contract_breakdowns')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_contract_breakdowns = contractCount || 0
    
    const { count: importCount } = await adminSupabase
      .from('data_imports')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.data_imports = importCount || 0
    
    const { count: forecastCount } = await adminSupabase
      .from('monthly_forecasts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.monthly_forecasts = forecastCount || 0
    
    const { count: auditCount } = await adminSupabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', projectId)
      .eq('entity_type', 'projects')
    dataCounts.audit_log = auditCount || 0
    
    // Display summary
    console.log('\n📋 Data to be deleted:')
    let hasData = false
    for (const [table, count] of Object.entries(dataCounts)) {
      if (count > 0) {
        hasData = true
        console.log(`  - ${table}: ${count} records`)
      }
    }
    
    if (!hasData) {
      console.log('  ✓ No related data found')
    }
    
    console.log(`\n⚠️  WARNING: This will permanently delete the project and ALL related data!`)
    console.log(`⚠️  This action CANNOT be undone!\n`)
    
    if (!force) {
      console.log('❌ Deletion cancelled - use --force flag to confirm deletion')
      console.log('\nExample: npx tsx scripts/hard-delete-project-force.ts 5800 --force')
      return
    }
    
    console.log('✅ Force flag detected - proceeding with deletion...')
    console.log('\n🗑️  Starting deletion process...')
    
    // Step 3: Delete all data in correct order
    
    // Delete labor data
    if (dataCounts.labor_employee_actuals > 0) {
      console.log(`  Deleting ${dataCounts.labor_employee_actuals} labor employee actuals...`)
      const { error } = await adminSupabase
        .from('labor_employee_actuals')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.labor_actuals > 0) {
      console.log(`  Deleting ${dataCounts.labor_actuals} labor actuals...`)
      const { error } = await adminSupabase
        .from('labor_actuals')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.labor_headcount_forecasts > 0) {
      console.log(`  Deleting ${dataCounts.labor_headcount_forecasts} labor forecasts...`)
      const { error } = await adminSupabase
        .from('labor_headcount_forecasts')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.labor_running_averages > 0) {
      console.log(`  Deleting ${dataCounts.labor_running_averages} labor averages...`)
      const { error } = await adminSupabase
        .from('labor_running_averages')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete PO data
    if (dataCounts.po_line_items > 0) {
      console.log(`  Deleting ${dataCounts.po_line_items} PO line items...`)
      const { error } = await adminSupabase
        .from('po_line_items')
        .delete()
        .in('purchase_order_id', poIds)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.purchase_orders > 0) {
      console.log(`  Deleting ${dataCounts.purchase_orders} purchase orders...`)
      const { error } = await adminSupabase
        .from('purchase_orders')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete change order data
    if (dataCounts.co_attachments > 0) {
      console.log(`  Deleting ${dataCounts.co_attachments} CO attachments...`)
      const { error } = await adminSupabase
        .from('co_attachments')
        .delete()
        .in('change_order_id', coIds)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.change_orders > 0) {
      console.log(`  Deleting ${dataCounts.change_orders} change orders...`)
      const { error } = await adminSupabase
        .from('change_orders')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete other financial data
    if (dataCounts.invoices > 0) {
      console.log(`  Deleting ${dataCounts.invoices} invoices...`)
      const { error } = await adminSupabase
        .from('invoices')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.financial_snapshots > 0) {
      console.log(`  Deleting ${dataCounts.financial_snapshots} financial snapshots...`)
      const { error } = await adminSupabase
        .from('financial_snapshots')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete budget data
    if (dataCounts.project_budget_breakdowns > 0) {
      console.log(`  Deleting ${dataCounts.project_budget_breakdowns} budget breakdowns...`)
      const { error } = await adminSupabase
        .from('project_budget_breakdowns')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.project_budgets > 0) {
      console.log(`  Deleting ${dataCounts.project_budgets} project budgets...`)
      const { error } = await adminSupabase
        .from('project_budgets')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.project_contract_breakdowns > 0) {
      console.log(`  Deleting ${dataCounts.project_contract_breakdowns} contract breakdowns...`)
      const { error } = await adminSupabase
        .from('project_contract_breakdowns')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete other data
    if (dataCounts.data_imports > 0) {
      console.log(`  Deleting ${dataCounts.data_imports} import records...`)
      const { error } = await adminSupabase
        .from('data_imports')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.monthly_forecasts > 0) {
      console.log(`  Deleting ${dataCounts.monthly_forecasts} monthly forecasts...`)
      const { error } = await adminSupabase
        .from('monthly_forecasts')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.audit_log > 0) {
      console.log(`  Deleting ${dataCounts.audit_log} audit log entries...`)
      const { error } = await adminSupabase
        .from('audit_log')
        .delete()
        .eq('entity_id', projectId)
        .eq('entity_type', 'projects')
      if (error) console.error('    Error:', error.message)
    }
    
    // Finally, delete the project itself
    console.log(`  Deleting project record...`)
    const { error: projectDeleteError } = await adminSupabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    if (projectDeleteError) {
      console.error('❌ Failed to delete project:', projectDeleteError.message)
      return
    }
    
    // Verify deletion
    console.log('\n✓ Verifying deletion...')
    const { data: checkProject } = await adminSupabase
      .from('projects')
      .select('id')
      .eq('job_number', jobNumber)
      .single()
    
    if (checkProject) {
      console.error('❌ Project still exists!')
    } else {
      console.log('✅ Project and all related data successfully deleted!')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    if (error instanceof Error) {
      console.error('   ', error.message)
    }
  }
}

// Get job number and force flag from command line
const jobNumber = process.argv[2] || '5800'
const force = process.argv.includes('--force')

// Run the deletion
hardDeleteProject(jobNumber, force)