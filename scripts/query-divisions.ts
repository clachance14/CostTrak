import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function queryDivisions() {
  console.log('Connecting to CostTrak database...')
  console.log('Database URL:', supabaseUrl)
  console.log()

  try {
    // Query divisions table
    const { data: divisions, error } = await supabase
      .from('divisions')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error querying divisions:', error)
      return
    }

    console.log(`Found ${divisions?.length || 0} divisions in the system:\n`)

    if (divisions && divisions.length > 0) {
      // Display divisions in a formatted table
      console.log('ID | Name | Description | Created At')
      console.log('---|------|-------------|------------')
      
      divisions.forEach(division => {
        const createdDate = new Date(division.created_at).toLocaleDateString()
        console.log(
          `${division.id} | ${division.name} | ${division.description || 'N/A'} | ${createdDate}`
        )
      })

      // Also show as JSON for complete data
      console.log('\nComplete division data (JSON):')
      console.log(JSON.stringify(divisions, null, 2))
    } else {
      console.log('No divisions found in the database.')
    }

    // Get count of projects per division
    console.log('\n\nProject count by division:')
    console.log('------------------------')
    
    for (const division of divisions || []) {
      const { count, error: countError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('division_id', division.id)
      
      if (!countError) {
        console.log(`${division.name}: ${count || 0} projects`)
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

// Run the query
queryDivisions()