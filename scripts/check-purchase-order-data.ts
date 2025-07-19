import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkPurchaseOrderData() {
  console.log('Connected to Supabase at:', supabaseUrl)
  console.log('\n=== Checking Purchase Order Data ===\n')

  // First, let's see how many purchase orders we have
  const { count } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })

  console.log(`Total purchase orders in database: ${count || 0}`)

  // Get a sample of purchase orders with all fields
  console.log('\n=== Sample Purchase Orders (First 10) ===\n')
  const { data: purchaseOrders, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      project:projects(
        job_number,
        name
      )
    `)
    .limit(10)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching purchase orders:', error)
    return
  }

  if (!purchaseOrders || purchaseOrders.length === 0) {
    console.log('No purchase orders found in the database.')
    return
  }

  // Display purchase order details focusing on PO numbers and any potential client references
  purchaseOrders.forEach((po, index) => {
    console.log(`\n--- Purchase Order ${index + 1} ---`)
    console.log(`PO Number: ${po.po_number}`)
    console.log(`Legacy PO Number: ${po.legacy_po_number || 'N/A'}`)
    console.log(`Project: ${po.project?.job_number} - ${po.project?.name}`)
    console.log(`Vendor: ${po.vendor_name}`)
    console.log(`Description: ${po.description || 'N/A'}`)
    console.log(`WO/PMO: ${po.wo_pmo || 'N/A'}`)
    console.log(`Contract Extra Type: ${po.contract_extra_type || 'N/A'}`)
    console.log(`Status: ${po.status}`)
    console.log(`Total Amount: $${po.total_amount || 0}`)
    console.log(`Committed Amount: $${po.committed_amount || 0}`)
    console.log(`Created At: ${po.created_at}`)
  })

  // Check if there are any PO numbers that might be client POs
  console.log('\n=== Analyzing PO Number Patterns ===\n')
  
  const { data: allPOs } = await supabase
    .from('purchase_orders')
    .select('po_number, legacy_po_number, wo_pmo, contract_extra_type')
    .limit(1000)

  if (allPOs) {
    // Look for different patterns in PO numbers
    const patterns = {
      withDash: allPOs.filter(po => po.po_number?.includes('-')).length,
      withLetters: allPOs.filter(po => /[A-Za-z]/.test(po.po_number || '')).length,
      numericOnly: allPOs.filter(po => /^\d+$/.test(po.po_number || '')).length,
      withWO: allPOs.filter(po => po.wo_pmo && po.wo_pmo.trim() !== '').length,
      withLegacy: allPOs.filter(po => po.legacy_po_number && po.legacy_po_number.trim() !== '').length
    }

    console.log('PO Number Patterns:')
    console.log(`- POs with dashes: ${patterns.withDash}`)
    console.log(`- POs with letters: ${patterns.withLetters}`)
    console.log(`- Numeric only POs: ${patterns.numericOnly}`)
    console.log(`- POs with WO/PMO field filled: ${patterns.withWO}`)
    console.log(`- POs with legacy PO number: ${patterns.withLegacy}`)

    // Show some examples of each pattern
    console.log('\n=== Example PO Numbers ===')
    
    const dashExamples = allPOs.filter(po => po.po_number?.includes('-')).slice(0, 5)
    if (dashExamples.length > 0) {
      console.log('\nPOs with dashes:')
      dashExamples.forEach(po => console.log(`  - ${po.po_number}`))
    }

    const woExamples = allPOs.filter(po => po.wo_pmo && po.wo_pmo.trim() !== '').slice(0, 5)
    if (woExamples.length > 0) {
      console.log('\nPOs with WO/PMO:')
      woExamples.forEach(po => console.log(`  - PO: ${po.po_number}, WO/PMO: ${po.wo_pmo}`))
    }

    const legacyExamples = allPOs.filter(po => po.legacy_po_number && po.legacy_po_number.trim() !== '').slice(0, 5)
    if (legacyExamples.length > 0) {
      console.log('\nPOs with legacy numbers:')
      legacyExamples.forEach(po => console.log(`  - Current: ${po.po_number}, Legacy: ${po.legacy_po_number}`))
    }
  }

  // Check for any PO line items that might have client references
  console.log('\n=== Checking PO Line Items ===\n')
  
  const { data: lineItems, count: lineItemCount } = await supabase
    .from('po_line_items')
    .select('*', { count: 'exact' })
    .limit(10)

  console.log(`Total PO line items: ${lineItemCount || 0}`)
  
  if (lineItems && lineItems.length > 0) {
    console.log('\nSample line items:')
    lineItems.forEach((item, index) => {
      console.log(`\nLine Item ${index + 1}:`)
      console.log(`  Description: ${item.description}`)
      console.log(`  Invoice/Ticket: ${item.invoice_ticket || 'N/A'}`)
      console.log(`  Material Description: ${item.material_description || 'N/A'}`)
      console.log(`  Contract/Extra Type: ${item.contract_extra_type || 'N/A'}`)
    })
  }
}

checkPurchaseOrderData().catch(console.error)