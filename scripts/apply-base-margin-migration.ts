#!/usr/bin/env tsx
/**
 * Apply base_margin_percentage migration to the database
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('🔄 Applying base_margin_percentage migration...')
  console.log('=' .repeat(60))
  
  try {
    // Check if column already exists
    const { data: columns, error: checkError } = await supabase
      .rpc('get_table_columns', { 
        table_name: 'projects',
        schema_name: 'public' 
      })
      .select('*')
    
    // If the RPC doesn't exist, just proceed with migration
    if (checkError && !checkError.message.includes('function') ) {
      console.error('Error checking columns:', checkError)
    }
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250812_add_base_margin_to_projects.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    
    console.log('📄 Migration SQL:')
    console.log(migrationSQL)
    console.log('\n' + '=' .repeat(60))
    
    // Execute the migration
    console.log('⚡ Executing migration...')
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.includes('ALTER TABLE') || statement.includes('UPDATE') || statement.includes('COMMENT ON')) {
        console.log(`\n🔧 Executing: ${statement.substring(0, 50)}...`)
        
        // Use raw SQL execution through Supabase
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        }).single()
        
        if (error) {
          // If the function doesn't exist, try a different approach
          if (error.message.includes('function')) {
            console.log('⚠️  Direct SQL execution not available, attempting alternative...')
            
            // For the ALTER TABLE statement, we'll check if it works through a test query
            if (statement.includes('ALTER TABLE')) {
              // Try to query with the new column to see if it exists
              const { error: testError } = await supabase
                .from('projects')
                .select('base_margin_percentage')
                .limit(1)
              
              if (!testError) {
                console.log('✅ Column already exists!')
              } else if (testError.message.includes('column')) {
                console.log('❌ Column does not exist. Manual migration required.')
                console.log('\n📋 Please run this SQL in your Supabase dashboard:')
                console.log('=' .repeat(60))
                console.log(migrationSQL)
                console.log('=' .repeat(60))
                return false
              }
            }
          } else {
            console.error('❌ Error:', error.message)
          }
        } else {
          console.log('✅ Statement executed successfully')
        }
      }
    }
    
    // Verify the migration worked
    console.log('\n🔍 Verifying migration...')
    const { data: testProject, error: testError } = await supabase
      .from('projects')
      .select('id, name, base_margin_percentage')
      .limit(1)
      .single()
    
    if (testError) {
      if (testError.message.includes('base_margin_percentage')) {
        console.error('❌ Migration failed - column still does not exist')
        console.log('\n📋 Please manually run this SQL in your Supabase SQL Editor:')
        console.log('=' .repeat(60))
        console.log(migrationSQL)
        console.log('=' .repeat(60))
        console.log('\nGo to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
        return false
      }
    } else {
      console.log('✅ Migration successful!')
      console.log(`   Sample project: ${testProject?.name}`)
      console.log(`   Base margin: ${testProject?.base_margin_percentage || 15}%`)
      return true
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error)
    console.log('\n📋 Please manually run this SQL in your Supabase SQL Editor:')
    console.log('=' .repeat(60))
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250812_add_base_margin_to_projects.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    console.log(migrationSQL)
    console.log('=' .repeat(60))
    console.log('\nGo to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
    return false
  }
}

async function main() {
  console.log('🚀 Base Margin Migration Tool')
  console.log('=' .repeat(60))
  
  const success = await applyMigration()
  
  if (success) {
    console.log('\n✅ Migration completed successfully!')
    console.log('The dashboard should now work correctly.')
  } else {
    console.log('\n⚠️  Manual intervention required')
    console.log('Please apply the migration SQL manually in Supabase.')
  }
}

main().catch(console.error)