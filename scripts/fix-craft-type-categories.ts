#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function fixCraftTypeCategories() {
  const supabase = createAdminClient()
  
  try {
    console.log('Analyzing craft type categories based on employee data...\n')
    
    // Get all craft types
    const { data: craftTypes, error: craftError } = await supabase
      .from('craft_types')
      .select('*')
      .order('code')
    
    if (craftError) {
      console.error('Error fetching craft types:', craftError)
      return
    }
    
    console.log(`Found ${craftTypes?.length || 0} craft types`)
    
    // Get all employees with their categories
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('craft_type_id, category, is_active')
      .eq('is_active', true)
    
    if (empError) {
      console.error('Error fetching employees:', empError)
      return
    }
    
    // Count employees by craft type and category
    const craftCategoryCounts = new Map<string, { direct: number; indirect: number; staff: number }>()
    
    employees?.forEach(emp => {
      if (!emp.craft_type_id) return
      
      if (!craftCategoryCounts.has(emp.craft_type_id)) {
        craftCategoryCounts.set(emp.craft_type_id, { direct: 0, indirect: 0, staff: 0 })
      }
      
      const counts = craftCategoryCounts.get(emp.craft_type_id)!
      const category = emp.category.toLowerCase() as 'direct' | 'indirect' | 'staff'
      counts[category]++
    })
    
    // Analyze and update craft types
    const updates: Array<{ id: string; code: string; name: string; oldCategory: string; newCategory: string }> = []
    
    for (const craftType of craftTypes || []) {
      const counts = craftCategoryCounts.get(craftType.id) || { direct: 0, indirect: 0, staff: 0 }
      const totalEmployees = counts.direct + counts.indirect + counts.staff
      
      if (totalEmployees === 0) {
        console.log(`${craftType.code}: No active employees, keeping as ${craftType.category}`)
        continue
      }
      
      // Determine the majority category
      let newCategory: 'direct' | 'indirect' | 'staff' = 'direct'
      
      if (counts.indirect > counts.direct && counts.indirect > counts.staff) {
        newCategory = 'indirect'
      } else if (counts.staff > counts.direct && counts.staff > counts.indirect) {
        newCategory = 'staff'
      }
      
      console.log(`${craftType.code}: ${counts.direct} direct, ${counts.indirect} indirect, ${counts.staff} staff → ${newCategory}`)
      
      if (craftType.category !== newCategory) {
        updates.push({
          id: craftType.id,
          code: craftType.code,
          name: craftType.name,
          oldCategory: craftType.category,
          newCategory
        })
      }
    }
    
    if (updates.length === 0) {
      console.log('\n✅ All craft types already have correct categories!')
      return
    }
    
    console.log(`\n🔄 Need to update ${updates.length} craft types:`)
    updates.forEach(u => {
      console.log(`  - ${u.code} (${u.name}): ${u.oldCategory} → ${u.newCategory}`)
    })
    
    // Ask for confirmation
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to apply updates...')
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Apply updates
    for (const update of updates) {
      const { error } = await supabase
        .from('craft_types')
        .update({ category: update.newCategory })
        .eq('id', update.id)
      
      if (error) {
        console.error(`❌ Failed to update ${update.code}:`, error)
      } else {
        console.log(`✅ Updated ${update.code} to ${update.newCategory}`)
      }
    }
    
    console.log('\n🎉 Craft type categories have been updated!')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

fixCraftTypeCategories()