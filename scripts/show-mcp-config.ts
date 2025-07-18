import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

console.log('=== MCP Database Configuration Instructions ===\n')
console.log('Your Supabase project reference:', projectRef)
console.log('\n📋 STEP 1: Get your database password')
console.log('─────────────────────────────────────')
console.log(`1. Open: https://app.supabase.com/project/${projectRef}/settings/database`)
console.log('2. Look for "Connection string" section')
console.log('3. Click "URI" and copy the password from the connection string')
console.log('   (It will look like: postgresql://postgres:[YOUR-PASSWORD-HERE]@db...)')
console.log('\n📋 STEP 2: Configure Claude Desktop')
console.log('────────────────────────────────────')
console.log('1. Open Claude Desktop')
console.log('2. Go to Settings → Developer → MCP Servers')
console.log('3. Edit the postgres server configuration')
console.log('4. Use this configuration:')
console.log('\n{')
console.log('  "postgres": {')
console.log('    "command": "npx",')
console.log('    "args": [')
console.log('      "@modelcontextprotocol/server-postgres",')
console.log(`      "postgresql://postgres:[YOUR-DATABASE-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres"`)
console.log('    ]')
console.log('  }')
console.log('}')
console.log('\n⚠️  IMPORTANT: Replace [YOUR-DATABASE-PASSWORD] with the actual password from Step 1')
console.log('\n📋 STEP 3: Restart Claude Desktop')
console.log('──────────────────────────────────')
console.log('After updating the configuration, restart Claude Desktop for changes to take effect.')
console.log('\n✅ Once configured, I\'ll be able to query your database directly!')
console.log('\nAlternatively, if you want to use local Supabase for development:')
console.log('────────────────────────────────────────────────────────────────')
console.log('Use this connection string instead:')
console.log('"postgresql://postgres:postgres@127.0.0.1:54322/postgres"')
console.log('\nBut first run:')
console.log('1. pnpm db:migrate  # Create schema')
console.log('2. pnpm db:seed     # Add test data')