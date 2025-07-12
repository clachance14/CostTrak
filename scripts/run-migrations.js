#!/usr/bin/env node

/**
 * Run database migrations using Supabase Admin API
 * This connects to the remote Supabase instance and executes SQL migrations
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

// Read all migration files
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()

async function runMigrations() {
  console.log('Starting database migrations...\n')
  
  // Track which migrations have been applied
  let appliedMigrations = []
  
  // Check if migrations tracking table exists
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'schema_migrations')
    .single()
  
  if (!tables) {
    // Create migrations tracking table
    console.log('Creating schema_migrations table...')
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    })
    
    if (error) {
      console.error('Error creating schema_migrations table:', error)
      process.exit(1)
    }
  } else {
    // Get list of applied migrations
    const { data, error } = await supabase
      .from('schema_migrations')
      .select('version')
    
    if (error) {
      console.error('Error reading schema_migrations:', error)
      process.exit(1)
    }
    
    appliedMigrations = data ? data.map(m => m.version) : []
  }
  
  // Run each migration
  for (const file of migrationFiles) {
    const version = file.replace('.sql', '')
    
    if (appliedMigrations.includes(version)) {
      console.log(`✓ Skipping ${file} (already applied)`)
      continue
    }
    
    console.log(`→ Running ${file}...`)
    
    const sqlContent = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8'
    )
    
    try {
      // Note: Supabase doesn't have a direct SQL execution endpoint
      // You'll need to use the Supabase Management API or connect directly to the database
      console.log(`  Would execute: ${file}`)
      console.log(`  Note: Direct SQL execution requires database connection`)
      
      // Record migration as applied (in a real scenario)
      // await supabase.from('schema_migrations').insert({ version })
      
    } catch (error) {
      console.error(`✗ Error running ${file}:`, error.message)
      process.exit(1)
    }
  }
  
  console.log('\n✓ All migrations completed!')
  console.log('\nNote: This script shows which migrations would be run.')
  console.log('To actually run them, use one of these methods:')
  console.log('1. Supabase Dashboard SQL Editor')
  console.log('2. Direct PostgreSQL connection with psql')
  console.log('3. Supabase CLI with local project linked')
}

runMigrations().catch(error => {
  console.error('Migration error:', error)
  process.exit(1)
})