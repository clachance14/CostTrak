#!/usr/bin/env node

/**
 * Apply a specific migration to Supabase database
 * Usage: node scripts/apply-migration.js <migration-file>
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not set in .env.local`)
    process.exit(1)
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration.js <migration-file>')
  console.error('Example: node scripts/apply-migration.js 00012_fix_user_role_type.sql')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function applyMigration() {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile)
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`)
    process.exit(1)
  }
  
  console.log(`Applying migration: ${migrationFile}`)
  
  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('\n=== IMPORTANT ===')
  console.log('Supabase JavaScript client does not support direct SQL execution.')
  console.log('You need to apply this migration using one of these methods:\n')
  
  console.log('1. Supabase Dashboard (Recommended):')
  console.log('   - Go to your Supabase project dashboard')
  console.log('   - Navigate to SQL Editor')
  console.log('   - Copy and paste the migration SQL')
  console.log('   - Click "Run"\n')
  
  console.log('2. Supabase CLI:')
  console.log('   - Install Supabase CLI: npm install -g supabase')
  console.log('   - Link your project: supabase link --project-ref YOUR_PROJECT_REF')
  console.log('   - Run: supabase db push\n')
  
  console.log('3. Direct PostgreSQL connection:')
  console.log('   - Get connection string from Supabase dashboard')
  console.log('   - Use psql or another PostgreSQL client\n')
  
  console.log('=== Migration SQL to apply ===\n')
  console.log(sqlContent)
  
  // Save to a temporary file for easy copying
  const tempFile = path.join(__dirname, 'temp-migration.sql')
  fs.writeFileSync(tempFile, sqlContent)
  console.log(`\nMigration SQL saved to: ${tempFile}`)
  console.log('You can copy this file content to run in Supabase SQL Editor')
}

applyMigration().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})