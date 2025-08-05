import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSheetMappings() {
  console.log('Checking excel_sheet_mappings table...\n')

  // Query the excel_sheet_mappings table
  const { data, error } = await supabase
    .from('excel_sheet_mappings')
    .select('*')
    .order('sheet_name')

  if (error) {
    console.error('Error querying excel_sheet_mappings:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('No sheet mappings found in the database!')
    return
  }

  console.log(`Found ${data.length} sheet mappings:\n`)

  // Expected sheets from the migration
  const expectedSheets = [
    'BUDGETS',
    'CONSTRUCTABILITY',
    'DIRECTS',
    'GENERAL EQUIPMENT',
    'INDIRECTS',
    'MATERIALS',
    'STAFF',
    'SUBS'
  ]

  // Check which sheets exist
  const existingSheets = data.map(mapping => mapping.sheet_name)
  
  console.log('Existing sheet mappings:')
  data.forEach(mapping => {
    console.log(`\n- ${mapping.sheet_name}`)
    console.log(`  Category: ${mapping.category}`)
    console.log(`  Subcategory: ${mapping.subcategory || 'N/A'}`)
    console.log(`  Column Mappings: ${JSON.stringify(mapping.column_mappings, null, 2)}`)
  })

  console.log('\n\nMissing sheet mappings:')
  const missingSheets = expectedSheets.filter(sheet => !existingSheets.includes(sheet))
  if (missingSheets.length === 0) {
    console.log('None - all expected sheets are mapped!')
  } else {
    missingSheets.forEach(sheet => console.log(`- ${sheet}`))
  }

  // Check for DISC. EQUIPMENT and SCAFFOLDING mentioned in the user's question
  const additionalSheets = ['DISC. EQUIPMENT', 'SCAFFOLDING']
  console.log('\n\nAdditional sheets mentioned:')
  additionalSheets.forEach(sheet => {
    const exists = existingSheets.includes(sheet)
    console.log(`- ${sheet}: ${exists ? 'EXISTS' : 'NOT FOUND'}`)
  })
}

checkSheetMappings().catch(console.error)