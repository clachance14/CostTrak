#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixPoValues() {
  console.log('Starting PO value migration...')
  
  try {
    // First, let's check the current state
    const { data: checkData, error: checkError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, po_value, committed_amount, total_amount, invoiced_amount')
      .limit(10)
    
    if (checkError) {
      console.error('Error checking current data:', checkError)
      return
    }
    
    console.log('Sample of current data:')
    console.table(checkData?.map(po => ({
      po_number: po.po_number,
      po_value: po.po_value,
      committed_amount: po.committed_amount,
      total_amount: po.total_amount,
      invoiced_amount: po.invoiced_amount
    })))
    
    // Count records that need updating
    const { data: countData, error: countError } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .or('po_value.is.null,po_value.eq.0')
    
    if (countError) {
      console.error('Error counting records:', countError)
      return
    }
    
    const totalToUpdate = countData?.length || 0
    console.log(`\nFound ${totalToUpdate} POs where po_value is null or 0`)
    
    if (totalToUpdate === 0) {
      console.log('No records need updating. Migration may have already been run.')
      return
    }
    
    // Ask for confirmation
    console.log('\nThis will:')
    console.log('1. Copy committed_amount to po_value for records where po_value is null or 0')
    console.log('2. Set total_amount equal to invoiced_amount')
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...')
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Update po_value where it's null or 0
    console.log('\nUpdating po_value...')
    const { data: updatePoData, error: updatePoError } = await supabase
      .rpc('update_po_values', {
        sql_query: `
          UPDATE purchase_orders 
          SET po_value = committed_amount 
          WHERE (po_value IS NULL OR po_value = 0) 
          AND committed_amount IS NOT NULL
        `
      })
    
    if (updatePoError) {
      // If RPC doesn't exist, try direct update
      // Use RPC for column-to-column update
      const { error: directUpdateError } = await supabase.rpc('update_po_values_from_committed')
      
      if (directUpdateError) {
        console.error('Error updating po_value:', directUpdateError)
        return
      }
    }
    
    console.log('✓ Updated po_value')
    
    // Update total_amount to match invoiced_amount
    console.log('\nUpdating total_amount to match invoiced_amount...')
    // Use RPC for column-to-column update
    const { error: updateTotalError } = await supabase.rpc('update_total_from_invoiced')
    
    if (updateTotalError) {
      console.error('Error updating total_amount:', updateTotalError)
      return
    }
    
    console.log('✓ Updated total_amount')
    
    // Verify the results
    const { data: verifyData, error: verifyError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, po_value, committed_amount, total_amount, invoiced_amount')
      .limit(10)
    
    if (verifyError) {
      console.error('Error verifying results:', verifyError)
      return
    }
    
    console.log('\nSample of updated data:')
    console.table(verifyData?.map(po => ({
      po_number: po.po_number,
      po_value: po.po_value,
      committed_amount: po.committed_amount,
      total_amount: po.total_amount,
      invoiced_amount: po.invoiced_amount
    })))
    
    console.log('\n✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
fixPoValues()