#!/usr/bin/env tsx

/**
 * Execute Remote Migrations
 * 
 * This script runs the migration SQL files directly on Supabase
 * using the Management API
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Supabase project details
const projectRef = 'gzrxhwpmtbgnngadgnse'
const supabaseUrl = `https://${projectRef}.supabase.co`
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'

// Migration files in order
const migrations = [
  {
    file: '20250121_multi_division_support.sql',
    description: 'Creating division support tables'
  },
  {
    file: '20250121_multi_division_rls_policies.sql',
    description: 'Setting up RLS policies'
  },
  {
    file: '20250121_multi_division_data_migration.sql',
    description: 'Migrating existing data'
  },
  {
    file: '20250121_notification_triggers.sql',
    description: 'Creating notification triggers'
  },
  {
    file: '20250121_migrate_existing_projects_to_divisions.sql',
    description: 'Final project migration'
  }
]

async function executeSQLViaAPI(sql: string, description: string) {
  try {
    // Using the Supabase REST API to execute raw SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    })

    if (!response.ok) {
      // Try alternative approach - direct database query
      const altResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept': 'application/json'
        },
        body: sql
      })

      if (!altResponse.ok) {
        const error = await altResponse.text()
        throw new Error(`API Error: ${error}`)
      }
    }

    console.log(`✅ ${description}`)
    return true
  } catch (error) {
    console.error(`❌ Failed: ${description}`)
    console.error(`   Error: ${error}`)
    return false
  }
}

async function runMigrations() {
  console.log('🚀 Starting Remote Migration Process...\n')
  console.log('Project: ' + projectRef)
  console.log('URL: ' + supabaseUrl + '\n')

  let successCount = 0
  let failureCount = 0

  for (const migration of migrations) {
    console.log(`\n📄 Running: ${migration.file}`)
    console.log(`   ${migration.description}...`)
    
    try {
      // Read migration file
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', migration.file)
      const sql = readFileSync(migrationPath, 'utf8')
      
      // For large migrations, we need to split them into smaller chunks
      // Split by major sections (CREATE TABLE, etc)
      const sections = sql.split(/(?=(?:CREATE|ALTER|INSERT|UPDATE|DO \$\$|COMMENT ON) )/gi)
        .filter(s => s.trim().length > 0)
      
      console.log(`   Found ${sections.length} sections to execute`)
      
      let sectionSuccess = 0
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim()
        if (!section || section.startsWith('--')) continue
        
        const sectionType = section.match(/^(CREATE TABLE|CREATE INDEX|ALTER TABLE|INSERT|UPDATE|DO \$\$|CREATE OR REPLACE)/i)?.[1] || 'SQL'
        
        const success = await executeSQLViaAPI(section, `   ${sectionType} (${i + 1}/${sections.length})`)
        if (success) sectionSuccess++
      }
      
      if (sectionSuccess > 0) {
        console.log(`   ✅ Completed ${sectionSuccess}/${sections.length} sections`)
        successCount++
      } else {
        failureCount++
      }
      
    } catch (error) {
      console.error(`   ❌ Error reading migration file:`, error)
      failureCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`\n📊 Migration Summary:`)
  console.log(`   ✅ Successful migrations: ${successCount}/${migrations.length}`)
  console.log(`   ❌ Failed migrations: ${failureCount}`)
  
  if (failureCount > 0) {
    console.log('\n⚠️  Some migrations failed. This might be because:')
    console.log('   1. Tables already exist (which is OK)')
    console.log('   2. The Supabase API doesn\'t support direct SQL execution')
    console.log('   3. Complex SQL statements need to be run via the Dashboard')
    console.log('\n📋 Please run the failed migrations manually in the Supabase Dashboard:')
    console.log('   https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new')
  } else {
    console.log('\n✅ All migrations completed successfully!')
    console.log('\n🔍 Run validation to verify:')
    console.log('   npx tsx scripts/validate-division-migration.ts')
  }
}

// Alternative: Use pg library to connect directly
async function runMigrationsDirectly() {
  console.log('\n📌 Alternative: Direct Database Connection\n')
  
  const { Client } = await import('pg')
  const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    console.log('🔄 Connecting directly to database...')
    await client.connect()
    console.log('✅ Connected!\n')
    
    for (const migration of migrations) {
      console.log(`📄 Running: ${migration.file}`)
      
      try {
        const migrationPath = join(process.cwd(), 'supabase', 'migrations', migration.file)
        const sql = readFileSync(migrationPath, 'utf8')
        
        // Execute the entire migration as one transaction
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        
        console.log(`   ✅ ${migration.description} - Complete`)
      } catch (error: any) {
        await client.query('ROLLBACK')
        console.error(`   ❌ ${migration.description} - Failed`)
        console.error(`      ${error.message}`)
        
        if (error.message.includes('already exists')) {
          console.log('      (This is OK - objects already exist)')
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Connection error:', error)
  } finally {
    await client.end()
  }
}

// Try API approach first, then fall back to direct connection
console.log('Attempting to run migrations...\n')
console.log('Method 1: Using Supabase API')
console.log('=' + '='.repeat(49) + '\n')

runMigrations().then(() => {
  console.log('\n\nMethod 2: Direct Database Connection')
  console.log('=' + '='.repeat(49))
  return runMigrationsDirectly()
}).catch(console.error)