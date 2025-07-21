import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function checkUserMapping() {
  const userId = '94f1d795-6758-4017-9bff-bdd219472905'
  
  console.log(`\n🔍 Looking up user with ID: ${userId}\n`)

  // Check profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (profileError) {
    console.error('Error fetching profile:', profileError)
  } else if (profile) {
    console.log('User Profile Found:')
    console.log('  Name:', profile.full_name)
    console.log('  Email:', profile.email)
    console.log('  Role:', profile.role)
    console.log('  Division ID:', profile.division_id)
  }

  // Check which division that division_id corresponds to
  if (profile?.division_id) {
    const { data: division, error: divError } = await supabase
      .from('divisions')
      .select('*')
      .eq('id', profile.division_id)
      .single()
    
    if (!divError && division) {
      console.log('\nUser\'s Division:')
      console.log('  Division Name:', division.name)
      console.log('  Division ID:', division.id)
    }
  }
}

checkUserMapping()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })