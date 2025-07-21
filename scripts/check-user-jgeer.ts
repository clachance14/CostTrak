import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUser() {
  const email = 'jgeer@ics.ac'
  
  console.log(`\n=== Checking user: ${email} ===`)
  console.log(`Connected to: ${supabaseUrl}\n`)

  // 1. Check if user exists in auth.users
  console.log('1. Checking auth.users table...')
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById
  
  // Get user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }
  
  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.log(`❌ User ${email} NOT FOUND in auth.users`)
    console.log('   This user needs to be created first!')
    return
  }
  
  console.log(`✅ User found in auth.users:`)
  console.log(`   - ID: ${user.id}`)
  console.log(`   - Email: ${user.email}`)
  console.log(`   - Email confirmed: ${user.email_confirmed_at ? 'YES ✅' : 'NO ❌'}`)
  console.log(`   - Confirmed at: ${user.email_confirmed_at || 'Not confirmed'}`)
  console.log(`   - Created at: ${user.created_at}`)
  console.log(`   - Last sign in: ${user.last_sign_in_at || 'Never'}`)
  console.log(`   - Phone: ${user.phone || 'None'}`)
  
  // 2. Check if user has a profile
  console.log('\n2. Checking profiles table...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
    
  if (profileError || !profile) {
    console.log(`❌ Profile NOT FOUND for user ${email}`)
    console.log('   This is likely why login fails!')
    console.log('\n   To fix: Create a profile record with:')
    console.log(`   - id: ${user.id}`)
    console.log(`   - email: ${user.email}`)
    console.log(`   - role: (choose from: controller, executive, ops_manager, project_manager, accounting, viewer)`)
    console.log(`   - full_name: (user's full name)`)
    
    // Show SQL to fix
    console.log('\n   SQL to create profile:')
    console.log(`   INSERT INTO public.profiles (id, email, full_name, role)`)
    console.log(`   VALUES ('${user.id}', '${user.email}', 'Joe Geer', 'project_manager');`)
  } else {
    console.log(`✅ Profile found:`)
    console.log(`   - Full name: ${profile.full_name}`)
    console.log(`   - Role: ${profile.role}`)
    console.log(`   - Division: ${profile.division_id || 'None'}`)
    console.log(`   - Created: ${profile.created_at}`)
    console.log(`   - Updated: ${profile.updated_at}`)
  }
  
  // 3. Check for any project assignments (if profile exists and is PM)
  if (profile && profile.role === 'project_manager') {
    console.log('\n3. Checking project assignments...')
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name, job_number')
      .eq('project_manager_id', user.id)
      
    if (projects && projects.length > 0) {
      console.log(`✅ Assigned to ${projects.length} project(s):`)
      projects.forEach(p => {
        console.log(`   - ${p.name} (Job #${p.job_number})`)
      })
    } else {
      console.log('   No projects assigned')
    }
  }
  
  // 4. Summary
  console.log('\n=== SUMMARY ===')
  if (!user.email_confirmed_at) {
    console.log('❌ Email not confirmed - user cannot log in!')
    console.log('   Fix: Confirm email in Supabase dashboard or resend confirmation')
  } else if (!profile) {
    console.log('❌ Profile missing - user cannot access app!')
    console.log('   Fix: Run the INSERT statement shown above')
  } else {
    console.log('✅ User setup looks correct')
    console.log('   - Email confirmed: YES')
    console.log('   - Profile exists: YES')
    console.log('   If login still fails, check:')
    console.log('   - Password is correct')
    console.log('   - No typos in email')
    console.log('   - Browser console for errors')
  }
}

checkUser().catch(console.error)