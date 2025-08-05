import { createAdminClient } from '@/lib/supabase/admin'
import { hardDeleteProject } from '@/lib/projects/hard-delete'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const TEST_JOB_NUMBER = 'TEST-DELETE-001'

async function createTestProject() {
  const supabase = createAdminClient()
  
  console.log('📝 Creating test project...')
  
  // Create a test project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      job_number: TEST_JOB_NUMBER,
      name: 'Test Project for Hard Delete',
      client_id: '00000000-0000-0000-0000-000000000000', // Use a dummy client ID
      original_contract_value: 1000000,
      revised_contract_value: 1000000,
      original_budget: 900000,
      revised_budget: 900000,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
      status: 'active',
      created_by: '00000000-0000-0000-0000-000000000000' // Dummy user ID
    })
    .select()
    .single()
  
  if (projectError) {
    console.error('❌ Failed to create project:', projectError)
    return null
  }
  
  console.log('✅ Created project:', project.id)
  
  // Create some related data
  console.log('📝 Creating related data...')
  
  // Create a purchase order
  const { data: po } = await supabase
    .from('purchase_orders')
    .insert({
      project_id: project.id,
      po_number: 'TEST-PO-001',
      vendor: 'Test Vendor',
      po_date: new Date().toISOString(),
      amount: 50000,
      description: 'Test Purchase Order',
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single()
  
  if (po) {
    // Create PO line items
    await supabase
      .from('po_line_items')
      .insert([
        {
          purchase_order_id: po.id,
          line_number: 1,
          description: 'Test Line Item 1',
          amount: 30000
        },
        {
          purchase_order_id: po.id,
          line_number: 2,
          description: 'Test Line Item 2',
          amount: 20000
        }
      ])
  }
  
  // Create a change order
  const { data: co } = await supabase
    .from('change_orders')
    .insert({
      project_id: project.id,
      co_number: 'TEST-CO-001',
      description: 'Test Change Order',
      amount: 50000,
      submitted_date: new Date().toISOString(),
      approval_status: 'pending',
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single()
  
  // Create labor data
  await supabase
    .from('labor_actuals')
    .insert({
      project_id: project.id,
      week_ending: new Date().toISOString(),
      craft_type: 'direct',
      actual_hours: 400,
      actual_cost: 20000,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
  
  await supabase
    .from('labor_headcount_forecasts')
    .insert({
      project_id: project.id,
      week_ending: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      craft_type: 'direct',
      headcount: 10,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
  
  // Create financial snapshot
  await supabase
    .from('financial_snapshots')
    .insert({
      project_id: project.id,
      snapshot_date: new Date().toISOString(),
      revised_contract: 1000000,
      revised_budget: 900000,
      committed_cost: 50000,
      actual_cost: 20000,
      forecast_cost: 850000,
      forecast_revenue: 1000000,
      forecast_margin: 150000,
      forecast_margin_percent: 15,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
  
  // Create project budget
  await supabase
    .from('project_budgets')
    .insert({
      project_id: project.id,
      category: 'labor',
      original_amount: 500000,
      revised_amount: 500000,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
  
  console.log('✅ Created all test data')
  
  return project
}

async function testHardDelete() {
  const supabase = createAdminClient()
  
  console.log('\n🧪 TESTING HARD DELETE FUNCTIONALITY')
  console.log('=' .repeat(50))
  
  try {
    // Step 1: Create test project with data
    const project = await createTestProject()
    if (!project) {
      console.error('❌ Failed to create test project')
      return
    }
    
    // Step 2: Test dry run
    console.log('\n🔍 Testing dry run mode...')
    const dryRunResult = await hardDeleteProject(supabase, TEST_JOB_NUMBER, { dryRun: true })
    
    console.log('Dry run results:')
    console.log('- Total records that would be deleted:', dryRunResult.totalRecordsDeleted)
    console.log('- Tables affected:', Object.keys(dryRunResult.deletedCounts).length)
    console.log('- Details:', dryRunResult.deletedCounts)
    
    if (dryRunResult.errors.length > 0) {
      console.error('❌ Dry run errors:', dryRunResult.errors)
    }
    
    // Verify nothing was actually deleted
    const { data: stillExists } = await supabase
      .from('projects')
      .select('id')
      .eq('job_number', TEST_JOB_NUMBER)
      .single()
    
    if (stillExists) {
      console.log('✅ Dry run successful - project still exists')
    } else {
      console.error('❌ Dry run failed - project was deleted!')
      return
    }
    
    // Step 3: Test actual deletion
    console.log('\n🗑️  Testing actual deletion...')
    const deleteResult = await hardDeleteProject(supabase, TEST_JOB_NUMBER, { 
      dryRun: false,
      deleteAttachments: true 
    })
    
    console.log('Deletion results:')
    console.log('- Success:', deleteResult.success)
    console.log('- Total records deleted:', deleteResult.totalRecordsDeleted)
    console.log('- Tables cleaned:', Object.keys(deleteResult.deletedCounts).length)
    console.log('- Details:', deleteResult.deletedCounts)
    
    if (deleteResult.errors.length > 0) {
      console.error('❌ Deletion errors:', deleteResult.errors)
    }
    
    // Step 4: Verify deletion
    console.log('\n✓ Verifying deletion...')
    
    // Check project is gone
    const { data: projectGone } = await supabase
      .from('projects')
      .select('id')
      .eq('job_number', TEST_JOB_NUMBER)
      .single()
    
    if (!projectGone) {
      console.log('✅ Project successfully deleted')
    } else {
      console.error('❌ Project still exists!')
    }
    
    // Check related data is gone
    const verificationChecks = [
      { table: 'purchase_orders', column: 'project_id' },
      { table: 'change_orders', column: 'project_id' },
      { table: 'labor_actuals', column: 'project_id' },
      { table: 'labor_headcount_forecasts', column: 'project_id' },
      { table: 'financial_snapshots', column: 'project_id' },
      { table: 'project_budgets', column: 'project_id' }
    ]
    
    let allClear = true
    for (const check of verificationChecks) {
      const { count } = await supabase
        .from(check.table as any)
        .select('*', { count: 'exact', head: true })
        .eq(check.column, project.id)
      
      if (count && count > 0) {
        console.error(`❌ Found ${count} remaining records in ${check.table}`)
        allClear = false
      }
    }
    
    if (allClear) {
      console.log('✅ All related data successfully deleted')
    }
    
    // Check audit log was created
    const { data: auditLog } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'hard_delete')
      .eq('entity_id', project.id)
      .single()
    
    if (auditLog) {
      console.log('✅ Audit log entry created')
      console.log('  - Total records deleted:', auditLog.changes?.total_records_deleted)
    } else {
      console.error('❌ No audit log entry found')
    }
    
    console.log('\n🎉 Hard delete testing complete!')
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
    if (error instanceof Error) {
      console.error('   ', error.message)
    }
  }
}

// Run the test
testHardDelete()