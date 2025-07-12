#!/usr/bin/env node

/**
 * Test connection to new Supabase database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('Testing connection to new Supabase database...\n');
  
  console.log('Project URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Project ID:', process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.*)\.supabase/)[1]);
  console.log('Database Host:', process.env.SUPABASE_DB_HOST);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test basic connection
    console.log('\n1. Testing Supabase client connection...');
    const { data, error } = await supabase.from('test').select('*').limit(1);
    
    if (error && error.code !== '42P01') { // 42P01 = table does not exist
      console.log('❌ Connection failed:', error.message);
      return;
    }
    
    console.log('✅ Supabase client connected successfully!');
    
    // Check if any tables exist
    console.log('\n2. Checking for existing tables...');
    const { data: tables } = await supabase.rpc('get_tables', {}).catch(() => ({ data: null }));
    
    if (!tables) {
      console.log('ℹ️  No tables found (expected for fresh database)');
      console.log('   Run migrations to create tables');
    }
    
    console.log('\n✅ Connection test successful!');
    console.log('\nNext steps:');
    console.log('1. Run database migrations');
    console.log('2. Create admin user');
    console.log('3. Start the application');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();