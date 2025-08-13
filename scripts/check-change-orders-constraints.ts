#!/usr/bin/env tsx
/**
 * Check change orders table structure and constraints
 */

import pg from 'pg'

const { Client } = pg

// Use the connection URL from CLAUDE.md
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

async function checkConstraints() {
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

    // Check table columns
    console.log('📊 Change orders table columns:')
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'change_orders'
      ORDER BY ordinal_position;
    `)
    
    console.log('Columns:')
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`)
    })

    // Check foreign key constraints
    console.log('\n\n📊 Foreign key constraints on change_orders:')
    const constraintsResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'change_orders';
    `)
    
    console.log('\nForeign keys:')
    constraintsResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name}:`)
      console.log(`    ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`)
    })

    // Check a sample change order with user data
    console.log('\n\n📊 Sample change order with user data:')
    const sampleResult = await client.query(`
      SELECT 
        co.id,
        co.co_number,
        co.created_by,
        p.id as profile_id,
        p.first_name,
        p.last_name,
        p.email
      FROM change_orders co
      LEFT JOIN profiles p ON p.id = co.created_by
      WHERE co.project_id = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
      LIMIT 1;
    `)
    
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0]
      console.log('Change order:')
      console.log(`  CO Number: ${row.co_number}`)
      console.log(`  Created By ID: ${row.created_by}`)
      console.log(`  Profile ID: ${row.profile_id}`)
      console.log(`  User Name: ${row.first_name} ${row.last_name}`)
      console.log(`  Email: ${row.email}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run the check
checkConstraints().catch(console.error)