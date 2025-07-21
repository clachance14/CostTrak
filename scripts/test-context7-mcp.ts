#!/usr/bin/env tsx
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

console.log('=== Testing Context7 MCP Server ===\n')

async function testContext7() {
  console.log('📋 Step 1: Testing NPX availability')
  console.log('──────────────────────────────────')
  try {
    const { stdout: npxVersion } = await execAsync('npx --version')
    console.log(`✅ NPX is available: v${npxVersion.trim()}`)
  } catch (error) {
    console.error('❌ NPX is not available. Please install Node.js first.')
    process.exit(1)
  }

  console.log('\n📋 Step 2: Testing Context7 package availability')
  console.log('───────────────────────────────────────────────')
  try {
    // Check if the package exists
    const { stdout } = await execAsync('npm view @upstash/context7-mcp version')
    console.log(`✅ Context7 MCP package found: v${stdout.trim()}`)
  } catch (error) {
    console.error('❌ Context7 MCP package not found on npm')
    console.error('   Try: npm search context7')
  }

  console.log('\n📋 Step 3: Testing Context7 server startup')
  console.log('─────────────────────────────────────────')
  console.log('Attempting to start Context7 server...')
  console.log('Note: This may download the package if not cached\n')

  try {
    // Try to run the server briefly
    const child = exec('npx @upstash/context7-mcp', { timeout: 5000 })
    
    // Capture initial output
    let output = ''
    child.stdout?.on('data', (data) => {
      output += data
      process.stdout.write(data)
    })
    
    child.stderr?.on('data', (data) => {
      output += data
      process.stderr.write(data)
    })

    // Wait a bit for the server to start
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Kill the process
    child.kill()
    
    if (output.includes('error') || output.includes('Error')) {
      console.error('\n❌ Context7 server encountered errors')
    } else {
      console.log('\n✅ Context7 server appears to start successfully')
    }
  } catch (error: any) {
    if (error.code === 'ETIMEDOUT') {
      console.log('\n✅ Context7 server started (timed out as expected for MCP server)')
    } else {
      console.error('\n❌ Failed to start Context7 server:', error.message)
    }
  }

  console.log('\n📋 Step 4: Alternative Documentation Servers')
  console.log('───────────────────────────────────────────')
  
  // Test alternative servers
  const alternatives = [
    { name: 'Create MCP Docs', package: 'create-mcp-docs' },
    { name: 'MCP Documentation Server', package: '@andrea9293/mcp-documentation-server' },
    { name: 'MCP Docs Service', package: 'mcp-docs-service' }
  ]

  for (const alt of alternatives) {
    try {
      const { stdout } = await execAsync(`npm view ${alt.package} version`)
      console.log(`✅ ${alt.name}: v${stdout.trim()}`)
    } catch {
      console.log(`❌ ${alt.name}: Not found`)
    }
  }

  console.log('\n📋 Step 5: MCP Configuration Validation')
  console.log('──────────────────────────────────────')
  console.log('To validate in Claude Desktop:')
  console.log('1. Add the Context7 configuration to your MCP settings')
  console.log('2. Restart Claude Desktop completely')
  console.log('3. Ask Claude to test Context7 with:')
  console.log('   - "List available MCP tools"')
  console.log('   - "Use Context7 to fetch React documentation"')
  console.log('   - "Show me the latest Next.js features"\n')

  console.log('📋 Step 6: SuperClaude Integration Test')
  console.log('──────────────────────────────────────')
  console.log('Once Context7 is configured, test SuperClaude integration:')
  console.log('- /analyze --c7 (should use Context7 for research)')
  console.log('- /build --react --c7 (should fetch React patterns)')
  console.log('- /explain --c7 useEffect (should get official docs)\n')

  console.log('🎯 Expected Behavior:')
  console.log('────────────────────')
  console.log('- Context7 provides real-time library documentation')
  console.log('- Reduces hallucination by fetching official docs')
  console.log('- Improves code suggestions with current APIs')
  console.log('- Works seamlessly with SuperClaude --c7 flag\n')

  console.log('✨ Test complete!')
}

// Run the test
testContext7().catch(console.error)