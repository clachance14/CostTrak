#!/usr/bin/env tsx
/**
 * Check change orders in the database
 */

import pg from 'pg'

const { Client } = pg

// Use the connection URL from CLAUDE.md
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

async function checkChangeOrders() {
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

    // Check all change orders
    console.log('📊 All change orders in the database:')
    const allCOs = await client.query(`
      SELECT 
        co.id,
        co.co_number,
        co.project_id,
        co.status,
        co.amount,
        co.deleted_at,
        co.created_at,
        p.job_number,
        p.name as project_name
      FROM change_orders co
      LEFT JOIN projects p ON p.id = co.project_id
      ORDER BY co.created_at DESC
      LIMIT 10
    `)
    
    if (allCOs.rows.length > 0) {
      console.log(`Found ${allCOs.rows.length} change orders:`)
      allCOs.rows.forEach(row => {
        console.log(`\n  CO: ${row.co_number}`)
        console.log(`  Project: ${row.job_number} - ${row.project_name}`)
        console.log(`  Project ID: ${row.project_id}`)
        console.log(`  Status: ${row.status}`)
        console.log(`  Amount: $${row.amount}`)
        console.log(`  Deleted: ${row.deleted_at ? 'YES' : 'NO'}`)
        console.log(`  Created: ${row.created_at}`)
      })
    } else {
      console.log('No change orders found')
    }

    // Check for soft deleted change orders
    console.log('\n\n📊 Checking for soft-deleted change orders:')
    const deletedCOs = await client.query(`
      SELECT count(*) as count
      FROM change_orders
      WHERE deleted_at IS NOT NULL
    `)
    console.log(`Soft-deleted change orders: ${deletedCOs.rows[0].count}`)

    // Check specific project
    const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
    console.log(`\n\n📊 Change orders for project ${projectId}:`)
    const projectCOs = await client.query(`
      SELECT 
        co.*,
        p.job_number,
        p.name as project_name
      FROM change_orders co
      LEFT JOIN projects p ON p.id = co.project_id
      WHERE co.project_id = $1
      ORDER BY co.created_at DESC
    `, [projectId])
    
    if (projectCOs.rows.length > 0) {
      console.log(`Found ${projectCOs.rows.length} change orders for this project`)
      projectCOs.rows.forEach(row => {
        console.log(`\n  CO: ${row.co_number}`)
        console.log(`  Status: ${row.status}`)
        console.log(`  Amount: $${row.amount}`)
        console.log(`  Deleted: ${row.deleted_at ? 'YES' : 'NO'}`)
      })
    } else {
      console.log('No change orders found for this project')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run the check
checkChangeOrders().catch(console.error)