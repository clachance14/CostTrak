#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function verifyContractValues() {
  const supabase = createAdminClient()
  
  try {
    console.log('Checking SDO Tank Replacement project...\n')
    
    // Find the project by job number
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        job_number,
        original_contract,
        revised_contract
      `)
      .eq('job_number', '5800')
      .single()
    
    if (projectError) {
      console.error('Error finding project:', projectError)
      return
    }
    
    console.log('Project details:')
    console.log('- Name:', project.name)
    console.log('- Job Number:', project.job_number)
    console.log('- Original Contract:', project.original_contract || 'NULL')
    console.log('- Revised Contract:', project.revised_contract || 'NULL')
    console.log('')
    
    // Check if PO line items exist
    const { data: poLineItems, error: lineItemsError } = await supabase
      .from('project_po_line_items')
      .select('*')
      .eq('project_id', project.id)
      .order('line_number')
    
    if (lineItemsError) {
      console.error('Error fetching PO line items:', lineItemsError)
    } else {
      console.log(`Found ${poLineItems?.length || 0} PO line items:`)
      if (poLineItems && poLineItems.length > 0) {
        let total = 0
        poLineItems.forEach(item => {
          console.log(`  Line ${item.line_number}: ${item.description} - $${item.amount}`)
          total += Number(item.amount)
        })
        console.log(`  Total from line items: $${total}`)
      }
    }
    console.log('')
    
    // Check contract breakdown
    const { data: contractBreakdown, error: breakdownError } = await supabase
      .from('project_contract_breakdowns')
      .select('*')
      .eq('project_id', project.id)
      .single()
    
    if (breakdownError && breakdownError.code !== 'PGRST116') {
      console.error('Error fetching contract breakdown:', breakdownError)
    } else if (contractBreakdown) {
      console.log('Contract breakdown exists:')
      console.log('- Client PO Number:', contractBreakdown.client_po_number)
      console.log('- Total Contract Amount:', contractBreakdown.total_contract_amount || 'NULL')
      console.log('- Labor PO Amount:', contractBreakdown.labor_po_amount)
      console.log('- Materials PO Amount:', contractBreakdown.materials_po_amount)
      console.log('- Demo PO Amount:', contractBreakdown.demo_po_amount)
    } else {
      console.log('No contract breakdown found')
    }
    
    console.log('\n--- Summary ---')
    if (!project.original_contract && (!poLineItems || poLineItems.length === 0)) {
      console.log('❌ Contract value is missing because:')
      console.log('   - original_contract field is NULL')
      console.log('   - No PO line items found')
      console.log('\nTo fix: Re-create the project with PO line items, or update the original_contract field')
    } else if (project.original_contract) {
      console.log('✅ Contract value should display as: $' + project.original_contract)
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

verifyContractValues()