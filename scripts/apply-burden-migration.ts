import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('Applying burden columns migration...\n')
  
  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250718233919_add_labor_burden_columns.sql')
  const migrationSQL = await fs.readFile(migrationPath, 'utf-8')
  
  // Split the migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`Found ${statements.length} SQL statements to execute\n`)
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`Executing statement ${i + 1}/${statements.length}...`)
    
    try {
      // Execute the SQL statement using raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      }).catch(async () => {
        // If RPC doesn't exist, we can't execute raw SQL this way
        console.log('  RPC not available, statement needs to be run manually')
        return { data: null, error: 'RPC not available' }
      })
      
      if (error) {
        console.error('  Error:', error)
      } else {
        console.log('  ✓ Success')
      }
    } catch (err) {
      console.error('  Error:', err)
    }
  }
  
  console.log('\nMigration statements prepared. Please run these manually in Supabase SQL Editor:')
  console.log('\n--- BEGIN SQL ---')
  console.log(migrationSQL)
  console.log('--- END SQL ---\n')
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err)
    process.exit(1)
  })