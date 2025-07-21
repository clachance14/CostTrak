#!/usr/bin/env tsx
import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), '.env.local') })

console.log('=== Correct MCP Configuration for Claude Desktop ===\n')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Extract project ID from URL
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'gzrxhwpmtbgnngadgnse'

// Construct the correct connection string
const connectionString = `postgresql://postgres.${projectId}:${serviceRoleKey}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

const mcpConfig = {
  mcpServers: {
    postgres: {
      command: "npx",
      args: [
        "@modelcontextprotocol/server-postgres",
        connectionString
      ]
    },
    context7: {
      command: "npx",
      args: ["@upstash/context7-mcp"]
    }
  }
}

console.log('📋 Full MCP Configuration:')
console.log('─────────────────────────')
console.log(JSON.stringify(mcpConfig, null, 2))

console.log('\n📋 Steps to Configure:')
console.log('────────────────────')
console.log('1. Open Claude Desktop')
console.log('2. Go to Settings → Developer → Edit Config')
console.log('3. Replace or merge the above configuration')
console.log('4. Save the configuration file')
console.log('5. IMPORTANT: Fully quit and restart Claude Desktop')
console.log('   (not just close the window - quit the entire app)')

console.log('\n📋 Testing After Restart:')
console.log('──────────────────────')
console.log('Test PostgreSQL:')
console.log('  - "Query the projects table for active projects"')
console.log('  - "Show all divisions in the database"')
console.log('')
console.log('Test Context7:')
console.log('  - "Use Context7 to show React useState documentation"')
console.log('  - "Fetch Next.js 15 App Router docs with Context7"')
console.log('')
console.log('Test SuperClaude Integration:')
console.log('  - "/analyze --c7" (should use Context7 for research)')
console.log('  - "/build --react --c7" (should fetch React patterns)')

console.log('\n⚠️  Common Issues:')
console.log('────────────────')
console.log('- If MCP servers don\'t appear: Ensure full app restart')
console.log('- If connection fails: Check the connection string format')
console.log('- If Context7 fails: May need to clear npm cache')
console.log('- If tools not found: Check server names match exactly')

console.log('\n✨ Configuration ready to copy!')