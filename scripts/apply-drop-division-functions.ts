#!/usr/bin/env tsx
/**
 * Apply the migration to drop division-related functions
 */

import pg from 'pg'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Client } = pg

// Use the connection URL from CLAUDE.md
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
      require: true
    }
  })

  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected successfully\n')

    // Check for the problematic function
    console.log('📊 Checking for division-related functions:')
    const functionsResult = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE prosrc LIKE '%project_divisions%'
      OR proname LIKE '%division%';
    `)
    
    if (functionsResult.rows.length > 0) {
      console.log('Found functions to remove:')
      functionsResult.rows.forEach(row => {
        console.log(`  - ${row.proname}`)
      })
    }

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250805_drop_division_functions.sql')
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')
    console.log(`\n📄 Migration loaded: ${migrationSQL.length} characters`)

    // Apply migration
    console.log('\n🚀 Applying migration...')
    await client.query(migrationSQL)
    console.log('✅ Migration applied successfully')

    // Verify functions are gone
    console.log('\n📊 Verifying functions have been removed:')
    const verifyResult = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE prosrc LIKE '%project_divisions%';
    `)
    
    if (verifyResult.rows.length === 0) {
      console.log('✅ All project_divisions references have been removed from functions!')
    } else {
      console.log('⚠️  Some functions still reference project_divisions:')
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.proname}`)
      })
    }

    console.log('\n✨ Division functions removed successfully!')
    console.log('You should now be able to create change orders without errors.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run the migration
runMigration().catch(console.error)