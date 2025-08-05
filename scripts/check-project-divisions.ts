import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkProjectDivisions() {
  console.log('Checking project_divisions for project 5800...\n')

  // First, find the project ID for job_number 5800
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, job_number, division_id')
    .eq('job_number', '5800')
    .single()

  if (projectError) {
    console.error('Error finding project:', projectError)
    return
  }

  console.log('Project found:')
  console.log(JSON.stringify(project, null, 2))
  console.log('\n')

  // Check if project_divisions table exists and has data for this project
  const { data: projectDivisions, error: divError } = await supabase
    .from('project_divisions')
    .select(`
      *,
      division:divisions(*)
    `)
    .eq('project_id', project.id)

  if (divError) {
    console.error('Error querying project_divisions:', divError)
    console.log('\nThis might mean the project_divisions table does not exist.')
  } else {
    console.log('Project divisions found:')
    console.log(JSON.stringify(projectDivisions, null, 2))
  }

  // Also check all divisions table
  console.log('\n\nAll divisions in the system:')
  const { data: allDivisions } = await supabase
    .from('divisions')
    .select('*')
    .order('name')

  console.log(JSON.stringify(allDivisions, null, 2))
}

checkProjectDivisions().catch(console.error)