#!/usr/bin/env tsx
/**
 * Check all RLS policies that might reference project_divisions
 */

import pg from 'pg'

const { Client } = pg

// Use the connection URL from CLAUDE.md
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'

async function checkPolicies() {
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

    // Check all policies that might reference project_divisions
    console.log('📊 Checking all RLS policies for project_divisions references:\n')
    
    const tables = ['projects', 'change_orders', 'purchase_orders', 'budget_line_items', 'labor_headcount_forecasts', 'labor_employee_actuals']
    
    for (const table of tables) {
      console.log(`\n📋 Policies on ${table}:`)
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
        WHERE pol.polrelid = '${table}'::regclass;
      `)
      
      if (policiesResult.rows.length > 0) {
        policiesResult.rows.forEach(row => {
          console.log(`  - ${row.policy_name} (${row.command})`)
          if (row.using_expression) {
            console.log(`    USING: ${row.using_expression}`)
            if (row.using_expression.includes('project_divisions')) {
              console.log('    ⚠️  REFERENCES project_divisions!')
            }
          }
          if (row.with_check_expression) {
            console.log(`    CHECK: ${row.with_check_expression}`)
            if (row.with_check_expression.includes('project_divisions')) {
              console.log('    ⚠️  REFERENCES project_divisions!')
            }
          }
        })
      } else {
        console.log('  No policies found')
      }
    }

    // Check for functions that might reference project_divisions
    console.log('\n\n📊 Checking functions for project_divisions references:')
    const functionsResult = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE prosrc LIKE '%project_divisions%'
      LIMIT 10;
    `)
    
    if (functionsResult.rows.length > 0) {
      console.log('⚠️  Found functions referencing project_divisions:')
      functionsResult.rows.forEach(row => {
        console.log(`  - ${row.proname}`)
      })
    } else {
      console.log('✅ No functions found referencing project_divisions')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run the check
checkPolicies().catch(console.error)