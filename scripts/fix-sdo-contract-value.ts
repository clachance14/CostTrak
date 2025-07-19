#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function fixContractValue() {
  const supabase = createAdminClient()
  
  try {
    console.log('Fixing contract value for SDO Tank Replacement project...\n')
    
    // Find the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, job_number')
      .eq('job_number', '5800')
      .single()
    
    if (projectError) {
      console.error('Error finding project:', projectError)
      return
    }
    
    console.log('Found project:', project.name)
    
    // Based on your screenshot, the PO line items should be:
    // Labor: $245,665
    // Materials: $76,577
    // Equipment: $65,604
    // Total: $387,846
    
    const poLineItems = [
      { line_number: 1, description: 'Labor', amount: 245665 },
      { line_number: 2, description: 'Materials', amount: 76577 },
      { line_number: 3, description: 'Equipment', amount: 65604 }
    ]
    
    const totalContract = poLineItems.reduce((sum, item) => sum + item.amount, 0)
    console.log('\nCreating PO line items:')
    
    // Insert PO line items
    for (const item of poLineItems) {
      const { error } = await supabase
        .from('project_po_line_items')
        .insert({
          project_id: project.id,
          line_number: item.line_number,
          description: item.description,
          amount: item.amount
        })
      
      if (error) {
        console.error(`Error inserting ${item.description}:`, error)
      } else {
        console.log(`✅ Added: ${item.description} - $${item.amount.toLocaleString()}`)
      }
    }
    
    console.log(`\nTotal contract amount: $${totalContract.toLocaleString()}`)
    
    // Update the project's original_contract
    const { error: updateError } = await supabase
      .from('projects')
      .update({ original_contract: totalContract })
      .eq('id', project.id)
    
    if (updateError) {
      console.error('Error updating original_contract:', updateError)
    } else {
      console.log('✅ Updated original_contract field')
    }
    
    // Update the contract breakdown total
    const { error: breakdownError } = await supabase
      .from('project_contract_breakdowns')
      .update({ 
        total_contract_amount: totalContract,
        labor_po_amount: 245665,
        materials_po_amount: 76577,
        demo_po_amount: 65604
      })
      .eq('project_id', project.id)
    
    if (breakdownError) {
      console.error('Error updating contract breakdown:', breakdownError)
    } else {
      console.log('✅ Updated contract breakdown totals')
    }
    
    console.log('\n🎉 Contract value has been fixed! The project should now show $387,846 as the contract value.')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Ask for confirmation
console.log('This script will update the SDO Tank Replacement project with:')
console.log('- Labor: $245,665')
console.log('- Materials: $76,577')
console.log('- Equipment: $65,604')
console.log('- Total: $387,846')
console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...')

setTimeout(() => {
  fixContractValue()
}, 5000)