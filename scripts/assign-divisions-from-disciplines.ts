#!/usr/bin/env tsx

/**
 * Assign Divisions from Disciplines
 * 
 * This script analyzes project budget breakdowns and assigns divisions
 * based on the disciplines present in each project.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') })

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

interface DisciplineMapping {
  discipline_name: string
  division_id: string
  division: {
    id: string
    name: string
    code: string
  }
}

interface ProjectBudgetBreakdown {
  project_id: string
  discipline: string
  cost_type: string
  value: number
}

interface Project {
  id: string
  job_number: string
  name: string
  division_id: string
}

async function assignDivisionsFromDisciplines() {
  console.log('🔄 Assigning Divisions from Disciplines\n')

  try {
    // 1. Get all discipline to division mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('division_discipline_mapping')
      .select(`
        discipline_name,
        division_id,
        division:divisions!division_discipline_mapping_division_id_fkey(id, name, code)
      `)

    if (mappingError) {
      console.error('Error fetching mappings:', mappingError)
      return
    }

    console.log(`📋 Found ${mappings?.length || 0} discipline mappings\n`)

    // Create a map for easy lookup
    const disciplineToDiv = new Map<string, DisciplineMapping>()
    mappings?.forEach(m => {
      disciplineToDiv.set(m.discipline_name.toUpperCase(), m)
    })

    // 2. Get all projects with their budget breakdowns
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, name, division_id')
      .is('deleted_at', null)
      .eq('status', 'active')

    if (projectError) {
      console.error('Error fetching projects:', projectError)
      return
    }

    console.log(`📊 Analyzing ${projects?.length || 0} active projects...\n`)

    let projectsUpdated = 0
    let divisionsAdded = 0

    for (const project of projects || []) {
      // Get budget breakdowns for this project
      const { data: breakdowns, error: breakdownError } = await supabase
        .from('project_budget_breakdowns')
        .select('discipline, cost_type, value')
        .eq('project_id', project.id)
        .not('discipline', 'is', null)

      if (breakdownError) {
        console.error(`Error fetching breakdowns for ${project.job_number}:`, breakdownError)
        continue
      }

      if (!breakdowns || breakdowns.length === 0) {
        continue
      }

      // Get existing project divisions
      const { data: existingDivisions } = await supabase
        .from('project_divisions')
        .select('division_id')
        .eq('project_id', project.id)

      const existingDivIds = new Set(existingDivisions?.map(d => d.division_id) || [])

      // Group breakdowns by discipline and sum values
      const disciplineBudgets = new Map<string, number>()
      breakdowns.forEach(b => {
        if (b.discipline) {
          const current = disciplineBudgets.get(b.discipline) || 0
          disciplineBudgets.set(b.discipline, current + (b.value || 0))
        }
      })

      // Determine which divisions are needed
      const neededDivisions = new Map<string, { divisionId: string; divisionName: string; budget: number }>()
      
      disciplineBudgets.forEach((budget, discipline) => {
        const mapping = disciplineToDiv.get(discipline.toUpperCase())
        if (mapping && !existingDivIds.has(mapping.division_id)) {
          const existing = neededDivisions.get(mapping.division_id)
          if (existing) {
            existing.budget += budget
          } else {
            neededDivisions.set(mapping.division_id, {
              divisionId: mapping.division_id,
              divisionName: mapping.division.name,
              budget: budget
            })
          }
        }
      })

      // Add missing divisions
      if (neededDivisions.size > 0) {
        console.log(`\n📦 Project ${project.job_number} - ${project.name}`)
        console.log(`   Current lead division: ${project.division_id}`)
        console.log(`   Disciplines found: ${Array.from(disciplineBudgets.keys()).join(', ')}`)
        console.log(`   Divisions to add:`)

        for (const [divId, divInfo] of neededDivisions) {
          console.log(`     • ${divInfo.divisionName} (Budget: $${divInfo.budget.toLocaleString()})`)

          // Insert project_division entry
          const { error: insertError } = await supabase
            .from('project_divisions')
            .insert({
              project_id: project.id,
              division_id: divId,
              is_lead_division: false, // Keep existing as lead
              budget_allocated: divInfo.budget,
              created_by: project.id // Use project ID as placeholder
            })

          if (insertError) {
            console.error(`     ❌ Error adding ${divInfo.divisionName}:`, insertError.message)
          } else {
            console.log(`     ✅ Added ${divInfo.divisionName}`)
            divisionsAdded++
          }

          // Create division budget entry
          const { error: budgetError } = await supabase
            .from('division_budgets')
            .insert({
              project_id: project.id,
              division_id: divId,
              labor_budget: divInfo.budget * 0.4,      // Estimated splits
              materials_budget: divInfo.budget * 0.3,
              equipment_budget: divInfo.budget * 0.1,
              subcontracts_budget: divInfo.budget * 0.15,
              other_budget: divInfo.budget * 0.05
            })

          if (budgetError && !budgetError.message.includes('duplicate')) {
            console.error(`     ⚠️  Budget creation issue:`, budgetError.message)
          }
        }

        projectsUpdated++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log(`\n✅ Division Assignment Complete!`)
    console.log(`   Projects updated: ${projectsUpdated}`)
    console.log(`   Divisions added: ${divisionsAdded}`)

    // Show final division counts
    const { data: divisionCounts } = await supabase
      .from('project_divisions')
      .select('project_id')
      .select('count', { count: 'exact', head: true })

    console.log(`\n📊 Total project-division assignments: ${divisionCounts || 0}`)

    // List multi-division projects
    const { data: multiDivProjects } = await supabase.rpc('query', {
      text: `
        SELECT p.job_number, p.name, COUNT(pd.id) as division_count
        FROM projects p
        JOIN project_divisions pd ON pd.project_id = p.id
        WHERE p.deleted_at IS NULL
        GROUP BY p.id, p.job_number, p.name
        HAVING COUNT(pd.id) > 1
        ORDER BY COUNT(pd.id) DESC, p.job_number
      `
    })

    if (multiDivProjects && multiDivProjects.length > 0) {
      console.log(`\n🏢 Multi-Division Projects (${multiDivProjects.length}):`)
      multiDivProjects.forEach((p: any) => {
        console.log(`   • ${p.job_number} - ${p.name} (${p.division_count} divisions)`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the script
assignDivisionsFromDisciplines()
  .then(() => {
    console.log('\n✅ Script complete!')
  })
  .catch(console.error)