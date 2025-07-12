#!/usr/bin/env node

/**
 * Push database migrations to remote Supabase instance
 * Uses direct PostgreSQL connection via pg library
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Check if we have pg installed
try {
  require.resolve('pg');
} catch (e) {
  console.error('pg package not found. Installing...');
  require('child_process').execSync('npm install pg', { stdio: 'inherit' });
}

const { Client } = require('pg');

// Debug environment
console.log('Database host:', process.env.SUPABASE_DB_HOST);

// Database connection config
const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

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
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const result = await client.query('SELECT version FROM public.schema_migrations');
    const appliedMigrations = new Set(result.rows.map(row => row.version));

    // Run each migration
    for (const migration of migrations) {
      const version = migration.replace('.sql', '');
      
      if (appliedMigrations.has(version)) {
        console.log(`✓ Skipping ${migration} (already applied)`);
        continue;
      }

      console.log(`→ Running ${migration}...`);
      
      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migration);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        // Begin transaction
        await client.query('BEGIN');
        
        // Run migration
        await client.query(sql);
        
        // Record migration
        await client.query(
          'INSERT INTO public.schema_migrations (version) VALUES ($1)',
          [version]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`✓ ${migration} applied successfully`);
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error(`✗ Error in ${migration}:`, error.message);
        throw error;
      }
    }

    console.log('\n✓ All migrations completed successfully!');
    
    // Show some stats
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\nCreated ${tableResult.rows.length} tables:`);
    tableResult.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations();