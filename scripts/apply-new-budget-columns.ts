#!/usr/bin/env tsx
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Use environment variable for NODE_TLS_REJECT_UNAUTHORIZED
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const connectionString = `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

const pool = new Pool({
  connectionString,
  ssl: true
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Starting to add new budget columns...')
    
    // Check current column structure
    const checkQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'budget_line_items'
      AND column_name LIKE '%cost%'
      ORDER BY ordinal_position
    `
    
    const currentColumns = await client.query(checkQuery)
    console.log('\n📊 Current cost columns in budget_line_items:')
    currentColumns.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    // Check if new columns already exist
    const hasNewColumns = currentColumns.rows.some(row => 
      ['labor_direct_cost', 'labor_indirect_cost', 'labor_staff_cost'].includes(row.column_name)
    )
    
    if (hasNewColumns) {
      console.log('\n✅ New columns already exist - schema is up to date!')
      return
    }
    
    console.log('\n📝 Adding new budget columns...')
    
    // Add new columns if they don't exist
    const addColumnQueries = [
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS labor_direct_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS labor_indirect_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS labor_staff_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS materials_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS equipment_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS subcontracts_cost numeric DEFAULT 0`,
      `ALTER TABLE public.budget_line_items ADD COLUMN IF NOT EXISTS small_tools_cost numeric DEFAULT 0`
    ]
    
    for (const query of addColumnQueries) {
      try {
        await client.query(query)
        console.log(`   ✅ ${query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1]} added`)
      } catch (err: any) {
        console.log(`   ⚠️  ${err.message}`)
      }
    }
    
    // Migrate data from old columns to new columns
    console.log('\n📊 Migrating data from old columns to new columns...')
    
    const migrationQuery = `
      UPDATE public.budget_line_items SET
        labor_direct_cost = CASE 
          WHEN category = 'LABOR' AND subcategory = 'DIRECT' THEN COALESCE(labor_cost, 0)
          ELSE 0 
        END,
        labor_indirect_cost = CASE 
          WHEN category = 'LABOR' AND subcategory = 'INDIRECT' THEN COALESCE(labor_cost, 0)
          ELSE 0 
        END,
        labor_staff_cost = CASE 
          WHEN category = 'LABOR' AND subcategory = 'STAFF' THEN COALESCE(labor_cost, 0)
          ELSE 0 
        END,
        materials_cost = COALESCE(material_cost, 0),
        equipment_cost = COALESCE(equipment_cost, 0),
        subcontracts_cost = COALESCE(subcontract_cost, 0),
        small_tools_cost = COALESCE(other_cost, 0)
      WHERE labor_direct_cost = 0 
        AND labor_indirect_cost = 0 
        AND labor_staff_cost = 0
        AND materials_cost = 0
        AND equipment_cost = 0
        AND subcontracts_cost = 0
        AND small_tools_cost = 0
    `
    
    const result = await client.query(migrationQuery)
    console.log(`   ✅ Migrated data for ${result.rowCount} rows`)
    
    // Add the same columns to projects table
    console.log('\n📝 Adding budget columns to projects table...')
    
    const projectColumnQueries = [
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS labor_direct_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS labor_indirect_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS labor_staff_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS materials_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS equipment_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS subcontracts_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS small_tools_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS total_labor_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS total_non_labor_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS total_budget numeric DEFAULT 0`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_imported_at timestamptz`,
      `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_imported_by uuid`
    ]
    
    for (const query of projectColumnQueries) {
      try {
        await client.query(query)
        console.log(`   ✅ ${query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1]} added to projects`)
      } catch (err: any) {
        console.log(`   ⚠️  ${err.message}`)
      }
    }
    
    // Verify final structure
    const verifyColumns = await client.query(checkQuery)
    console.log('\n📊 Final cost columns in budget_line_items:')
    verifyColumns.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    console.log('\n🎉 Migration completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})