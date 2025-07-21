#!/usr/bin/env tsx

/**
 * Check Database Tables
 * 
 * This script checks what tables actually exist in the database
 */

import pg from 'pg'

const { Client } = pg

// Database connection
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

async function checkTables() {
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

    // Check for division-related tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'project_divisions',
        'division_budgets',
        'division_forecasts',
        'division_discipline_mapping',
        'craft_type_divisions',
        'notification_triggers'
      )
      ORDER BY table_name
    `)

    console.log('📊 Division-related tables found:')
    if (result.rows.length === 0) {
      console.log('   ❌ No division tables found!')
      console.log('\n⚠️  The migration tables need to be created first.')
      console.log('\nPlease run the migration scripts in this order:')
      console.log('1. supabase/migrations/20250121_multi_division_support.sql')
      console.log('2. supabase/migrations/20250121_multi_division_rls_policies.sql')
      console.log('3. supabase/migrations/20250121_notification_triggers.sql')
    } else {
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`)
      })
    }

    // Check for existing tables
    console.log('\n📊 Checking existing project structure:')
    const projectCheck = await client.query(`
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name IN ('id', 'division_id', 'project_manager_id', 'original_contract_amount')
      ORDER BY column_name
    `)

    console.log('   Projects table columns:')
    projectCheck.rows.forEach(row => {
      console.log(`     • ${row.column_name} (${row.data_type})`)
    })

    // Check if POs have division_id
    const poCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name = 'division_id'
    `)

    console.log(`\n   Purchase orders division support: ${poCheck.rows.length > 0 ? '✅ Yes' : '❌ No'}`)

    // Check project count
    const projectCount = await client.query(`
      SELECT COUNT(*) as count
      FROM projects
      WHERE deleted_at IS NULL
    `)

    console.log(`\n📊 Data Summary:`)
    console.log(`   Active projects: ${projectCount.rows[0].count}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

// Run the check
checkTables()