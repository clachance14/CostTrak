#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function checkEmployeeCraftMapping() {
  const supabase = createAdminClient()
  
  try {
    console.log('Checking employee craft type mappings...\n')
    
    // Get employees with craft type details
    const { data: employees, error } = await supabase
      .from('employees')
      .select(`
        employee_number,
        first_name,
        last_name,
        category,
        craft_type_id,
        craft_types (
          id,
          code,
          name,
          category
        )
      `)
      .eq('is_active', true)
      .limit(20)
    
    if (error) {
      console.error('Error fetching employees:', error)
      return
    }
    
    console.log(`Sample of ${employees?.length} employees:\n`)
    
    employees?.forEach(emp => {
      const craftType = emp.craft_types as any
      console.log(`${emp.employee_number} - ${emp.first_name} ${emp.last_name}`)
      console.log(`  Employee Category: ${emp.category}`)
      console.log(`  Craft Type: ${craftType?.code || 'NONE'} (${craftType?.name || 'N/A'})`)
      console.log(`  Craft Category: ${craftType?.category || 'N/A'}`)
      console.log(`  Match: ${emp.category.toLowerCase() === craftType?.category ? '✅' : '❌'}\n`)
    })
    
    // Count mismatches
    const { data: allEmployees, error: allError } = await supabase
      .from('employees')
      .select(`
        category,
        craft_types (
          category
        )
      `)
      .eq('is_active', true)
    
    if (!allError && allEmployees) {
      let matches = 0
      let mismatches = 0
      
      allEmployees.forEach(emp => {
        const craftType = emp.craft_types as any
        if (craftType && emp.category.toLowerCase() === craftType.category) {
          matches++
        } else {
          mismatches++
        }
      })
      
      console.log('\nSummary:')
      console.log(`Total active employees: ${allEmployees.length}`)
      console.log(`Matching categories: ${matches}`)
      console.log(`Mismatched categories: ${mismatches}`)
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkEmployeeCraftMapping()