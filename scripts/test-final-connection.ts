import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Disable SSL verification for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function testConnection() {
  const postgresUrl = process.env.POSTGRES_URL
  
  console.log('=== Testing Database Connection ===\n')
  console.log('Connection URL:', postgresUrl?.substring(0, 60) + '...\n')
  
  const client = new Client({ connectionString: postgresUrl })
  
  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('✅ Connected successfully!\n')
    
    // Test queries
    console.log('Running test queries:\n')
    
    // 1. Count projects
    const projectCount = await client.query('SELECT COUNT(*) as count FROM projects')
    console.log(`✅ Projects table: ${projectCount.rows[0].count} records`)
    
    // 2. List sample projects
    const projects = await client.query('SELECT job_number, name FROM projects ORDER BY created_at DESC LIMIT 3')
    console.log('\nSample projects:')
    projects.rows.forEach(p => console.log(`   - ${p.job_number}: ${p.name}`))
    
    // 3. List tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    console.log(`\n✅ Found ${tables.rows.length} tables in database`)
    console.log('\nKey tables:')
    const keyTables = ['projects', 'purchase_orders', 'change_orders', 'labor_actuals', 'financial_snapshots']
    tables.rows
      .filter(t => keyTables.includes(t.table_name))
      .forEach(t => console.log(`   - ${t.table_name}`))
    
    await client.end()
    
    console.log('\n✨ Database connection test PASSED!\n')
    console.log('=== MCP Configuration ===')
    console.log('\nUse this EXACT configuration in Claude Desktop MCP settings:\n')
    console.log(JSON.stringify({
      "postgres": {
        "command": "npx",
        "args": [
          "@modelcontextprotocol/server-postgres",
          postgresUrl
        ]
      }
    }, null, 2))
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message)
    console.log('\nTroubleshooting:')
    console.log('1. Check if your database password is correct')
    console.log('2. Verify the Supabase project is active')
    console.log('3. Check network connectivity')
  }
}

testConnection().catch(console.error)