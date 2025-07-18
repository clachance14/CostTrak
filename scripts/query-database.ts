import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryDatabase() {
  console.log('Connected to Supabase at:', supabaseUrl)
  console.log('\n=== Available Tables ===\n')

  // List known tables from the schema
  const knownTables = [
    'profiles',
    'projects', 
    'purchase_orders',
    'po_line_items',
    'change_orders',
    'financial_snapshots',
    'labor_actuals',
    'labor_headcount_forecasts',
    'craft_types',
    'audit_log',
    'divisions',
    'clients'
  ]

  console.log('Known tables in the schema:')
  knownTables.forEach(table => console.log(`  - ${table}`))

  // Show sample data from key tables
  console.log('\n=== Sample Data ===\n')

  // Projects
  console.log('Projects:')
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .limit(3)
  console.log(JSON.stringify(projects, null, 2))

  // Users/Profiles
  console.log('\nProfiles:')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .limit(3)
  console.log(JSON.stringify(profiles, null, 2))

  // Purchase Orders
  console.log('\nPurchase Orders:')
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, po_number, vendor, total_amount, project_id')
    .limit(3)
  console.log(JSON.stringify(pos, null, 2))

  // Change Orders
  console.log('\nChange Orders:')
  const { data: cos } = await supabase
    .from('change_orders')
    .select('id, co_number, description, amount, status')
    .limit(3)
  console.log(JSON.stringify(cos, null, 2))
}

queryDatabase().catch(console.error)