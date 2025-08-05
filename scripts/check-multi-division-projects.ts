import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkMultiDivisionProjects() {
  console.log('Checking for projects with multiple divisions...\n')

  // Find all project divisions
  const { data: projectDivisions } = await supabase
    .from('project_divisions')
    .select(`
      project_id,
      project:projects(id, name, job_number),
      division:divisions(name, code)
    `)
    .order('project_id')

  if (!projectDivisions) {
    console.log('No project divisions found')
    return
  }

  // Group by project to count divisions
  const projectMap = new Map<string, any[]>()
  projectDivisions.forEach(pd => {
    if (!projectMap.has(pd.project_id)) {
      projectMap.set(pd.project_id, [])
    }
    projectMap.get(pd.project_id)!.push(pd)
  })

  // Find projects with multiple divisions
  const multiDivisionProjects = Array.from(projectMap.entries())
    .filter(([_, divisions]) => divisions.length > 1)
    .map(([projectId, divisions]) => ({
      projectId,
      project: divisions[0].project,
      divisionCount: divisions.length,
      divisions: divisions.map(d => d.division)
    }))

  if (multiDivisionProjects.length === 0) {
    console.log('No projects with multiple divisions found')
  } else {
    console.log('Projects with multiple divisions:')
    multiDivisionProjects.forEach(({ project, divisionCount, divisions }) => {
      console.log(`\n- ${project.name} (${project.job_number})`)
      console.log(`  Division count: ${divisionCount}`)
      console.log('  Divisions:')
      divisions.forEach(div => {
        console.log(`    - ${div.name} (${div.code})`)
      })
    })
  }

  // Show summary
  console.log('\n\nSummary:')
  console.log(`Total projects with divisions: ${projectMap.size}`)
  console.log(`Projects with single division: ${projectMap.size - multiDivisionProjects.length}`)
  console.log(`Projects with multiple divisions: ${multiDivisionProjects.length}`)
}

checkMultiDivisionProjects().catch(console.error)