import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function analyzeDisciplineData() {
  console.log('🔍 Analyzing CostTrak Database for Division Mapping\n')

  // 1. Get all unique discipline values from project_budget_breakdowns
  console.log('1. UNIQUE DISCIPLINES FROM PROJECT_BUDGET_BREAKDOWNS:')
  console.log('=' .repeat(60))
  
  const { data: disciplines, error: disciplineError } = await supabase
    .from('project_budget_breakdowns')
    .select('discipline')
    .order('discipline')
  
  if (disciplineError) {
    console.error('Error fetching disciplines:', disciplineError)
  } else {
    const uniqueDisciplines = [...new Set(disciplines.map(d => d.discipline))].filter(Boolean)
    console.log(`Found ${uniqueDisciplines.length} unique disciplines:\n`)
    uniqueDisciplines.forEach((discipline, index) => {
      console.log(`  ${index + 1}. ${discipline}`)
    })
  }

  // 2. Get all craft_types with their codes and categories
  console.log('\n\n2. CRAFT TYPES WITH CODES AND CATEGORIES:')
  console.log('=' .repeat(60))
  
  const { data: craftTypes, error: craftError } = await supabase
    .from('craft_types')
    .select('*')
    .order('code')
  
  if (craftError) {
    console.error('Error fetching craft types:', craftError)
  } else {
    console.log(`Found ${craftTypes?.length || 0} craft types:\n`)
    console.log('Code | Name                     | Category   | Active')
    console.log('-'.repeat(60))
    craftTypes?.forEach(craft => {
      console.log(
        `${craft.code.padEnd(4)} | ${craft.name.padEnd(24)} | ${craft.category.padEnd(10)} | ${craft.is_active}`
      )
    })
  }

  // 3. Sample purchase orders to understand created_by patterns
  console.log('\n\n3. SAMPLE PURCHASE ORDERS - CREATED_BY PATTERNS:')
  console.log('=' .repeat(60))
  
  const { data: purchaseOrders, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, created_by, created_at, project_id')
    .limit(20)
    .order('created_at', { ascending: false })
  
  if (poError) {
    console.error('Error fetching purchase orders:', poError)
  } else {
    console.log(`Showing ${purchaseOrders?.length || 0} recent purchase orders:\n`)
    
    // Analyze created_by patterns
    const createdByValues = purchaseOrders?.map(po => po.created_by) || []
    const uniqueCreators = [...new Set(createdByValues)].filter(Boolean)
    
    console.log('Unique created_by values:')
    uniqueCreators.forEach(creator => {
      const count = createdByValues.filter(c => c === creator).length
      console.log(`  - ${creator} (${count} POs)`)
    })
    
    console.log('\nSample PO details:')
    console.log('PO Number        | Created By                             | Created At          | Project ID')
    console.log('-'.repeat(100))
    purchaseOrders?.slice(0, 10).forEach(po => {
      console.log(
        `${(po.po_number || 'N/A').padEnd(15)} | ${(po.created_by || 'N/A').padEnd(38)} | ${new Date(po.created_at).toISOString().split('T')[0]} | ${po.project_id || 'N/A'}`
      )
    })
  }

  // 4. Additional analysis - check if there's a pattern between disciplines and divisions
  console.log('\n\n4. CHECKING FOR EXISTING DIVISION DATA:')
  console.log('=' .repeat(60))
  
  // Check if disciplines might already contain division information
  const { data: sampleBreakdowns, error: sampleError } = await supabase
    .from('project_budget_breakdowns')
    .select('discipline, project_id, budget_amount')
    .limit(10)
  
  if (!sampleError && sampleBreakdowns) {
    console.log('\nSample budget breakdowns to check discipline format:')
    sampleBreakdowns.forEach(breakdown => {
      console.log(`  Project: ${breakdown.project_id}, Discipline: "${breakdown.discipline}", Budget: $${breakdown.budget_amount?.toLocaleString() || '0'}`)
    })
  }

  // Check divisions table
  console.log('\n\n5. EXISTING DIVISIONS:')
  console.log('=' .repeat(60))
  
  const { data: divisions, error: divError } = await supabase
    .from('divisions')
    .select('*')
    .order('id')
  
  if (divError) {
    console.error('Error fetching divisions:', divError)
  } else {
    console.log(`Found ${divisions?.length || 0} divisions:\n`)
    divisions?.forEach(div => {
      console.log(`  ID: ${div.id}, Name: ${div.name}`)
    })
  }
}

// Run the analysis
analyzeDisciplineData()
  .then(() => {
    console.log('\n✅ Analysis complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error)
    process.exit(1)
  })