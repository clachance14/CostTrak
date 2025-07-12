#!/usr/bin/env node

/**
 * Verify that database migrations were applied successfully
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

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

const expectedTables = [
  'divisions',
  'clients', 
  'craft_types',
  'users',
  'auth_audit_log',
  'notifications',
  'projects',
  'change_orders',
  'audit_log',
  'financial_snapshots',
  'purchase_orders',
  'po_line_items',
  'labor_actuals',
  'labor_running_averages',
  'labor_headcount_forecasts',
  'documents'
];

async function verifyMigrations() {
  console.log('Verifying database migrations...\n');
  
  let successCount = 0;
  let missingTables = [];
  
  for (const table of expectedTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table} - Not found`);
        missingTables.push(table);
      } else {
        console.log(`✓ ${table} - Exists`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ ${table} - Error: ${err.message}`);
      missingTables.push(table);
    }
  }
  
  console.log(`\n Summary: ${successCount}/${expectedTables.length} tables found`);
  
  if (missingTables.length > 0) {
    console.log('\n⚠️  Missing tables:', missingTables.join(', '));
    console.log('\nPlease run the migrations first.');
  } else {
    console.log('\n✓ All tables exist! Migrations appear to be successful.');
    
    // Try to get some counts
    console.log('\nChecking seed data...');
    
    const checks = [
      { table: 'divisions', expected: 6 },
      { table: 'craft_types', expected: 13 },
      { table: 'clients', expected: 5 }
    ];
    
    for (const check of checks) {
      const { count } = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true });
      
      console.log(`- ${check.table}: ${count || 0} records (expected: ${check.expected})`);
    }
  }
}

verifyMigrations().catch(console.error);