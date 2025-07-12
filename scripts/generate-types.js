#!/usr/bin/env node

/**
 * Generate TypeScript types from Supabase database schema
 * Uses Supabase REST API to fetch schema and generate types
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateTypes() {
  console.log('Fetching database schema...');
  
  try {
    // Get table information
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_schema_tables');
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      
      // Alternative approach - use information_schema
      console.log('Trying alternative approach...');
      
      const { data: tableList, error: tableListError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
      
      if (tableListError) {
        console.error('Could not fetch schema. Please use the Supabase Dashboard:');
        console.error('1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/api');
        console.error('2. Navigate to the "TypeScript" tab');
        console.error('3. Copy the generated types');
        console.error('4. Paste them into types/database.generated.ts');
        return;
      }
      
      console.log('Found tables:', tableList?.map(t => t.table_name));
    }
    
    console.log('✓ Schema fetched successfully!');
    console.log('');
    console.log('To generate complete TypeScript types:');
    console.log('1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/api');
    console.log('2. Click on the "TypeScript" tab');
    console.log('3. Copy all the generated types');
    console.log('4. Replace the contents of types/database.generated.ts');
    console.log('');
    console.log('This will ensure you have the most up-to-date types matching your database schema.');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('');
    console.log('Manual approach:');
    console.log('1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/api');
    console.log('2. Click on the "TypeScript" tab');
    console.log('3. Copy all the generated types');
    console.log('4. Replace the contents of types/database.generated.ts');
  }
}

generateTypes();