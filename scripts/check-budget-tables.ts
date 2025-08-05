import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBudgetTables() {
  console.log('Checking if budget-related tables exist...\n')

  // Tables to check
  const tablesToCheck = [
    'excel_sheet_mappings',
    'budget_line_items',
    'wbs_structure'
  ]

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`❌ Table '${tableName}' does NOT exist`)
        } else {
          console.log(`⚠️  Table '${tableName}' - Error: ${error.message}`)
        }
      } else {
        console.log(`✅ Table '${tableName}' exists`)
      }
    } catch (err) {
      console.log(`❌ Table '${tableName}' - Unexpected error: ${err}`)
    }
  }

  console.log('\nConclusion: The migration needs to be applied!')
}

checkBudgetTables().catch(console.error)