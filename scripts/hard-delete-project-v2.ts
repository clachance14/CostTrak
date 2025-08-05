import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import dotenv from 'dotenv'
import readline from 'readline'

// Load environment variables
dotenv.config({ path: '.env.local' })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

interface DeleteStats {
  tableName: string
  count: number
  error?: string
}

async function hardDeleteProject(jobNumber: string, options: { dryRun?: boolean } = {}) {
  console.log(`\n🗑️  HARD DELETE PROJECT: ${jobNumber}`)
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be deleted')
  }
  console.log('=' .repeat(50))
  
  const adminSupabase = createAdminClient()
  const deleteStats: DeleteStats[] = []
  
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
      // Labor tables
      labor_employee_actuals: 0,
      labor_actuals: 0,
      labor_headcount_forecasts: 0,
      labor_running_averages: 0,
      
      // PO tables
      po_line_items: 0,
      purchase_orders: 0,
      project_po_line_items: 0,
      
      // Change order tables
      co_attachments: 0,
      change_orders: 0,
      
      // Division tables (new)
      division_forecasts: 0,
      division_budgets: 0,
      project_divisions: 0,
      
      // Financial tables
      invoices: 0,
      financial_snapshots: 0,
      project_budget_breakdowns: 0,
      project_budgets: 0,
      project_contract_breakdowns: 0,
      monthly_forecasts: 0,
      
      // Other tables
      user_project_access: 0,
      data_imports: 0,
      audit_log: 0,
      notification_triggers: 0
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
    
    // Count project-specific PO line items
    const { count: projectPoLineCount } = await adminSupabase
      .from('project_po_line_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_po_line_items = projectPoLineCount || 0
    
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
    
    // Count division data (new)
    const { count: divisionForecastCount } = await adminSupabase
      .from('division_forecasts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.division_forecasts = divisionForecastCount || 0
    
    const { count: divisionBudgetCount } = await adminSupabase
      .from('division_budgets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.division_budgets = divisionBudgetCount || 0
    
    const { count: projectDivisionCount } = await adminSupabase
      .from('project_divisions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.project_divisions = projectDivisionCount || 0
    
    // Count financial data
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
    
    const { count: forecastCount } = await adminSupabase
      .from('monthly_forecasts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.monthly_forecasts = forecastCount || 0
    
    // Count other data
    const { count: accessCount } = await adminSupabase
      .from('user_project_access')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.user_project_access = accessCount || 0
    
    const { count: importCount } = await adminSupabase
      .from('data_imports')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    dataCounts.data_imports = importCount || 0
    
    const { count: auditCount } = await adminSupabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', projectId)
      .eq('entity_type', 'projects')
    dataCounts.audit_log = auditCount || 0
    
    const { count: notificationCount } = await adminSupabase
      .from('notification_triggers')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', projectId)
      .eq('entity_type', 'project')
    dataCounts.notification_triggers = notificationCount || 0
    
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
    
    if (!hasData) {
      console.log('  ✓ No related data found')
    } else {
      console.log(`\n  Total: ${totalRecords} records across ${Object.values(dataCounts).filter(c => c > 0).length} tables`)
    }
    
    console.log(`\n⚠️  WARNING: This will permanently delete the project and ALL related data!`)
    console.log(`⚠️  This action CANNOT be undone!\n`)
    
    if (options.dryRun) {
      console.log('✅ Dry run complete - no data was deleted')
      rl.close()
      return
    }
    
    const confirmationText = `DELETE PROJECT ${jobNumber}`
    const answer = await question(`Type "${confirmationText}" to confirm: `)
    
    if (answer !== confirmationText) {
      console.log('\n❌ Deletion cancelled')
      rl.close()
      return
    }
    
    console.log('\n🗑️  Starting deletion process...')
    
    // Helper function to delete from a table and track stats
    const deleteFromTable = async (tableName: string, deleteQuery: any) => {
      if (dataCounts[tableName as keyof typeof dataCounts] === 0) return
      
      console.log(`  Deleting ${dataCounts[tableName as keyof typeof dataCounts]} records from ${tableName}...`)
      const { error } = await deleteQuery
      
      if (error) {
        console.error(`    ❌ Error: ${error.message}`)
        deleteStats.push({ tableName, count: 0, error: error.message })
      } else {
        deleteStats.push({ tableName, count: dataCounts[tableName as keyof typeof dataCounts] })
      }
    }
    
    // Step 3: Delete all data in correct order (respecting foreign key constraints)
    
    // 1. Delete labor employee actuals first (references labor_actuals)
    await deleteFromTable('labor_employee_actuals', 
      adminSupabase.from('labor_employee_actuals').delete().eq('project_id', projectId)
    )
    
    // 2. Delete labor data
    await deleteFromTable('labor_actuals',
      adminSupabase.from('labor_actuals').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('labor_headcount_forecasts',
      adminSupabase.from('labor_headcount_forecasts').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('labor_running_averages',
      adminSupabase.from('labor_running_averages').delete().eq('project_id', projectId)
    )
    
    // 3. Delete CO attachments (references change_orders)
    if (coIds.length > 0) {
      await deleteFromTable('co_attachments',
        adminSupabase.from('co_attachments').delete().in('change_order_id', coIds)
      )
    }
    
    // 4. Delete change orders
    await deleteFromTable('change_orders',
      adminSupabase.from('change_orders').delete().eq('project_id', projectId)
    )
    
    // 5. Delete PO line items (references purchase_orders)
    if (poIds.length > 0) {
      await deleteFromTable('po_line_items',
        adminSupabase.from('po_line_items').delete().in('purchase_order_id', poIds)
      )
    }
    
    // 6. Delete purchase orders
    await deleteFromTable('purchase_orders',
      adminSupabase.from('purchase_orders').delete().eq('project_id', projectId)
    )
    
    // 7. Delete project-specific PO line items (has CASCADE delete, but include for completeness)
    await deleteFromTable('project_po_line_items',
      adminSupabase.from('project_po_line_items').delete().eq('project_id', projectId)
    )
    
    // 8. Delete invoices
    await deleteFromTable('invoices',
      adminSupabase.from('invoices').delete().eq('project_id', projectId)
    )
    
    // 9. Delete division-related data
    await deleteFromTable('division_forecasts',
      adminSupabase.from('division_forecasts').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('division_budgets',
      adminSupabase.from('division_budgets').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('project_divisions',
      adminSupabase.from('project_divisions').delete().eq('project_id', projectId)
    )
    
    // 10. Delete budget and contract data
    await deleteFromTable('project_budget_breakdowns',
      adminSupabase.from('project_budget_breakdowns').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('project_budgets',
      adminSupabase.from('project_budgets').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('project_contract_breakdowns',
      adminSupabase.from('project_contract_breakdowns').delete().eq('project_id', projectId)
    )
    
    // 11. Delete financial snapshots and forecasts
    await deleteFromTable('financial_snapshots',
      adminSupabase.from('financial_snapshots').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('monthly_forecasts',
      adminSupabase.from('monthly_forecasts').delete().eq('project_id', projectId)
    )
    
    // 12. Delete metadata and access data
    await deleteFromTable('data_imports',
      adminSupabase.from('data_imports').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('user_project_access',
      adminSupabase.from('user_project_access').delete().eq('project_id', projectId)
    )
    
    await deleteFromTable('notification_triggers',
      adminSupabase.from('notification_triggers').delete().eq('entity_id', projectId).eq('entity_type', 'project')
    )
    
    await deleteFromTable('audit_log',
      adminSupabase.from('audit_log').delete().eq('entity_id', projectId).eq('entity_type', 'projects')
    )
    
    // 13. Finally, delete the project itself
    console.log(`  Deleting project record...`)
    const { error: projectDeleteError } = await adminSupabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    if (projectDeleteError) {
      console.error('❌ Failed to delete project:', projectDeleteError.message)
      deleteStats.push({ tableName: 'projects', count: 0, error: projectDeleteError.message })
    } else {
      deleteStats.push({ tableName: 'projects', count: 1 })
    }
    
    // Step 4: Display deletion summary
    console.log('\n📊 Deletion Summary:')
    let successfulDeletes = 0
    let failedDeletes = 0
    let totalDeleted = 0
    
    deleteStats.forEach(stat => {
      if (stat.error) {
        failedDeletes++
        console.log(`  ❌ ${stat.tableName}: Failed - ${stat.error}`)
      } else if (stat.count > 0) {
        successfulDeletes++
        totalDeleted += stat.count
        console.log(`  ✅ ${stat.tableName}: ${stat.count} records deleted`)
      }
    })
    
    console.log(`\n  Total: ${totalDeleted} records deleted from ${successfulDeletes} tables`)
    if (failedDeletes > 0) {
      console.log(`  ⚠️  ${failedDeletes} tables had errors`)
    }
    
    // Step 5: Verify deletion
    console.log('\n✓ Verifying deletion...')
    const { data: checkProject } = await adminSupabase
      .from('projects')
      .select('id')
      .eq('job_number', jobNumber)
      .single()
    
    if (checkProject) {
      console.error('❌ Project still exists! Deletion may have partially failed.')
    } else {
      console.log('✅ Project and all related data successfully deleted!')
    }
    
    // Log the deletion to audit_log
    await adminSupabase
      .from('audit_log')
      .insert({
        action: 'hard_delete',
        entity_type: 'projects',
        entity_id: projectId,
        changes: {
          job_number: jobNumber,
          project_name: project.name,
          total_records_deleted: totalDeleted,
          tables_affected: deleteStats.length
        },
        performed_by: 'system' // This would be the actual user ID in production
      })
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    if (error instanceof Error) {
      console.error('   ', error.message)
    }
  } finally {
    rl.close()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const jobNumber = args.find(arg => !arg.startsWith('--')) || '5800'
const dryRun = args.includes('--dry-run')

// Display usage if help requested
if (args.includes('--help')) {
  console.log(`
Usage: npx tsx scripts/hard-delete-project-v2.ts [job-number] [options]

Options:
  --dry-run    Analyze what would be deleted without actually deleting
  --help       Show this help message

Examples:
  npx tsx scripts/hard-delete-project-v2.ts 5800
  npx tsx scripts/hard-delete-project-v2.ts 5800 --dry-run
`)
  process.exit(0)
}

// Run the deletion
hardDeleteProject(jobNumber, { dryRun })