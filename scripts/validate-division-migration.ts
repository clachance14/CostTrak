#!/usr/bin/env tsx

/**
 * Validate Division Migration
 * 
 * This script checks the results of the multi-division migration
 * and provides a summary of what needs attention
 */

import { createClient } from '@supabase/supabase-js'

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function validateMigration() {
  console.log('\n🔍 Validating Division Migration...\n')

  try {
    // 1. Check total projects
    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    console.log('📊 Project Statistics:')
    console.log(`   Total active projects: ${totalProjects}`)

    // 2. Check projects with divisions
    const { data: projectsWithDivisions } = await supabase
      .from('project_divisions')
      .select('project_id')
      .limit(1000)

    const uniqueProjectsWithDivisions = new Set(projectsWithDivisions?.map(pd => pd.project_id) || [])
    console.log(`   Projects with divisions: ${uniqueProjectsWithDivisions.size}`)

    // 3. Check projects without divisions
    const { data: projectsWithoutDivisions } = await supabase
      .from('projects')
      .select('id, job_number, name, division_id')
      .is('deleted_at', null)
      .filter('id', 'not.in', `(${Array.from(uniqueProjectsWithDivisions).join(',')})`)
      .limit(10)

    if (projectsWithoutDivisions && projectsWithoutDivisions.length > 0) {
      console.log((`\n⚠️  Projects without division assignments (${projectsWithoutDivisions.length} shown):`))
      projectsWithoutDivisions.forEach(p => {
        console.log(`   - ${p.job_number}: ${p.name} (division_id: ${p.division_id || 'null'})`)
      })
    }

    // 4. Check division budgets
    const { count: divisionBudgetsCount } = await supabase
      .from('division_budgets')
      .select('*', { count: 'exact', head: true })

    console.log(('\n💰 Budget Statistics:'))
    console.log(`   Division budgets created: ${divisionBudgetsCount}`)

    // 5. Check budget breakdown mapping
    const { data: unmappedDisciplines } = await supabase
      .from('project_budget_breakdowns')
      .select('discipline')
      .filter('discipline', 'not.in', '(SELECT discipline_name FROM division_discipline_mapping)')
      .limit(10)

    if (unmappedDisciplines && unmappedDisciplines.length > 0) {
      const uniqueDisciplines = [...new Set(unmappedDisciplines.map(d => d.discipline))]
      console.log((`\n⚠️  Unmapped disciplines (${uniqueDisciplines.length}):`))
      uniqueDisciplines.forEach(d => {
        console.log(`   - ${d}`)
      })
    }

    // 6. Check PO division assignments
    const { count: totalPOs } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .not('project_id', 'is', null)

    const { count: POsWithDivisions } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .not('division_id', 'is', null)

    console.log(('\n📋 Purchase Order Statistics:'))
    console.log(`   Total POs: ${totalPOs}`)
    console.log(`   POs with divisions: ${POsWithDivisions}`)
    console.log(`   POs without divisions: ${(totalPOs || 0) - (POsWithDivisions || 0)}`)

    // 7. Check labor division assignments
    const { count: totalLabor } = await supabase
      .from('labor_actuals')
      .select('*', { count: 'exact', head: true })

    const { count: laborWithDivisions } = await supabase
      .from('labor_actuals')
      .select('*', { count: 'exact', head: true })
      .not('division_id', 'is', null)

    console.log(('\n👷 Labor Statistics:'))
    console.log(`   Total labor records: ${totalLabor}`)
    console.log(`   Labor with divisions: ${laborWithDivisions}`)
    console.log(`   Labor without divisions: ${(totalLabor || 0) - (laborWithDivisions || 0)}`)

    // 8. Check craft type mappings
    const { count: craftTypesTotal } = await supabase
      .from('craft_types')
      .select('*', { count: 'exact', head: true })

    const { count: craftTypesMapped } = await supabase
      .from('craft_type_divisions')
      .select('craft_type_id', { count: 'exact', head: true })

    console.log(('\n🔧 Craft Type Mappings:'))
    console.log(`   Total craft types: ${craftTypesTotal}`)
    console.log(`   Mapped craft types: ${craftTypesMapped}`)

    // 9. Division distribution
    const { data: divisionStats } = await supabase
      .from('project_divisions')
      .select('division_id, divisions!inner(name, code)')
      .limit(1000)

    if (divisionStats) {
      const divisionCounts = new Map<string, number>()
      divisionStats.forEach((pd: any) => {
        const key = `${pd.divisions.name} (${pd.divisions.code})`
        divisionCounts.set(key, (divisionCounts.get(key) || 0) + 1)
      })

      console.log(('\n🏗️  Division Distribution:'))
      Array.from(divisionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([division, count]) => {
          console.log(`   ${division}: ${count} projects`)
        })
    }

    // 10. Summary and recommendations
    console.log(('\n✅ Migration Validation Complete\n'))

    const projectsNeedingDivisions = (totalProjects || 0) - uniqueProjectsWithDivisions.size
    const posNeedingDivisions = (totalPOs || 0) - (POsWithDivisions || 0)
    const laborNeedingDivisions = (totalLabor || 0) - (laborWithDivisions || 0)

    if (projectsNeedingDivisions > 0 || posNeedingDivisions > 0 || laborNeedingDivisions > 0) {
      console.log(('📌 Recommended Actions:'))
      
      if (projectsNeedingDivisions > 0) {
        console.log(`   1. Run migration script to assign divisions to ${projectsNeedingDivisions} projects`)
      }
      
      if (posNeedingDivisions > 0) {
        console.log(`   2. Assign divisions to ${posNeedingDivisions} purchase orders`)
      }
      
      if (laborNeedingDivisions > 0) {
        console.log(`   3. Assign divisions to ${laborNeedingDivisions} labor records`)
      }

      console.log('\n   Run the migration script:')
      console.log(('   supabase db push'))
      console.log(('   supabase migration up 20250121_migrate_existing_projects_to_divisions.sql'))
    } else {
      console.log(('✨ All data appears to be properly migrated!'))
    }

  } catch (error) {
    console.error(('\n❌ Validation failed:'), error)
    process.exit(1)
  }
}

// Run validation
validateMigration().catch(console.error)