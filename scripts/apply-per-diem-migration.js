const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Applying per diem migration to remote database...')
  console.log(`📍 Database: ${supabaseUrl}`)
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250812_add_per_diem_support.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    
    // Execute the entire migration as one transaction
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })
    
    if (error) {
      // If the RPC doesn't exist, we'll need to apply it differently
      console.log('⚠️  exec_sql RPC not available, applying migration via Supabase Dashboard')
      console.log('\n📋 Please copy the following SQL and run it in the Supabase SQL Editor:')
      console.log('=' .repeat(60))
      console.log(migrationSQL)
      console.log('=' .repeat(60))
      return
    }
    
    console.log('✅ Migration applied successfully!')
    
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    process.exit(1)
  }
}

// Run the migration
runMigration().catch(console.error)