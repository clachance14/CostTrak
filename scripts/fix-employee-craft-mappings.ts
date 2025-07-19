#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function fixEmployeeCraftMappings() {
  const supabase = createAdminClient()
  
  try {
    console.log('Fixing employee craft type mappings...\n')
    
    // First, get the default craft types for each category
    const { data: craftTypes, error: craftError } = await supabase
      .from('craft_types')
      .select('id, code, category')
      .in('code', ['DIRECT', 'INDIRECT', 'STAFF'])
    
    if (craftError || !craftTypes || craftTypes.length !== 3) {
      console.error('Error fetching default craft types:', craftError)
      console.error('Make sure DIRECT, INDIRECT, and STAFF craft types exist')
      return
    }
    
    // Create a map of category to craft type ID
    const categoryToCraftTypeId: Record<string, string> = {}
    craftTypes.forEach(ct => {
      categoryToCraftTypeId[ct.category] = ct.id
    })
    
    console.log('Default craft types found:')
    Object.entries(categoryToCraftTypeId).forEach(([category, id]) => {
      const craftType = craftTypes.find(ct => ct.id === id)
      console.log(`  ${category}: ${craftType?.code} (ID: ${id})`)
    })
    console.log()
    
    // Get all employees with mismatched craft types
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        employee_number,
        first_name,
        last_name,
        category,
        craft_type_id,
        craft_types (
          code,
          category
        )
      `)
      .eq('is_active', true)
    
    if (empError) {
      console.error('Error fetching employees:', empError)
      return
    }
    
    let updated = 0
    let skipped = 0
    
    for (const employee of employees || []) {
      const craftType = employee.craft_types as any
      const employeeCategory = employee.category.toLowerCase()
      
      // Check if the employee's craft type category matches their category
      if (craftType?.category !== employeeCategory) {
        // Update to the correct default craft type
        const correctCraftTypeId = categoryToCraftTypeId[employeeCategory]
        
        if (correctCraftTypeId) {
          const { error: updateError } = await supabase
            .from('employees')
            .update({ 
              craft_type_id: correctCraftTypeId,
              updated_at: new Date().toISOString()
            })
            .eq('id', employee.id)
          
          if (updateError) {
            console.error(`Failed to update ${employee.employee_number}:`, updateError)
          } else {
            console.log(`✅ Updated ${employee.employee_number} (${employee.first_name} ${employee.last_name}) from ${craftType?.code || 'NONE'} to ${employeeCategory.toUpperCase()}`)
            updated++
          }
        } else {
          console.error(`❌ No default craft type found for category: ${employeeCategory}`)
          skipped++
        }
      } else {
        skipped++
      }
    }
    
    console.log(`\n🎉 Finished updating employee craft type mappings!`)
    console.log(`   Updated: ${updated} employees`)
    console.log(`   Skipped: ${skipped} employees (already correct)`)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

fixEmployeeCraftMappings()