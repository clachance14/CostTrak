#!/usr/bin/env node

/**
 * Push database migrations to remote Supabase instance
 * Fixed version with better error handling and IPv4 preference
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Check if we have pg installed
try {
  require.resolve('pg');
} catch (e) {
  console.error('pg package not found. Please install with: pnpm add -D pg');
  process.exit(1);
}

const { Client } = require('pg');
const dns = require('dns').promises;

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

async function getIPv4Address(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses[0];
  } catch (error) {
    console.error('Failed to resolve hostname to IPv4:', error.message);
    // Fallback to hostname
    return hostname;
  }
}

async function connectWithRetry(client, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      return true;
    } catch (error) {
      console.log(`Connection attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        console.log('Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
}

async function runMigrations() {
  try {
    console.log('Starting database migrations...\n');
    
    // Get IPv4 address
    const host = process.env.SUPABASE_DB_HOST;
    console.log('Resolving database host:', host);
    const ipv4Host = await getIPv4Address(host);
    console.log('Using host:', ipv4Host);
    
    // Database connection config with IPv4
    const client = new Client({
      host: ipv4Host,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
        // Force TLS 1.2
        minVersion: 'TLSv1.2'
      },
      // Connection timeout
      connectionTimeoutMillis: 10000,
      // Query timeout
      query_timeout: 30000,
    });

    console.log('Attempting to connect to database...');
    const connected = await connectWithRetry(client);
    
    if (!connected) {
      throw new Error('Failed to connect after multiple attempts');
    }
    
    console.log('✓ Connected successfully!\n');

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
    let appliedCount = 0;
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
        
        // Split SQL by semicolons but respect quotes and comments
        const statements = sql
          .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        // Execute each statement
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement + ';');
          }
        }
        
        // Record migration
        await client.query(
          'INSERT INTO public.schema_migrations (version) VALUES ($1)',
          [version]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`✓ ${migration} applied successfully`);
        appliedCount++;
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error(`✗ Error in ${migration}:`, error.message);
        
        // Log more details
        if (error.detail) console.error('Detail:', error.detail);
        if (error.hint) console.error('Hint:', error.hint);
        if (error.position) console.error('Position:', error.position);
        
        throw error;
      }
    }

    if (appliedCount === 0) {
      console.log('\n✓ All migrations were already applied!');
    } else {
      console.log(`\n✓ Successfully applied ${appliedCount} migration(s)!`);
    }
    
    // Show some stats
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\nDatabase contains ${tableResult.rows.length} tables:`);
    tableResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    await client.end();
    
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  Could not resolve database host.');
      console.error('Please check your SUPABASE_DB_HOST in .env.local');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Connection refused by database server.');
      console.error('Please check if the database is accessible from your network.');
    } else if (error.code === 'ENETUNREACH') {
      console.error('\n⚠️  Network unreachable.');
      console.error('This might be an IPv6 connectivity issue.');
      console.error('\nAlternative: Use the Supabase Dashboard SQL editor:');
      console.error(`https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.*)\.supabase/)[1]}/sql`);
    }
    
    process.exit(1);
  }
}

// Run migrations
runMigrations();