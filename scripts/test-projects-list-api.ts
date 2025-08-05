import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testProjectsListAPI() {
  console.log('Testing projects list API endpoint simulation...\n')

  // Simulate the projects list query
  const { data: projects, error, count } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients!projects_client_id_fkey(id, name),
      division:divisions!projects_division_id_fkey(id, name, code),
      project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching projects:', error)
    return
  }

  console.log(`Found ${count} total projects. Showing first 5:\n`)

  // Fetch division counts for each project
  if (projects && projects.length > 0) {
    const projectIds = projects.map(p => p.id)
    const { data: divisionCounts } = await supabase
      .from('project_divisions')
      .select('project_id')
      .in('project_id', projectIds)

    // Count divisions per project
    const divisionCountMap = new Map<string, number>()
    divisionCounts?.forEach(pd => {
      divisionCountMap.set(pd.project_id, (divisionCountMap.get(pd.project_id) || 0) + 1)
    })

    // Add division count to each project
    projects.forEach(project => {
      (project as any).division_count = divisionCountMap.get(project.id) || 1
    })

    // Display projects with division info
    projects.forEach(project => {
      console.log(`Project: ${project.name} (${project.job_number})`)
      console.log(`  Primary Division: ${project.division?.name || 'None'}`)
      console.log(`  Total Divisions: ${(project as any).division_count}`)
      console.log('')
    })
  }
}

testProjectsListAPI().catch(console.error)