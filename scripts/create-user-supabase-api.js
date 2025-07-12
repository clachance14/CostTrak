#!/usr/bin/env node

/**
 * Create user using Supabase Admin API
 * This is the most reliable way to create a user with a known password
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create admin client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createOrUpdateUser() {
  console.log('Creating/updating user clachance@ics.ac...\n');

  try {
    // First, try to get existing user
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (searchError) {
      console.error('Error searching for users:', searchError);
      return;
    }

    const existingUser = existingUsers?.users?.find(u => u.email === 'clachance@ics.ac');

    if (existingUser) {
      console.log('User already exists. Updating password...');
      
      // Update existing user's password
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: 'TempPassword123!',
          email_confirm: true
        }
      );

      if (updateError) {
        console.error('Error updating user:', updateError);
        return;
      }

      console.log('✅ Password updated successfully!');
      console.log('User ID:', existingUser.id);
    } else {
      console.log('Creating new user...');
      
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'clachance@ics.ac',
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {}
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return;
      }

      console.log('✅ User created successfully!');
      console.log('User ID:', newUser.user.id);
      
      // Create profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: newUser.user.id,
          email: 'clachance@ics.ac',
          first_name: 'C',
          last_name: 'Lachance',
          role: 'controller',
          is_active: true,
          title: 'System Administrator'
        });

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key error
        console.error('Error creating profile:', profileError);
      } else {
        console.log('✅ Profile created successfully!');
      }
    }

    // Ensure profile exists and has correct role
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: existingUser?.id || newUser?.user?.id,
        email: 'clachance@ics.ac',
        first_name: 'C',
        last_name: 'Lachance',
        role: 'controller',
        is_active: true,
        title: 'System Administrator',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (upsertError) {
      console.error('Error updating profile:', upsertError);
    }

    console.log('\n✅ Setup complete!');
    console.log('\nLogin credentials:');
    console.log('Email: clachance@ics.ac');
    console.log('Password: TempPassword123!');
    console.log('Role: Controller (unlimited access)');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
createOrUpdateUser();