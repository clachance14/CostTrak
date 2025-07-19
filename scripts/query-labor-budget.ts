import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryLaborAndBudget() {
  console.log('Connected to Supabase at:', supabaseUrl)
  
  console.log('\n=== Craft Types ===\n')
  const { data: craftTypes, error: craftError } = await supabase
    .from('craft_types')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  
  if (craftError) {
    console.error('Error fetching craft types:', craftError)
  } else {
    console.log('Craft Types:', JSON.stringify(craftTypes, null, 2))
  }

  console.log('\n=== Project Budget Breakdowns (Sample) ===\n')
  const { data: budgetBreakdowns, error: budgetError } = await supabase
    .from('project_budget_breakdowns')
    .select('*')
    .limit(10)
  
  if (budgetError) {
    console.error('Error fetching budget breakdowns:', budgetError)
  } else {
    console.log('Budget Breakdowns:', JSON.stringify(budgetBreakdowns, null, 2))
  }

  console.log('\n=== Labor Actuals (Sample) ===\n')
  const { data: laborActuals, error: laborError } = await supabase
    .from('labor_actuals')
    .select('*')
    .limit(5)
  
  if (laborError) {
    console.error('Error fetching labor actuals:', laborError)
  } else {
    console.log('Labor Actuals:', JSON.stringify(laborActuals, null, 2))
  }

  console.log('\n=== Labor Headcount Forecasts (Sample) ===\n')
  const { data: headcountForecasts, error: headcountError } = await supabase
    .from('labor_headcount_forecasts')
    .select('*')
    .limit(5)
  
  if (headcountError) {
    console.error('Error fetching headcount forecasts:', headcountError)
  } else {
    console.log('Headcount Forecasts:', JSON.stringify(headcountForecasts, null, 2))
  }

  // Check unique disciplines and cost types in budget breakdowns
  console.log('\n=== Unique Disciplines and Cost Types ===\n')
  const { data: disciplines } = await supabase
    .from('project_budget_breakdowns')
    .select('discipline')
    .order('discipline')
  
  const uniqueDisciplines = [...new Set(disciplines?.map(d => d.discipline) || [])]
  console.log('Unique Disciplines:', uniqueDisciplines)

  const { data: costTypes } = await supabase
    .from('project_budget_breakdowns')
    .select('cost_type')
    .order('cost_type')
  
  const uniqueCostTypes = [...new Set(costTypes?.map(c => c.cost_type) || [])]
  console.log('Unique Cost Types:', uniqueCostTypes)

  // Check if there are any tax & insurance entries
  console.log('\n=== Tax & Insurance Entries ===\n')
  const { data: taxInsurance } = await supabase
    .from('project_budget_breakdowns')
    .select('*')
    .or('cost_type.ilike.%tax%,cost_type.ilike.%insurance%,discipline.ilike.%tax%,discipline.ilike.%insurance%')
    .limit(10)
  
  console.log('Tax & Insurance entries:', JSON.stringify(taxInsurance, null, 2))
}

queryLaborAndBudget().catch(console.error)