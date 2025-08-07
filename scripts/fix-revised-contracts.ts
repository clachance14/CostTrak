#!/usr/bin/env tsx
/**
 * Script to fix incorrect revised_contract values in the database
 * This ensures revised_contract = original_contract + sum(approved_change_orders)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRevisedContracts() {
  try {
    console.log('Starting to fix revised contract values...')
    
    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, job_number, name, original_contract, revised_contract')
      .order('job_number')
    
    if (projectsError) {
      throw projectsError
    }
    
    if (!projects || projects.length === 0) {
      console.log('No projects found')
      return
    }
    
    console.log(`Found ${projects.length} projects to check`)
    
    let fixedCount = 0
    
    for (const project of projects) {
      // Get all approved change orders for this project
      const { data: changeOrders, error: coError } = await supabase
        .from('change_orders')
        .select('amount')
        .eq('project_id', project.id)
        .eq('status', 'approved')
      
      if (coError) {
        console.error(`Error fetching change orders for project ${project.job_number}:`, coError)
        continue
      }
      
      // Calculate what the revised contract should be
      const totalApprovedCOs = (changeOrders || []).reduce((sum, co) => sum + co.amount, 0)
      const correctRevisedContract = (project.original_contract || 0) + totalApprovedCOs
      
      // Check if it needs fixing
      if (project.revised_contract !== correctRevisedContract) {
        console.log(`\nProject ${project.job_number} - ${project.name}:`)
        console.log(`  Original Contract: $${project.original_contract?.toLocaleString() || 0}`)
        console.log(`  Current Revised Contract: $${project.revised_contract?.toLocaleString() || 0}`)
        console.log(`  Approved COs Total: $${totalApprovedCOs.toLocaleString()}`)
        console.log(`  Correct Revised Contract: $${correctRevisedContract.toLocaleString()}`)
        console.log(`  Fixing...`)
        
        // Update the project
        const { error: updateError } = await supabase
          .from('projects')
          .update({ revised_contract: correctRevisedContract })
          .eq('id', project.id)
        
        if (updateError) {
          console.error(`  Error updating project: ${updateError.message}`)
        } else {
          console.log(`  ✓ Fixed!`)
          fixedCount++
        }
      }
    }
    
    console.log(`\nCompleted! Fixed ${fixedCount} projects`)
    
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Run the script
fixRevisedContracts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })