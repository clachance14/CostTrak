#!/usr/bin/env node
import { createAdminClient } from '../lib/supabase/admin'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function createDefaultCraftTypes() {
  const supabase = createAdminClient()
  
  try {
    console.log('Creating default craft types for each category...\n')
    
    const defaultCraftTypes = [
      {
        code: 'DIRECT',
        name: 'Direct Labor',
        category: 'direct' as const,
        description: 'Default craft type for direct labor employees'
      },
      {
        code: 'INDIRECT',
        name: 'Indirect Labor',
        category: 'indirect' as const,
        description: 'Default craft type for indirect labor employees'
      },
      {
        code: 'STAFF',
        name: 'Staff',
        category: 'staff' as const,
        description: 'Default craft type for staff employees'
      }
    ]
    
    for (const craftType of defaultCraftTypes) {
      // Check if it already exists
      const { data: existing, error: checkError } = await supabase
        .from('craft_types')
        .select('id, category')
        .eq('code', craftType.code)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`Error checking ${craftType.code}:`, checkError)
        continue
      }
      
      if (existing) {
        // Update category if it's wrong
        if (existing.category !== craftType.category) {
          const { error: updateError } = await supabase
            .from('craft_types')
            .update({ 
              category: craftType.category,
              name: craftType.name 
            })
            .eq('id', existing.id)
          
          if (updateError) {
            console.error(`❌ Failed to update ${craftType.code}:`, updateError)
          } else {
            console.log(`✅ Updated ${craftType.code} category from ${existing.category} to ${craftType.category}`)
          }
        } else {
          console.log(`✓ ${craftType.code} already exists with correct category`)
        }
      } else {
        // Create new craft type
        const { error: createError } = await supabase
          .from('craft_types')
          .insert({
            code: craftType.code,
            name: craftType.name,
            category: craftType.category,
            is_active: true
          })
        
        if (createError) {
          console.error(`❌ Failed to create ${craftType.code}:`, createError)
        } else {
          console.log(`✅ Created ${craftType.code} craft type`)
        }
      }
    }
    
    console.log('\n🎉 Default craft types have been set up!')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

createDefaultCraftTypes()