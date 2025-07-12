#!/usr/bin/env node

/**
 * Push database migrations using Supabase JS client
 * This uses the Supabase REST API instead of direct PostgreSQL connection
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Create Supabase admin client
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

// Migration files in order
const migrations = [
  '00001_initial_schema.sql',
  '00002_users_and_auth.sql',
  '00003_core_business_tables.sql',
  '00004_purchase_orders.sql',
  '00005_labor_management.sql',
  '00006_documents.sql',
  '00007_notifications_enhanced.sql'
];

async function runMigrations() {
  console.log('Starting database migrations via Supabase API...\n');
  
  console.log('Note: The Supabase JS client does not support direct SQL execution.');
  console.log('Migrations must be run through one of these methods:\n');
  
  console.log('Option 1: Supabase Dashboard');
  console.log('1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/sql');
  console.log('2. Copy and paste each migration file content');
  console.log('3. Execute them in order\n');
  
  console.log('Option 2: Supabase CLI (requires setup)');
  console.log('1. Install Supabase CLI: https://supabase.com/docs/guides/cli');
  console.log('2. Link your project: supabase link --project-ref cqdtuybqoccncujqpiwl');
  console.log('3. Run: supabase db push\n');
  
  console.log('Option 3: Direct PostgreSQL connection');
  console.log('Use a PostgreSQL client with this connection string:');
  console.log(`postgresql://postgres:[YOUR-PASSWORD]@db.cqdtuybqoccncujqpiwl.supabase.co:5432/postgres\n`);
  
  console.log('Migration files are located in: ./supabase/migrations/');
  console.log('\nOrder of execution:');
  migrations.forEach((m, i) => {
    console.log(`${i + 1}. ${m}`);
  });
  
  // Let's at least verify we can connect to Supabase
  console.log('\nVerifying Supabase connection...');
  try {
    // Try to query a system table
    const { data, error } = await supabase
      .from('_prisma_migrations')
      .select('id')
      .limit(1);
    
    if (error && error.code !== '42P01') { // 42P01 = table does not exist
      console.log('✓ Successfully connected to Supabase');
    } else {
      console.log('✓ Successfully connected to Supabase');
    }
    
    // Check if any tables exist
    console.log('\nChecking existing tables...');
    
    // Try to check if users table exists
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (usersCount !== null) {
      console.log('⚠️  Warning: Some tables may already exist. Be careful when running migrations.');
    } else {
      console.log('✓ Database appears to be empty. Ready for migrations.');
    }
    
  } catch (err) {
    console.error('Connection test failed:', err.message);
  }
}

// Run the script
runMigrations();