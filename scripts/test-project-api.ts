import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testProjectAPI() {
  const projectId = '3ba3a326-eb94-4419-a7a8-ef7713225184'
  
  console.log('Testing project API endpoint simulation...\n')
  
  // Simulate the GET request from the API endpoint
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients!projects_client_id_fkey(id, name),
      division:divisions!projects_division_id_fkey(id, name, code),
      project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
      created_by_user:profiles!projects_created_by_fkey(id, first_name, last_name)
    `)
    .eq('id', projectId)
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return
  }

  console.log('Main project data:')
  console.log(JSON.stringify({
    id: project.id,
    name: project.name,
    job_number: project.job_number,
    division: project.division
  }, null, 2))

  // Fetch project divisions data
  const { data: projectDivisions } = await supabase
    .from('project_divisions')
    .select(`
      *,
      division:divisions!project_divisions_division_id_fkey(id, name, code),
      division_pm:profiles!project_divisions_division_pm_id_fkey(id, first_name, last_name, email)
    `)
    .eq('project_id', projectId)
    .order('is_lead_division', { ascending: false })

  console.log('\nProject divisions data:')
  console.log(JSON.stringify(projectDivisions, null, 2))

  // Add divisions to project object (as the API does)
  if (projectDivisions && projectDivisions.length > 0) {
    project.divisions = projectDivisions.map(pd => ({
      division_id: pd.division_id,
      division_name: pd.division?.name,
      division_code: pd.division?.code,
      is_lead_division: pd.is_lead_division,
      division_pm_id: pd.division_pm_id,
      division_pm_name: pd.division_pm ? `${pd.division_pm.first_name} ${pd.division_pm.last_name}` : null,
      budget_allocated: pd.budget_allocated
    }))
  }

  console.log('\nFinal project object with divisions:')
  console.log(JSON.stringify({
    id: project.id,
    name: project.name,
    job_number: project.job_number,
    division: project.division,
    divisions: project.divisions
  }, null, 2))
}

testProjectAPI().catch(console.error)