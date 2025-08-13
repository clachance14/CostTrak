#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkColumns() {
  // Get one record to see its structure
  const { data, error } = await supabase
    .from('labor_employee_actuals')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('Error:', error)
  } else if (data) {
    console.log('Columns in labor_employee_actuals:')
    console.log(Object.keys(data))
    console.log('\nSample data:')
    console.log(JSON.stringify(data, null, 2))
  }
}

checkColumns()