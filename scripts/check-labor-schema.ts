import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLaborSchema() {
  console.log('Checking labor_employee_actuals table schema...\n')
  
  // Query the information schema
  const { data, error } = await supabase
    .from('labor_employee_actuals')
    .select('*')
    .limit(0) // We just want the schema, not data
  
  if (error) {
    console.error('Error querying table:', error)
    return
  }
  
  // Skip RPC check as it may not be available
  
  // Alternative method: try to query with specific columns
  console.log('Checking for burden columns...')
  const { error: burdenColumnsError } = await supabase
    .from('labor_employee_actuals')
    .select('id, burden_rate, st_burden_amount, total_burden_amount, st_wages_with_burden, total_cost_with_burden')
    .limit(1)
  
  if (burdenColumnsError) {
    console.log('✗ Burden columns do not exist yet')
    console.log('  Error:', burdenColumnsError.message)
  } else {
    console.log('✓ Burden columns already exist!')
  }
  
  // Check labor_actuals table
  console.log('\nChecking labor_actuals table schema...')
  const { error: laborActualsError } = await supabase
    .from('labor_actuals')
    .select('id, burden_rate, burden_amount, actual_cost_with_burden')
    .limit(1)
  
  if (laborActualsError) {
    console.log('✗ Burden columns do not exist in labor_actuals')
    console.log('  Error:', laborActualsError.message)
  } else {
    console.log('✓ Burden columns already exist in labor_actuals!')
  }
}

checkLaborSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err)
    process.exit(1)
  })