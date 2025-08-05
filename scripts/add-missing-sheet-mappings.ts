import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addMissingSheetMappings() {
  console.log('Adding missing sheet mappings...\n')

  // First, check what mappings already exist
  const { data: existingMappings, error: checkError } = await supabase
    .from('excel_sheet_mappings')
    .select('sheet_name')

  if (checkError) {
    console.error('Error checking existing mappings:', checkError)
    return
  }

  const existingSheetNames = existingMappings?.map(m => m.sheet_name) || []
  console.log('Existing sheet mappings:', existingSheetNames)

  // Define all required sheet mappings
  const requiredMappings = [
    {
      sheet_name: 'BUDGETS',
      category: 'SUMMARY',
      subcategory: null,
      column_mappings: {
        discipline: 1,
        wbs_code: 2,
        description: 3,
        manhours: 4,
        value: 5
      }
    },
    {
      sheet_name: 'CONSTRUCTABILITY',
      category: 'OTHER',
      subcategory: 'RISK',
      column_mappings: {
        wbs_code: 0,
        description: 1,
        mitigation: 2,
        cost_impact: 3,
        total_cost: 4
      }
    },
    {
      sheet_name: 'DISC. EQUIPMENT',
      category: 'EQUIPMENT',
      subcategory: 'DISCIPLINE',
      column_mappings: {
        wbs_code: 0,
        discipline: 1,
        description: 2,
        quantity: 3,
        duration: 4,
        rate: 5,
        total_cost: 6
      }
    },
    {
      sheet_name: 'GENERAL EQUIPMENT',
      category: 'EQUIPMENT',
      subcategory: null,
      column_mappings: {
        wbs_code: 0,
        description: 1,
        quantity: 2,
        duration: 3,
        rate: 4,
        total_cost: 5,
        owned_rented: 6
      }
    },
    {
      sheet_name: 'SCAFFOLDING',
      category: 'SUBCONTRACT',
      subcategory: 'SCAFFOLDING',
      column_mappings: {
        wbs_code: 0,
        description: 1,
        area: 2,
        duration: 3,
        unit_rate: 4,
        total_cost: 5,
        contractor: 6
      }
    },
    {
      sheet_name: 'SUBS',
      category: 'SUBCONTRACT',
      subcategory: null,
      column_mappings: {
        wbs_code: 0,
        description: 1,
        contractor: 2,
        lump_sum: 3,
        unit_price: 4,
        total_cost: 5
      }
    },
    {
      sheet_name: 'MATERIALS',
      category: 'MATERIAL',
      subcategory: null,
      column_mappings: {
        wbs_code: 0,
        description: 1,
        quantity: 2,
        unit: 3,
        unit_price: 4,
        total_cost: 5,
        supplier: 6
      }
    },
    {
      sheet_name: 'STAFF',
      category: 'LABOR',
      subcategory: 'STAFF',
      column_mappings: {
        wbs_code: 0,
        position: 1,
        quantity: 2,
        duration: 3,
        monthly_rate: 4,
        total_cost: 5
      }
    },
    {
      sheet_name: 'INDIRECTS',
      category: 'LABOR',
      subcategory: 'INDIRECT',
      column_mappings: {
        wbs_code: 0,
        description: 1,
        quantity: 2,
        duration: 3,
        rate: 4,
        total_cost: 5
      }
    },
    {
      sheet_name: 'DIRECTS',
      category: 'LABOR',
      subcategory: 'DIRECT',
      column_mappings: {
        wbs_code: 0,
        description: 1,
        crew_size: 2,
        duration: 3,
        manhours: 4,
        rate: 5,
        total_cost: 6
      }
    }
  ]

  // Filter out mappings that already exist
  const newMappings = requiredMappings.filter(
    mapping => !existingSheetNames.includes(mapping.sheet_name)
  )

  if (newMappings.length === 0) {
    console.log('\nAll required sheet mappings already exist!')
    return
  }

  console.log(`\nAdding ${newMappings.length} new sheet mappings:`)
  newMappings.forEach(m => console.log(`- ${m.sheet_name}`))

  // Insert new mappings
  const { data, error } = await supabase
    .from('excel_sheet_mappings')
    .insert(newMappings)
    .select()

  if (error) {
    console.error('\nError inserting mappings:', error)
    return
  }

  console.log(`\n✅ Successfully added ${data?.length || 0} sheet mappings!`)

  // Show final state
  const { data: finalMappings } = await supabase
    .from('excel_sheet_mappings')
    .select('sheet_name, category, subcategory')
    .order('sheet_name')

  console.log('\nAll sheet mappings:')
  finalMappings?.forEach(m => {
    console.log(`- ${m.sheet_name} (${m.category}${m.subcategory ? '/' + m.subcategory : ''})`)
  })
}

addMissingSheetMappings().catch(console.error)