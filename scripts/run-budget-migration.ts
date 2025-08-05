#!/usr/bin/env tsx
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Use environment variable for NODE_TLS_REJECT_UNAUTHORIZED
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const connectionString = `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

const pool = new Pool({
  connectionString,
  ssl: true
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Starting budget schema migration...')
    
    // Check current column structure
    const checkQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'budget_line_items'
      AND column_name LIKE '%cost%'
      ORDER BY ordinal_position
    `
    
    const currentColumns = await client.query(checkQuery)
    console.log('\n📊 Current cost columns in budget_line_items:')
    currentColumns.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    // Check if we need to run the migration
    const hasOldColumns = currentColumns.rows.some(row => 
      ['labor_cost', 'material_cost', 'equipment_cost', 'subcontract_cost', 'other_cost'].includes(row.column_name)
    )
    
    const hasNewColumns = currentColumns.rows.some(row => 
      ['labor_direct_cost', 'labor_indirect_cost', 'labor_staff_cost'].includes(row.column_name)
    )
    
    if (!hasOldColumns && hasNewColumns) {
      console.log('\n✅ Migration already applied - schema is up to date!')
      return
    }
    
    // Read and run migration
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250805_update_budget_schema_for_7_categories.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    
    // Split migration into individual statements
    const statements = migrationSql
      .split(/;(?=\s*(?:--|$|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|COMMENT))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`\n📋 Running ${statements.length} migration statements...`)
    
    // Start transaction
    await client.query('BEGIN')
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement.trim()) continue
      
      try {
        console.log(`\n📝 Statement ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`)
        await client.query(statement)
        console.log(`   ✅ Success`)
      } catch (err: any) {
        // Some errors are expected (e.g., dropping columns that don't exist)
        if (err.message.includes('does not exist') || err.message.includes('already exists')) {
          console.log(`   ⚠️  Warning: ${err.message} (continuing...)`)
        } else {
          console.error(`   ❌ Error: ${err.message}`)
          throw err
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT')
    
    // Verify migration
    const verifyColumns = await client.query(checkQuery)
    console.log('\n📊 Updated cost columns in budget_line_items:')
    verifyColumns.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    console.log('\n🎉 Migration completed successfully!')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})