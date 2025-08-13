#!/usr/bin/env node

const { Client } = require('pg');

const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

async function inspectSchema() {
  const client = new Client({ 
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Get all tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tables = await client.query(tablesQuery);
    console.log('=== Database Tables ===');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Get projects table structure
    console.log('\n=== Projects Table Columns ===');
    const projectsColumnsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    const projectsCols = await client.query(projectsColumnsQuery);
    projectsCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Sample projects data
    console.log('\n=== Sample Projects Data ===');
    const sampleQuery = `SELECT * FROM projects LIMIT 2`;
    const sampleData = await client.query(sampleQuery);
    console.log(JSON.stringify(sampleData.rows, null, 2));
    
    // Check for change_orders table
    console.log('\n=== Change Orders Table Columns ===');
    const coColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'change_orders'
      ORDER BY ordinal_position
    `;
    const coCols = await client.query(coColumnsQuery);
    if (coCols.rows.length > 0) {
      coCols.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('  Table not found');
    }
    
    // Check for labor tables
    console.log('\n=== Labor Tables ===');
    const laborTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%labor%'
      ORDER BY table_name
    `;
    const laborTables = await client.query(laborTablesQuery);
    laborTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check PO tables
    console.log('\n=== Purchase Order Tables ===');
    const poTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name LIKE '%po%' OR table_name LIKE '%purchase%')
      ORDER BY table_name
    `;
    const poTables = await client.query(poTablesQuery);
    poTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check budget tables
    console.log('\n=== Budget Tables ===');
    const budgetTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%budget%'
      ORDER BY table_name
    `;
    const budgetTables = await client.query(budgetTablesQuery);
    budgetTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

inspectSchema().catch(console.error);