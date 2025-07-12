#!/usr/bin/env node

/**
 * Combine all migration files into a single SQL file
 * This makes it easier to run all migrations at once in Supabase Dashboard
 */

const fs = require('fs');
const path = require('path');

const migrations = [
  '00001_initial_schema.sql',
  '00002_users_and_auth.sql',
  '00003_core_business_tables.sql',
  '00004_purchase_orders.sql',
  '00005_labor_management.sql',
  '00006_documents.sql',
  '00007_notifications_enhanced.sql'
];

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.join(migrationsDir, 'all_migrations_combined.sql');

let combinedSQL = `-- CostTrak Database Schema
-- Combined migrations file generated on ${new Date().toISOString()}
-- Run this file in Supabase SQL Editor to create all tables

`;

// Add migration tracking table
combinedSQL += `-- Create migration tracking table
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

`;

// Process each migration
migrations.forEach((migration, index) => {
  const migrationPath = path.join(migrationsDir, migration);
  const content = fs.readFileSync(migrationPath, 'utf8');
  
  combinedSQL += `
-- ============================================================================
-- Migration: ${migration}
-- ============================================================================

`;
  
  combinedSQL += content;
  
  // Add migration tracking insert
  combinedSQL += `
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('${migration.replace('.sql', '')}')
ON CONFLICT (version) DO NOTHING;

`;
});

// Write combined file
fs.writeFileSync(outputFile, combinedSQL);

console.log(`✓ Combined all migrations into: ${outputFile}`);
console.log(`\nFile size: ${(combinedSQL.length / 1024).toFixed(2)} KB`);
console.log(`\nTo run the migrations:`);
console.log(`1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/sql`);
console.log(`2. Copy the contents of: supabase/migrations/all_migrations_combined.sql`);
console.log(`3. Paste into the SQL editor and click "Run"`);
console.log(`\nAlternatively, you can run each migration file individually in order.`);