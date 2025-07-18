import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function getConnectionString(useLocal: boolean = false) {
  if (useLocal) {
    // Local Supabase connection
    return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  }
  
  // Remote Supabase connection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  
  // Extract project ref from URL
  // https://gzrxhwpmtbgnngadgnse.supabase.co -> gzrxhwpmtbgnngadgnse
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  
  if (!projectRef) {
    throw new Error('Could not extract project ref from Supabase URL')
  }
  
  // Construct database URL
  // Format: postgresql://postgres.[project-ref]:[service-role-key]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
  // Note: This is the pooler connection string format
  const dbUrl = `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`
  
  return dbUrl
}

// Parse command line arguments
const useLocal = process.argv.includes('--local')

try {
  const connectionString = getConnectionString(useLocal)
  console.log('\n=== Database Connection String ===')
  console.log(useLocal ? 'Environment: LOCAL' : 'Environment: REMOTE')
  console.log('\nConnection string for MCP configuration:')
  console.log(connectionString)
  
  console.log('\n=== MCP Configuration ===')
  console.log('\nTo use this database with Claude, add this to your MCP server configuration:')
  console.log('\nIn Claude Desktop app:')
  console.log('1. Go to Settings → Developer → MCP Servers')
  console.log('2. Add or update the postgres server with:')
  console.log(JSON.stringify({
    "command": "npx",
    "args": ["@modelcontextprotocol/server-postgres", connectionString]
  }, null, 2))
  
  console.log('\nAlternatively, you can set the MCP_POSTGRES_URL environment variable:')
  console.log(`export MCP_POSTGRES_URL="${connectionString}"`)
  
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}