#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

// User roles
const roles = ['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer']

async function addUser() {
  try {
    console.log('\n=== Add New User to CostTrak ===\n')

    // Get user details
    const email = await question('Email (must end with @ics.ac): ')
    
    // Validate email domain
    if (!email.endsWith('@ics.ac')) {
      console.error('Error: Email must end with @ics.ac')
      process.exit(1)
    }

    const password = await question('Password: ')
    const firstName = await question('First Name: ')
    const lastName = await question('Last Name: ')
    
    console.log('\nAvailable roles:')
    roles.forEach((role, index) => {
      console.log(`${index + 1}. ${role}`)
    })
    
    const roleIndex = parseInt(await question('\nSelect role (1-6): ')) - 1
    if (roleIndex < 0 || roleIndex >= roles.length) {
      console.error('Invalid role selection')
      process.exit(1)
    }
    const role = roles[roleIndex]

    const title = await question('Title (optional): ') || null
    const phone = await question('Phone (optional): ') || null

    let divisionId = null
    if (role === 'ops_manager') {
      // Get divisions for ops manager
      const { data: divisions, error: divError } = await supabase
        .from('divisions')
        .select('id, name')
        .order('name')

      if (divError) {
        console.error('Error fetching divisions:', divError.message)
      } else if (divisions && divisions.length > 0) {
        console.log('\nAvailable divisions:')
        divisions.forEach((div, index) => {
          console.log(`${index + 1}. ${div.name}`)
        })
        
        const divIndex = parseInt(await question('\nSelect division (1-' + divisions.length + '): ')) - 1
        if (divIndex >= 0 && divIndex < divisions.length) {
          divisionId = divisions[divIndex].id
        }
      }
    }

    console.log('\n--- Creating user... ---')

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError.message)
      process.exit(1)
    }

    console.log('✓ Auth user created successfully')

    // Step 2: Create or update profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role,
        division_id: divisionId,
        title: title,
        phone: phone,
        is_active: true
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError.message)
      
      // Try to clean up auth user if profile creation failed
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.log('Cleaned up auth user due to profile creation failure')
      process.exit(1)
    }

    console.log('✓ Profile created successfully')
    console.log('\n=== User created successfully! ===')
    console.log(`Email: ${email}`)
    console.log(`Name: ${firstName} ${lastName}`)
    console.log(`Role: ${role}`)
    if (title) console.log(`Title: ${title}`)
    if (divisionId) console.log(`Division assigned`)
    console.log('\nThe user can now log in with their email and password.')

  } catch (error) {
    console.error('Unexpected error:', error)
  } finally {
    rl.close()
  }
}

// Run the script
addUser()