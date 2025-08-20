#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function backfillPerDiemCosts() {
  console.log('========================================')
  console.log('Per Diem Cost Backfill')
  console.log('========================================\n')

  // Get all projects with per diem enabled
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, job_number, per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect')
    .eq('per_diem_enabled', true)
    .order('job_number')

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    return
  }

  console.log(`Found ${projects?.length || 0} projects with per diem enabled\n`)

  let totalBackfilled = 0
  let totalAmount = 0

  for (const project of projects || []) {
    console.log(`\nProcessing: ${project.name} (${project.job_number})`)
    console.log(`  Direct Rate: $${project.per_diem_rate_direct}/day`)
    console.log(`  Indirect Rate: $${project.per_diem_rate_indirect}/day`)

    // Use the recalculate function that's already in the database
    const { data: result, error: recalcError } = await supabase
      .rpc('recalculate_project_per_diem', { p_project_id: project.id })

    if (recalcError) {
      console.error(`  ❌ Error recalculating per diem:`, recalcError)
      continue
    }

    if (result) {
      console.log(`  ✅ Recalculated successfully:`)
      console.log(`     Records processed: ${result.records_processed}`)
      console.log(`     Total per diem amount: $${result.total_per_diem_amount}`)
      
      totalBackfilled += result.records_processed || 0
      totalAmount += result.total_per_diem_amount || 0
    }
  }

  console.log('\n========================================')
  console.log('Backfill Summary')
  console.log('========================================')
  console.log(`Total records processed: ${totalBackfilled}`)
  console.log(`Total per diem amount: $${totalAmount.toFixed(2)}`)
  console.log('\n✅ Per diem costs have been backfilled successfully!')
  console.log('\n⚠️  IMPORTANT: The budget vs actual API still needs to be updated')
  console.log('to include these per diem costs in the labor actuals calculations.')
}

backfillPerDiemCosts().catch(console.error)