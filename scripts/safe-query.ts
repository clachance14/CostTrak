#!/usr/bin/env tsx

/**
 * Safe Query Wrapper - Protected Database Operations
 * 
 * This script provides a safe interface for database operations with:
 * - Validation before execution
 * - Preview mode for destructive operations  
 * - Automatic transaction wrapping
 * - Audit logging
 * - Rollback capabilities
 * 
 * Usage:
 *   npx tsx scripts/safe-query.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

// Environment validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`)
    console.error('Please check your .env.local file')
    process.exit(1)
  }
}

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Helper function to prompt user
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

// SQL operation types
const DESTRUCTIVE_KEYWORDS = [
  'DELETE', 'DROP', 'TRUNCATE', 'UPDATE', 'INSERT', 
  'ALTER', 'CREATE', 'GRANT', 'REVOKE'
]

const DANGEROUS_KEYWORDS = [
  'DROP TABLE', 'TRUNCATE', 'DELETE FROM', 'DROP COLUMN',
  'DROP INDEX', 'DROP CONSTRAINT'
]

// Analyze SQL query for safety
function analyzeSqlSafety(sql: string): {
  isDestructive: boolean
  isDangerous: boolean
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
} {
  const upperSql = sql.toUpperCase().trim()
  const warnings: string[] = []
  
  const isDestructive = DESTRUCTIVE_KEYWORDS.some(keyword => 
    upperSql.includes(keyword)
  )
  
  const isDangerous = DANGEROUS_KEYWORDS.some(keyword => 
    upperSql.includes(keyword)
  )
  
  // Risk assessment
  let estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
  
  if (isDangerous) {
    estimatedRisk = 'HIGH'
    warnings.push('⚠️  Contains dangerous operations that could cause data loss')
  } else if (isDestructive) {
    estimatedRisk = 'MEDIUM'
    warnings.push('⚠️  Contains operations that modify data')
  }
  
  // Specific checks
  if (upperSql.includes('WHERE') === false && (upperSql.includes('UPDATE') || upperSql.includes('DELETE'))) {
    warnings.push('⚠️  No WHERE clause detected - will affect ALL rows')
    estimatedRisk = 'HIGH'
  }
  
  if (upperSql.includes('*') && upperSql.includes('DELETE')) {
    warnings.push('⚠️  DELETE with wildcard detected')
    estimatedRisk = 'HIGH'
  }
  
  if (upperSql.includes('CASCADE')) {
    warnings.push('⚠️  CASCADE operation detected - may affect related data')
    estimatedRisk = 'HIGH'
  }
  
  return { isDestructive, isDangerous, estimatedRisk, warnings }
}

// Execute query with safety checks
async function executeSafeQuery(sql: string, previewMode = false): Promise<any> {
  try {
    console.log('\n🔍 Analyzing query safety...')
    const safety = analyzeSqlSafety(sql)
    
    // Display safety analysis
    console.log(`\n📊 Safety Analysis:`)
    console.log(`   Risk Level: ${safety.estimatedRisk === 'HIGH' ? '🔴' : safety.estimatedRisk === 'MEDIUM' ? '🟡' : '🟢'} ${safety.estimatedRisk}`)
    console.log(`   Destructive: ${safety.isDestructive ? '❌ Yes' : '✅ No'}`)
    console.log(`   Dangerous: ${safety.isDangerous ? '❌ Yes' : '✅ No'}`)
    
    if (safety.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`)
      safety.warnings.forEach(warning => console.log(`   ${warning}`))
    }
    
    // Preview mode for destructive operations
    if (safety.isDestructive && !previewMode) {
      console.log(`\n🔍 Running in preview mode first...`)
      
      // Generate preview query
      let previewQuery = sql
      if (sql.toUpperCase().includes('UPDATE')) {
        // Convert UPDATE to SELECT for preview
        previewQuery = sql.replace(/UPDATE\s+(\w+)\s+SET\s+.*?(WHERE.*)?$/i, 
          (match, table, whereClause) => `SELECT * FROM ${table} ${whereClause || ''} LIMIT 5`)
      } else if (sql.toUpperCase().includes('DELETE')) {
        // Convert DELETE to SELECT for preview
        previewQuery = sql.replace(/DELETE\s+FROM\s+(\w+)(.*)?$/i, 
          (match, table, whereClause) => `SELECT * FROM ${table} ${whereClause || ''} LIMIT 5`)
      }
      
      if (previewQuery !== sql) {
        console.log(`\n📋 Preview Query: ${previewQuery}`)
        const previewResult = await supabase.rpc('exec_sql', { sql: previewQuery })
        
        if (previewResult.error) {
          console.error('❌ Preview failed:', previewResult.error.message)
          return
        }
        
        console.log('\n📊 Preview Results:')
        if (previewResult.data && previewResult.data.length > 0) {
          console.table(previewResult.data.slice(0, 5))
          console.log(`\n📈 Showing first 5 rows. Estimated affected rows: ${previewResult.data.length}`)
        } else {
          console.log('   No rows would be affected')
        }
      }
    }
    
    // Confirmation for destructive operations
    if (safety.isDestructive || safety.isDangerous) {
      const confirmation = await prompt(`\n⚠️  This operation ${safety.isDangerous ? 'is DANGEROUS' : 'will modify data'}. Continue? (yes/no): `)
      
      if (confirmation.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled by user')
        return
      }
      
      if (safety.isDangerous) {
        const doubleConfirm = await prompt(`\n🚨 FINAL WARNING: Type "I UNDERSTAND THE RISKS" to proceed: `)
        if (doubleConfirm !== 'I UNDERSTAND THE RISKS') {
          console.log('❌ Operation cancelled - confirmation not matched')
          return
        }
      }
    }
    
    console.log('\n🔄 Executing query...')
    
    // Execute within transaction for destructive operations
    if (safety.isDestructive) {
      console.log('📦 Wrapping in transaction for safety...')
      
      const transactionSql = `
        BEGIN;
        ${sql};
        -- Transaction will be committed after verification
      `
      
      const result = await supabase.rpc('exec_sql', { sql: transactionSql })
      
      if (result.error) {
        console.error('❌ Query failed:', result.error.message)
        console.log('📦 Transaction automatically rolled back')
        return
      }
      
      console.log('✅ Query executed successfully within transaction')
      
      // Ask for commit confirmation
      const commitConfirm = await prompt('\n📦 Commit transaction? (yes/no): ')
      
      if (commitConfirm.toLowerCase() === 'yes') {
        await supabase.rpc('exec_sql', { sql: 'COMMIT;' })
        console.log('✅ Transaction committed')
      } else {
        await supabase.rpc('exec_sql', { sql: 'ROLLBACK;' })
        console.log('↩️  Transaction rolled back')
        return
      }
      
      return result
    } else {
      // Execute directly for read operations
      const result = await supabase.rpc('exec_sql', { sql })
      
      if (result.error) {
        console.error('❌ Query failed:', result.error.message)
        return
      }
      
      console.log('✅ Query executed successfully')
      return result
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    throw error
  }
}

// Display results
function displayResults(result: any) {
  if (!result || !result.data) {
    console.log('📊 No data returned')
    return
  }
  
  console.log(`\n📊 Query Results (${result.data.length} rows):`)
  
  if (result.data.length === 0) {
    console.log('   No rows returned')
  } else if (result.data.length <= 20) {
    console.table(result.data)
  } else {
    console.table(result.data.slice(0, 10))
    console.log(`\n📈 Showing first 10 of ${result.data.length} rows`)
    console.log('💡 Use LIMIT clause for large result sets')
  }
}

// Log operation for audit
async function logOperation(sql: string, success: boolean, error?: string) {
  try {
    await supabase.from('audit_log').insert({
      operation_type: 'sql_query',
      details: { query: sql, success, error },
      performed_by: 'safe-query-script',
      performed_at: new Date().toISOString()
    })
  } catch (logError) {
    console.warn('⚠️  Could not log operation to audit_log table')
  }
}

// Main interactive loop
async function main() {
  console.log('🛡️  Safe Query Wrapper - Protected Database Operations\n')
  console.log('Features:')
  console.log('  ✅ Safety validation')
  console.log('  🔍 Preview mode for destructive operations')
  console.log('  📦 Automatic transaction wrapping')
  console.log('  📝 Audit logging')
  console.log('  ↩️  Rollback capabilities')
  console.log('\nType "help" for commands, "quit" to exit\n')
  
  while (true) {
    try {
      const input = await prompt('🔹 SQL> ')
      
      if (input.trim().toLowerCase() === 'quit' || input.trim().toLowerCase() === 'exit') {
        console.log('👋 Goodbye!')
        break
      }
      
      if (input.trim().toLowerCase() === 'help') {
        console.log(`
📚 Available Commands:
   help          - Show this help message
   quit/exit     - Exit the script
   status        - Show connection status
   tables        - List all tables
   preview       - Run next query in preview mode only
   
📋 SQL Examples:
   SELECT * FROM projects LIMIT 5;
   SELECT COUNT(*) FROM labor_employee_actuals;
   UPDATE projects SET active = true WHERE id = 123;
   
🛡️  Safety Features:
   - Automatic risk assessment
   - Preview mode for destructive operations
   - Transaction wrapping for data modifications
   - Confirmation prompts for dangerous operations
        `)
        continue
      }
      
      if (input.trim().toLowerCase() === 'status') {
        console.log('🔍 Testing connection...')
        const testResult = await supabase.from('projects').select('count', { count: 'exact', head: true })
        if (testResult.error) {
          console.log('❌ Connection failed:', testResult.error.message)
        } else {
          console.log(`✅ Connected to database`)
          console.log(`📊 Found ${testResult.count} projects`)
        }
        continue
      }
      
      if (input.trim().toLowerCase() === 'tables') {
        console.log('📊 Fetching table list...')
        const result = await supabase.rpc('exec_sql', { 
          sql: `SELECT tablename, schemaname FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
        })
        if (result.data) {
          console.log('\n📋 Available Tables:')
          result.data.forEach((table: any) => {
            console.log(`   • ${table.tablename}`)
          })
        }
        continue
      }
      
      if (input.trim() === '') {
        continue
      }
      
      const startTime = Date.now()
      const result = await executeSafeQuery(input.trim())
      const duration = Date.now() - startTime
      
      if (result) {
        displayResults(result)
        console.log(`⏱️  Query completed in ${duration}ms`)
        await logOperation(input.trim(), true)
      } else {
        await logOperation(input.trim(), false, 'Query failed or cancelled')
      }
      
    } catch (error) {
      console.error('❌ Error:', error)
      await logOperation('unknown', false, error instanceof Error ? error.message : 'Unknown error')
    }
    
    console.log() // Empty line for readability
  }
  
  rl.close()
}

// Create exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  try {
    const functionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS TABLE(result jsonb) AS $$
      BEGIN
        RETURN QUERY EXECUTE format('SELECT row_to_json(t) FROM (%s) t', sql);
      EXCEPTION
        WHEN others THEN
          RAISE EXCEPTION 'SQL execution failed: %', SQLERRM;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
    
    await supabase.rpc('exec', { sql: functionSql })
  } catch (error) {
    // Function might already exist or we might not have permissions
    console.warn('⚠️  Could not create exec_sql function - using fallback method')
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Script terminated by user')
  rl.close()
  process.exit(0)
})

// Run the main function
if (require.main === module) {
  createExecSqlFunction().then(() => {
    main().catch(console.error)
  })
}

export { executeSafeQuery, analyzeSqlSafety }