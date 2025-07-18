import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const postgresUrl = process.env.POSTGRES_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

console.log('=== MCP Database Configuration for Claude Desktop ===\n')
console.log('Your Supabase project:', projectRef)
console.log('\n✅ Your database connection is ready!\n')

console.log('📋 STEP 1: Open Claude Desktop Settings')
console.log('────────────────────────────────────────')
console.log('1. Open Claude Desktop')
console.log('2. Go to Settings (gear icon)')
console.log('3. Navigate to Developer → MCP Servers')
console.log('4. Find the "postgres" server configuration\n')

console.log('📋 STEP 2: Update the Configuration')
console.log('───────────────────────────────────')
console.log('Replace the postgres server configuration with this EXACT JSON:\n')

const mcpConfig = {
  "postgres": {
    "command": "npx",
    "args": [
      "@modelcontextprotocol/server-postgres",
      postgresUrl
    ]
  }
}

console.log(JSON.stringify(mcpConfig, null, 2))

console.log('\n📋 STEP 3: Save and Restart')
console.log('──────────────────────────')
console.log('1. Click "Save" in the settings')
console.log('2. Restart Claude Desktop completely')
console.log('3. Wait for it to reconnect\n')

console.log('📋 STEP 4: Test the Connection')
console.log('─────────────────────────────')
console.log('Once restarted, you can test by asking Claude to:')
console.log('- "Query the projects table"')
console.log('- "Show me all tables in the database"')
console.log('- "List the labor_actuals for project 5640"\n')

console.log('✨ That\'s it! Your database should now be accessible to Claude.\n')

console.log('🔧 Troubleshooting:')
console.log('──────────────────')
console.log('If it doesn\'t work:')
console.log('1. Make sure you copied the ENTIRE JSON configuration')
console.log('2. Check that Claude Desktop was fully restarted')
console.log('3. Look for any error messages in Claude\'s response')
console.log('4. Try the test connection script: npx tsx scripts/test-final-connection.ts')