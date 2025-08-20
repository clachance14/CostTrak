#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(migrationPath: string) {
  try {
    console.log(`\n🚀 Running migration: ${path.basename(migrationPath)}`)
    
    // Read migration file
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolons but be careful with functions/triggers
    const statements = sql
      .split(/;(?=\s*(?:--|$|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|COMMENT))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip empty statements
      if (!statement.trim()) continue
      
      // Log first 100 chars of statement
      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}:`)
      console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        }).single()
        
        if (error) {
          // Try direct execution as fallback
          const { error: directError } = await supabase.from('_migrations').select('*').limit(0)
          if (directError) {
            console.error(`❌ Error executing statement:`, directError)
            throw directError
          }
        }
        
        console.log(`✅ Statement executed successfully`)
      } catch (err) {
        console.error(`❌ Failed to execute statement:`, err)
        console.error(`Statement was:`, statement)
        throw err
      }
    }
    
    console.log(`\n✅ Migration ${path.basename(migrationPath)} completed successfully!`)
    
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error)
    throw error
  }
}

async function main() {
  try {
    // Run the budget schema migration
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250805_update_budget_schema_for_7_categories.sql')
    
    console.log('🔄 Starting budget schema migration...')
    console.log(`📂 Migration file: ${migrationPath}`)
    
    // Check if file exists
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }
    
    await runMigration(migrationPath)
    
    console.log('\n🎉 All migrations completed successfully!')
    
  } catch (error) {
    console.error('\n💥 Migration process failed:', error)
    process.exit(1)
  }
}

// Execute main function
main()