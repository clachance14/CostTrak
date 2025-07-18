import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function testConnections() {
  // Local Supabase credentials (default for local development)
  const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
  const LOCAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

  // Remote Supabase credentials from environment
  const REMOTE_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const REMOTE_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  console.log('=== CostTrak Database Connection Test ===\n')

  // Check Docker status
  console.log('1. Checking Docker containers...')
  try {
    const dockerOutput = execSync('docker ps --format "table {{.Names}}\t{{.Status}}" | grep supabase', { encoding: 'utf-8' })
    console.log('✅ Supabase Docker containers found:')
    console.log(dockerOutput)
  } catch (error) {
    console.log('❌ No Supabase Docker containers running')
  }

  // Test local connection
  console.log('\n2. Testing LOCAL Supabase connection...')
  console.log(`   URL: ${LOCAL_SUPABASE_URL}`)

  const localSupabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY)

  try {
    const { data: localProjects, error: localError } = await localSupabase
      .from('projects')
      .select('id, name, job_number')
      .limit(5)

    if (localError) {
      console.log('❌ Local connection failed:', localError.message)
    } else {
      console.log('✅ Local connection successful!')
      console.log(`   Found ${localProjects?.length || 0} projects`)
      if (localProjects && localProjects.length > 0) {
        console.log('   Sample projects:')
        localProjects.forEach(p => console.log(`     - ${p.job_number}: ${p.name}`))
      }
    }
  } catch (error) {
    console.log('❌ Local connection error:', error)
  }

  // Test remote connection
  console.log('\n3. Testing REMOTE Supabase connection...')
  console.log(`   URL: ${REMOTE_SUPABASE_URL}`)

  if (!REMOTE_SUPABASE_URL || !REMOTE_SUPABASE_ANON_KEY) {
    console.log('❌ Remote credentials not found in environment')
  } else {
    const remoteSupabase = createClient(REMOTE_SUPABASE_URL, REMOTE_SUPABASE_ANON_KEY)
    
    try {
      const { data: remoteProjects, error: remoteError } = await remoteSupabase
        .from('projects')
        .select('id, name, job_number')
        .limit(5)

      if (remoteError) {
        console.log('❌ Remote connection failed:', remoteError.message)
      } else {
        console.log('✅ Remote connection successful!')
        console.log(`   Found ${remoteProjects?.length || 0} projects`)
        if (remoteProjects && remoteProjects.length > 0) {
          console.log('   Sample projects:')
          remoteProjects.forEach(p => console.log(`     - ${p.job_number}: ${p.name}`))
        }
      }
    } catch (error) {
      console.log('❌ Remote connection error:', error)
    }
  }

  // Check MCP configuration
  console.log('\n4. Checking MCP configuration...')
  console.log('   MCP configs are typically in:')
  console.log('   - ~/.claude/mcp.json (global)')
  console.log('   - .claude/mcp.json (project-specific)')
  console.log('   - Or set via Claude desktop app settings')

  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===')
  console.log('\nBased on the results above:')
  console.log('1. If LOCAL has your data → Use local development setup')
  console.log('2. If REMOTE has your data → Use remote setup')
  console.log('3. To fix Claude\'s database access, create a .claude/mcp.json file in your project')
  console.log('\nExample .claude/mcp.json for LOCAL development:')
  console.log(`
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres", "${LOCAL_DB_URL}"]
    }
  }
}
`)
}

// Run the test
testConnections().catch(console.error)