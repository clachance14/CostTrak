#!/usr/bin/env tsx
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

console.log('=== Context7 MCP Configuration for Claude Desktop ===\n')

// Check if NPX is available
const { execSync } = require('child_process')
try {
  execSync('which npx', { stdio: 'ignore' })
  console.log('✅ NPX is available on your system\n')
} catch {
  console.error('❌ NPX is not available. Please install Node.js first.')
  process.exit(1)
}

console.log('📋 STEP 1: Understanding Context7')
console.log('─────────────────────────────────')
console.log('Context7 is an MCP server that provides access to library documentation.')
console.log('It enables Claude to fetch current API docs for React, Next.js, Supabase, etc.\n')

console.log('📋 STEP 2: Open Claude Desktop Settings')
console.log('───────────────────────────────────────')
console.log('1. Open Claude Desktop')
console.log('2. Go to Settings (gear icon)')
console.log('3. Navigate to Developer → Edit Config')
console.log('4. This will open your MCP configuration file\n')

console.log('📋 STEP 3: Add Context7 Configuration')
console.log('─────────────────────────────────────')
console.log('Add this configuration to your mcpServers object:\n')

const context7Config = {
  "context7": {
    "command": "npx",
    "args": ["@upstash/context7-mcp"]
  }
}

console.log(JSON.stringify(context7Config, null, 2))

console.log('\n📋 STEP 4: Alternative Documentation Servers')
console.log('────────────────────────────────────────────')
console.log('If Context7 doesn\'t meet your needs, try these alternatives:\n')

console.log('Option A - Create MCP Docs (for custom documentation):')
const createMcpDocsConfig = {
  "docs": {
    "command": "npx",
    "args": ["create-mcp-docs", "serve", "--directory", "./docs"]
  }
}
console.log(JSON.stringify(createMcpDocsConfig, null, 2))

console.log('\nOption B - MCP Documentation Server (with search):')
const mcpDocsServerConfig = {
  "docs": {
    "command": "npx",
    "args": ["@andrea9293/mcp-documentation-server"]
  }
}
console.log(JSON.stringify(mcpDocsServerConfig, null, 2))

console.log('\n📋 STEP 5: Complete Example Configuration')
console.log('────────────────────────────────────────')
console.log('Your complete MCP configuration should look like this:\n')

const fullConfig = {
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-postgres",
        "postgres://your-connection-string"
      ]
    },
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"]
    }
  }
}

console.log(JSON.stringify(fullConfig, null, 2))

console.log('\n📋 STEP 6: Save and Restart')
console.log('───────────────────────────')
console.log('1. Save the configuration file')
console.log('2. Completely quit Claude Desktop (not just close the window)')
console.log('3. Start Claude Desktop again')
console.log('4. The MCP servers will initialize on startup\n')

console.log('📋 STEP 7: Test Context7 Integration')
console.log('────────────────────────────────────')
console.log('Once restarted, test by asking Claude:')
console.log('- "Using Context7, show me the latest React hooks documentation"')
console.log('- "Fetch the Next.js App Router documentation"')
console.log('- "Get Supabase client initialization docs"\n')

console.log('🔧 Troubleshooting:')
console.log('──────────────────')
console.log('1. If Context7 fails to start:')
console.log('   - Check the Claude Desktop logs')
console.log('   - Try running: npx @upstash/context7-mcp')
console.log('   - Ensure you have internet connectivity\n')

console.log('2. If documentation fetching fails:')
console.log('   - The server might be rate-limited')
console.log('   - Try alternative documentation servers listed above')
console.log('   - Use web search as a fallback\n')

console.log('3. For SuperClaude integration:')
console.log('   - The --c7 flag should now work with commands')
console.log('   - Example: /analyze --c7 or /build --react --c7')
console.log('   - This enables Context7 for documentation lookups\n')

// Write example configuration to a file
const configPath = path.join(process.cwd(), 'scripts', 'mcp-config-example.json')
fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2))
console.log(`✅ Example configuration saved to: ${configPath}\n`)

console.log('📚 Additional Resources:')
console.log('───────────────────────')
console.log('- MCP Documentation: https://modelcontextprotocol.io')
console.log('- Context7 GitHub: https://github.com/upstash/context7')
console.log('- SuperClaude Docs: .claude/shared/superclaude-mcp.yml\n')