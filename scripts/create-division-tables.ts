#!/usr/bin/env tsx

/**
 * Create Division Tables
 * 
 * This script creates the multi-division support tables
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const { Client } = pg

// Database connection
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

async function createTables() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔄 Connecting to database...')
    await client.connect()
    console.log('✅ Connected!\n')

    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20250121_multi_division_support.sql')
    const sql = readFileSync(migrationPath, 'utf8')

    // Split into individual statements and filter out comments
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Extract table/index name for logging
      let objectName = 'Statement ' + (i + 1)
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)
        if (match) objectName = `Table: ${match[1]}`
      } else if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+)/i)
        if (match) objectName = `Index: ${match[1]}`
      } else if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ALTER TABLE (\w+)/i)
        if (match) objectName = `Alter: ${match[1]}`
      }

      try {
        await client.query(statement)
        console.log(`✅ ${objectName}`)
        successCount++
      } catch (error: any) {
        if (error.code === '42P07' || error.code === '42710') {
          // Table or index already exists
          console.log(`⏭️  ${objectName} (already exists)`)
          skipCount++
        } else if (error.code === '42701') {
          // Column already exists
          console.log(`⏭️  ${objectName} (column already exists)`)
          skipCount++
        } else {
          console.error(`❌ ${objectName}: ${error.message}`)
          errorCount++
        }
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ⏭️  Skipped: ${skipCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

    // Verify tables were created
    console.log('\n🔍 Verifying created tables:')
    const tables = [
      'project_divisions',
      'division_budgets',
      'division_forecasts',
      'division_discipline_mapping',
      'craft_type_divisions'
    ]

    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      const exists = result.rows[0].exists
      console.log(`   ${exists ? '✅' : '❌'} ${table}`)
    }

    // Check if columns were added to existing tables
    console.log('\n🔍 Checking division_id columns:')
    const tablesToCheck = [
      'purchase_orders',
      'change_orders',
      'labor_actuals',
      'invoices'
    ]

    for (const table of tablesToCheck) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name = 'division_id'
        )
      `, [table])
      
      const exists = result.rows[0].exists
      console.log(`   ${exists ? '✅' : '❌'} ${table}.division_id`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

// Run the script
createTables()
  .then(() => {
    console.log('\n✅ Table creation complete!')
    console.log('\nNext steps:')
    console.log('1. Run RLS policies: npx tsx scripts/apply-rls-policies.ts')
    console.log('2. Run data migration: npx tsx scripts/execute-data-migration.ts')
  })
  .catch(console.error)