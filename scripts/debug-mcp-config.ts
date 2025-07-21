#!/usr/bin/env tsx
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

console.log('=== MCP Configuration Debug ===\n')

// Common MCP config locations
const configPaths = [
  join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), // macOS
  join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'), // Windows
  join(homedir(), '.config', 'Claude', 'claude_desktop_config.json'), // Linux
]

console.log('📋 Checking MCP Configuration Locations:')
console.log('────────────────────────────────────────')

let configFound = false
let configContent = ''

for (const path of configPaths) {
  if (existsSync(path)) {
    console.log(`✅ Found config at: ${path}`)
    configFound = true
    try {
      configContent = readFileSync(path, 'utf-8')
      const config = JSON.parse(configContent)
      
      console.log('\n📋 Current MCP Servers:')
      console.log('─────────────────────')
      if (config.mcpServers) {
        Object.keys(config.mcpServers).forEach(server => {
          console.log(`  - ${server}`)
        })
      } else {
        console.log('  ❌ No mcpServers section found')
      }
      
      // Check for postgres configuration
      if (config.mcpServers?.postgres) {
        console.log('\n📋 PostgreSQL Configuration:')
        console.log('──────────────────────────')
        const pgConfig = config.mcpServers.postgres
        console.log(`  Command: ${pgConfig.command}`)
        console.log(`  Args: ${pgConfig.args?.[0]}`)
        
        // Extract and check the connection string
        const connStr = pgConfig.args?.[1]
        if (connStr) {
          const hostMatch = connStr.match(/@([^:\/]+)/)
          if (hostMatch) {
            console.log(`  Host: ${hostMatch[1]}`)
            
            // Check if it's the problematic host
            if (hostMatch[1].includes('db.cqdtuybqoccncujqpiwl')) {
              console.log('  ⚠️  WARNING: Using incorrect database host!')
              console.log('  ✅ Should be: aws-0-us-west-1.pooler.supabase.com')
            }
          }
        }
      }
      
      // Check for context7 configuration
      if (config.mcpServers?.context7) {
        console.log('\n✅ Context7 is configured')
      } else {
        console.log('\n❌ Context7 is NOT configured')
      }
      
    } catch (error) {
      console.error(`❌ Error reading config: ${error}`)
    }
    break
  }
}

if (!configFound) {
  console.log('❌ No MCP configuration file found')
  console.log('\nPossible locations checked:')
  configPaths.forEach(p => console.log(`  - ${p}`))
}

console.log('\n📋 Testing MCP Server Availability:')
console.log('─────────────────────────────────')

// Test if MCP packages are installed globally or available via npx
try {
  execSync('npx @modelcontextprotocol/server-postgres --version', { stdio: 'ignore' })
  console.log('✅ PostgreSQL MCP server package is available')
} catch {
  console.log('⚠️  PostgreSQL MCP server may need to be downloaded')
}

try {
  execSync('npx @upstash/context7-mcp --version', { stdio: 'ignore' })
  console.log('✅ Context7 MCP server package is available')
} catch {
  console.log('⚠️  Context7 MCP server may need to be downloaded')
}

console.log('\n📋 Recommendations:')
console.log('─────────────────')
console.log('1. Ensure your claude_desktop_config.json has the correct configuration')
console.log('2. The PostgreSQL host should be: aws-0-us-west-1.pooler.supabase.com')
console.log('3. Both postgres and context7 servers should be in the mcpServers section')
console.log('4. After any config changes, fully quit and restart Claude Desktop')
console.log('5. Check Claude Desktop logs for any MCP startup errors')

console.log('\n✨ Debug complete!')