#!/usr/bin/env tsx
/**
 * Apply the simplification migration directly using pg client
 */

import pg from 'pg'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Client } = pg

// Use the connection URL from .env.local
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected successfully\n')

    // First, check current state
    console.log('📊 Current database state:')
    const tablesResult = await client.query(`
      SELECT count(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `)
    console.log(`   Tables before migration: ${tablesResult.rows[0].table_count}`)

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250131_complete_simplification.sql')
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')
    console.log(`\n📄 Migration loaded: ${migrationSQL.length} characters`)

    // Split migration into individual statements
    // Remove comments and split by semicolons
    const statements = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(/;\s*$/m)
      .filter(stmt => stmt.trim())

    console.log(`\n🔄 Executing ${statements.length} statements...\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (!statement) continue

      // Get first few words for logging
      const preview = statement.substring(0, 60).replace(/\n/g, ' ')
      
      try {
        await client.query(statement)
        successCount++
        
        // Log important operations
        if (statement.includes('DROP TABLE') || 
            statement.includes('CREATE POLICY') ||
            statement.includes('ALTER TABLE')) {
          console.log(`✅ ${preview}...`)
        }
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          skipCount++
          // Only log if verbose
          if (process.argv.includes('--verbose')) {
            console.log(`⚠️  Skipped (already dropped): ${preview}...`)
          }
        } else {
          errorCount++
          console.error(`❌ Error: ${error.message}`)
          console.error(`   Statement: ${preview}...`)
        }
      }
    }

    console.log(`\n📈 Migration Summary:`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ⚠️  Skipped: ${skipCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

    // Check final state
    const finalTablesResult = await client.query(`
      SELECT count(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `)
    console.log(`\n📊 Final database state:`)
    console.log(`   Tables after migration: ${finalTablesResult.rows[0].table_count}`)

    // List core tables
    const coreTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'profiles', 'projects', 'employees', 'craft_types',
        'purchase_orders', 'po_line_items', 'labor_actuals',
        'labor_employee_actuals', 'budget_line_items', 'data_imports',
        'change_orders', 'audit_log'
      )
      ORDER BY table_name
    `)

    console.log('\n✅ Core tables preserved:')
    coreTablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`)
    })

    // Check if we need to run the special DO block for RLS policies
    const doBlockMatch = migrationSQL.match(/DO \$\$[\s\S]*?\$\$/g)
    if (doBlockMatch) {
      console.log('\n🔒 Cleaning up RLS policies...')
      for (const doBlock of doBlockMatch) {
        try {
          await client.query(doBlock)
          console.log('✅ RLS policies cleaned up')
        } catch (error: any) {
          console.error('❌ Error cleaning RLS policies:', error.message)
        }
      }
    }

    console.log('\n✨ Migration completed!')
    console.log('\n📝 Next steps:')
    console.log('   1. Run: pnpm generate-types')
    console.log('   2. Test all three import workflows')
    console.log('   3. Remove UI components for dropped features')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
    console.log('\n🔌 Disconnected from database')
  }
}

// Run the migration
console.log('🚀 CostTrak Database Simplification')
console.log('===================================\n')
runMigration().catch(console.error)