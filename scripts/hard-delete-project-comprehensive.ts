import { createAdminClient } from '@/lib/supabase/admin'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface DataCount {
  [key: string]: number
}

async function hardDeleteProject(jobNumber: string, force: boolean = false, dryRun: boolean = false) {
  console.log(`\n🗑️  HARD DELETE PROJECT: ${jobNumber}`)
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be deleted')
  }
  console.log('=' .repeat(50))
  
  const adminSupabase = createAdminClient()
  
  // Initialize storage client for file deletion
  const storageSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
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
    
    const dataCounts: DataCount = {
      // Labor data
      labor_employee_actuals: 0,
      labor_actuals: 0,
      labor_headcount_forecasts: 0,
      labor_running_averages: 0,
      
      // PO data
      po_line_items: 0,
      purchase_orders: 0,
      project_po_line_items: 0,
      
      // Change order data
      change_orders: 0,
      co_attachments: 0,
      
      // Financial data
      invoices: 0,
      financial_snapshots: 0,
      project_budget_breakdowns: 0,
      project_budgets: 0,
      project_contract_breakdowns: 0,
      monthly_forecasts: 0,
      
      // Division data
      project_divisions: 0,
      division_budgets: 0,
      division_forecasts: 0,
      
      // Other data
      data_imports: 0,
      audit_log: 0,
      notification_triggers: 0,
      user_project_access: 0
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
    
    // Count project PO line items
    const { count: projectPOLineCount } = await adminSupabase
      .from('project_po_line_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_po_line_items = projectPOLineCount || 0
    
    // Count change orders and attachments
    const { data: cos } = await adminSupabase
      .from('change_orders')
      .select('id')
      .eq('project_id', projectId)
    
    const coIds = cos?.map(co => co.id) || []
    dataCounts.change_orders = coIds.length
    
    let attachmentFiles: { file_url: string }[] = []
    if (coIds.length > 0) {
      const { data: attachments, count: attachCount } = await adminSupabase
        .from('co_attachments')
        .select('file_url', { count: 'exact' })
        .in('change_order_id', coIds)
      dataCounts.co_attachments = attachCount || 0
      attachmentFiles = attachments || []
    }
    
    // Count division data
    const { count: divisionCount } = await adminSupabase
      .from('project_divisions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_divisions = divisionCount || 0
    
    const { count: divBudgetCount } = await adminSupabase
      .from('division_budgets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.division_budgets = divBudgetCount || 0
    
    const { count: divForecastCount } = await adminSupabase
      .from('division_forecasts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.division_forecasts = divForecastCount || 0
    
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
    
    // Count notification triggers
    const { count: notificationCount } = await adminSupabase
      .from('notification_triggers')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', projectId)
      .eq('entity_type', 'project')
    dataCounts.notification_triggers = notificationCount || 0
    
    // Count user project access
    const { count: accessCount } = await adminSupabase
      .from('user_project_access')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.user_project_access = accessCount || 0
    
    // Display summary
    console.log('\n📋 Data to be deleted:')
    let hasData = false
    let totalRecords = 0
    for (const [table, count] of Object.entries(dataCounts)) {
      if (count > 0) {
        hasData = true
        totalRecords += count
        console.log(`  - ${table}: ${count} records`)
      }
    }
    
    if (attachmentFiles.length > 0) {
      console.log(`  - Storage files: ${attachmentFiles.length} files`)
    }
    
    if (!hasData) {
      console.log('  ✓ No related data found')
    } else {
      console.log(`\n  Total: ${totalRecords} database records`)
    }
    
    console.log(`\n⚠️  WARNING: This will permanently delete the project and ALL related data!`)
    console.log(`⚠️  This action CANNOT be undone!\n`)
    
    if (!force && !dryRun) {
      console.log('❌ Deletion cancelled - use --force flag to confirm deletion')
      console.log('\nExample: npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --force')
      console.log('         npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --dry-run')
      return
    }
    
    if (dryRun) {
      console.log('✅ Dry run completed - no data was deleted')
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
    
    // Delete CO attachments and their files
    if (dataCounts.co_attachments > 0) {
      console.log(`  Deleting ${dataCounts.co_attachments} CO attachments...`)
      
      // Delete files from storage
      if (attachmentFiles.length > 0) {
        console.log(`    Deleting ${attachmentFiles.length} files from storage...`)
        for (const attachment of attachmentFiles) {
          try {
            // Extract bucket and path from URL
            const urlParts = attachment.file_url.split('/storage/v1/object/public/')
            if (urlParts.length > 1) {
              const [bucket, ...pathParts] = urlParts[1].split('/')
              const filePath = pathParts.join('/')
              
              const { error: storageError } = await storageSupabase.storage
                .from(bucket)
                .remove([filePath])
              
              if (storageError) {
                console.error(`      Failed to delete file ${filePath}:`, storageError.message)
              }
            }
          } catch (err) {
            console.error(`      Error processing file ${attachment.file_url}:`, err)
          }
        }
      }
      
      const { error } = await adminSupabase
        .from('co_attachments')
        .delete()
        .in('change_order_id', coIds)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete change orders
    if (dataCounts.change_orders > 0) {
      console.log(`  Deleting ${dataCounts.change_orders} change orders...`)
      const { error } = await adminSupabase
        .from('change_orders')
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
    
    // Delete project PO line items (has CASCADE delete)
    if (dataCounts.project_po_line_items > 0) {
      console.log(`  Deleting ${dataCounts.project_po_line_items} project PO line items...`)
      const { error } = await adminSupabase
        .from('project_po_line_items')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete invoices
    if (dataCounts.invoices > 0) {
      console.log(`  Deleting ${dataCounts.invoices} invoices...`)
      const { error } = await adminSupabase
        .from('invoices')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete division data
    if (dataCounts.division_forecasts > 0) {
      console.log(`  Deleting ${dataCounts.division_forecasts} division forecasts...`)
      const { error } = await adminSupabase
        .from('division_forecasts')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.division_budgets > 0) {
      console.log(`  Deleting ${dataCounts.division_budgets} division budgets...`)
      const { error } = await adminSupabase
        .from('division_budgets')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.project_divisions > 0) {
      console.log(`  Deleting ${dataCounts.project_divisions} project division associations...`)
      const { error } = await adminSupabase
        .from('project_divisions')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('    Error:', error.message)
    }
    
    // Delete financial data
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
    
    if (dataCounts.monthly_forecasts > 0) {
      console.log(`  Deleting ${dataCounts.monthly_forecasts} monthly forecasts...`)
      const { error } = await adminSupabase
        .from('monthly_forecasts')
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
    
    if (dataCounts.audit_log > 0) {
      console.log(`  Deleting ${dataCounts.audit_log} audit log entries...`)
      const { error } = await adminSupabase
        .from('audit_log')
        .delete()
        .eq('entity_id', projectId)
        .eq('entity_type', 'projects')
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.notification_triggers > 0) {
      console.log(`  Deleting ${dataCounts.notification_triggers} notification triggers...`)
      const { error } = await adminSupabase
        .from('notification_triggers')
        .delete()
        .eq('entity_id', projectId)
        .eq('entity_type', 'project')
      if (error) console.error('    Error:', error.message)
    }
    
    if (dataCounts.user_project_access > 0) {
      console.log(`  Deleting ${dataCounts.user_project_access} user access records...`)
      const { error } = await adminSupabase
        .from('user_project_access')
        .delete()
        .eq('project_id', projectId)
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

// Get command line arguments
const jobNumber = process.argv[2]
const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')

if (!jobNumber) {
  console.log(`
Usage: npx tsx scripts/hard-delete-project-comprehensive.ts <job_number> [options]

Options:
  --force    Actually perform the deletion (required to delete)
  --dry-run  Show what would be deleted without actually deleting

Examples:
  npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --dry-run
  npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --force
`)
  process.exit(1)
}

// Run the deletion
hardDeleteProject(jobNumber, force, dryRun)