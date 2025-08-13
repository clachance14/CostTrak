#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Starting per diem migration...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250812_add_per_diem_support.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`\n▶️  Executing statement ${i + 1}/${statements.length}...`)
      
      // Show first 100 chars of the statement
      const preview = statement.substring(0, 100).replace(/\n/g, ' ')
      console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`)
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
      
      if (error) {
        // Try direct execution as fallback
        const { data, error: directError } = await supabase.from('_sql').select().single().eq('query', statement)
        
        if (directError) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message || directError.message)
          throw error || directError
        }
      }
      
      console.log(`   ✅ Statement ${i + 1} executed successfully`)
    }
    
    console.log('\n✅ Migration completed successfully!')
    
    // Test the new functionality
    console.log('\n🧪 Testing per diem functionality...')
    
    // Check if columns were added to projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect')
      .limit(1)
    
    if (projectsError) {
      console.error('❌ Failed to query projects with new columns:', projectsError)
    } else {
      console.log('✅ Projects table updated successfully')
      console.log('   Sample project:', projects?.[0])
    }
    
    // Check if per_diem_costs table was created
    const { count, error: costsError } = await supabase
      .from('per_diem_costs')
      .select('*', { count: 'exact', head: true })
    
    if (costsError) {
      console.error('❌ Failed to query per_diem_costs table:', costsError)
    } else {
      console.log('✅ per_diem_costs table created successfully')
      console.log(`   Current records: ${count || 0}`)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
runMigration().catch(console.error)