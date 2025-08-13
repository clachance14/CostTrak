#!/usr/bin/env tsx
/**
 * Apply the change orders RLS fix migration directly
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

    // Check current policies on change_orders
    console.log('📊 Current RLS policies on change_orders:')
    const policiesResult = await client.query(`
      SELECT 
        pol.polname as policy_name,
        CASE pol.polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END as command,
        pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
        pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
      FROM pg_policy pol
      WHERE pol.polrelid = 'change_orders'::regclass;
    `)
    
    if (policiesResult.rows.length > 0) {
      console.log('Found policies:')
      policiesResult.rows.forEach(row => {
        console.log(`  - ${row.policy_name} (${row.command})`)
        if (row.using_expression) console.log(`    USING: ${row.using_expression}`)
        if (row.with_check_expression) console.log(`    CHECK: ${row.with_check_expression}`)
      })
    } else {
      console.log('  No policies found')
    }

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250805_fix_change_orders_rls_policies.sql')
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')
    console.log(`\n📄 Migration loaded: ${migrationSQL.length} characters`)

    // Apply migration
    console.log('\n🚀 Applying migration...')
    await client.query(migrationSQL)
    console.log('✅ Migration applied successfully')

    // Verify new policies
    console.log('\n📊 New RLS policies on change_orders:')
    const newPoliciesResult = await client.query(`
      SELECT 
        pol.polname as policy_name,
        CASE pol.polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END as command
      FROM pg_policy pol
      WHERE pol.polrelid = 'change_orders'::regclass;
    `)
    
    newPoliciesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.policy_name} (${row.command})`)
    })

    console.log('\n✨ RLS policies fixed successfully!')
    console.log('You should now be able to create change orders without the project_divisions error.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run the migration
runMigration().catch(console.error)