import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function testDirectConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // Extract project ref
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  
  // Note: For MCP, we typically need the database password, not the service role key
  // The service role key is a JWT token, not the database password
  console.log('Project ref:', projectRef)
  console.log('\nNOTE: Supabase direct connections require the database password,')
  console.log('not the service role key (which is a JWT token).')
  console.log('\nTo get your database password:')
  console.log('1. Go to https://app.supabase.com/project/' + projectRef + '/settings/database')
  console.log('2. Find the "Connection string" section')
  console.log('3. Copy the password from the connection string')
  console.log('\nFor now, let\'s test with the Supabase client library instead...\n')
  
  // We can't test direct connection without the actual database password
  const connectionStrings = []
  
  console.log('=== Testing Direct Database Connections ===\n')
  
  for (const { name, url } of connectionStrings) {
    console.log(`Testing: ${name}`)
    console.log(`URL: ${url.substring(0, 50)}...`)
    
    const client = new Client({ connectionString: url })
    
    try {
      await client.connect()
      const result = await client.query('SELECT COUNT(*) FROM projects')
      console.log(`✅ Success! Found ${result.rows[0].count} projects`)
      await client.end()
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`)
    }
    console.log()
  }
}

testDirectConnection().catch(console.error)