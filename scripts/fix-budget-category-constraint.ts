#!/usr/bin/env tsx
import { Pool } from 'pg'
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

async function fixConstraint() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Fixing budget_line_items category constraint...')
    
    // Check current constraint
    const checkQuery = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'budget_line_items_category_check'
    `
    
    const currentConstraint = await client.query(checkQuery)
    if (currentConstraint.rows.length > 0) {
      console.log('\n📊 Current constraint:')
      console.log(currentConstraint.rows[0].definition)
    }
    
    console.log('\n📝 Dropping old constraint...')
    await client.query('ALTER TABLE public.budget_line_items DROP CONSTRAINT IF EXISTS budget_line_items_category_check')
    
    console.log('📝 Adding new constraint for LABOR/NON_LABOR...')
    await client.query(`
      ALTER TABLE public.budget_line_items 
      ADD CONSTRAINT budget_line_items_category_check 
      CHECK (category IN ('LABOR', 'NON_LABOR'))
    `)
    
    // Verify new constraint
    const verifyConstraint = await client.query(checkQuery)
    if (verifyConstraint.rows.length > 0) {
      console.log('\n✅ New constraint:')
      console.log(verifyConstraint.rows[0].definition)
    }
    
    console.log('\n🎉 Constraint fixed successfully!')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the fix
fixConstraint().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})