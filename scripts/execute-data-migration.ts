#!/usr/bin/env tsx

/**
 * Execute Data Migration
 * 
 * This script runs the data migration SQL statements
 * to populate the multi-division tables
 */

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Client } = pg

// Database connection
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

async function executeMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔄 Connecting to database...')
    await client.connect()
    console.log('✅ Connected!\n')

    // Start transaction
    await client.query('BEGIN')

    // 1. Migrate projects to project_divisions
    console.log('📋 Step 1: Migrating projects to project_divisions...')
    const projectResult = await client.query(`
      INSERT INTO project_divisions (
        project_id, 
        division_id, 
        division_pm_id,
        is_lead_division, 
        budget_allocated,
        created_by,
        created_at
      )
      SELECT 
        p.id as project_id,
        p.division_id,
        p.project_manager_id as division_pm_id,
        true as is_lead_division,
        COALESCE(p.original_contract_amount, 0) as budget_allocated,
        p.created_by,
        p.created_at
      FROM projects p
      WHERE p.division_id IS NOT NULL
        AND p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_divisions pd 
          WHERE pd.project_id = p.id 
          AND pd.division_id = p.division_id
        )
    `)
    console.log(`   ✅ Migrated ${projectResult.rowCount} projects`)

    // 2. Create discipline mappings
    console.log('\n📋 Step 2: Creating discipline mappings...')
    
    // Get a valid user ID for created_by
    const userResult = await client.query(`
      SELECT id FROM profiles WHERE email LIKE '%@ics.ac' LIMIT 1
    `)
    const userId = userResult.rows[0]?.id || null

    const mappingResult = await client.query(`
      INSERT INTO division_discipline_mapping (division_id, discipline_name, created_by)
      SELECT 
        d.id,
        disc.discipline,
        $1
      FROM (
        SELECT DISTINCT discipline 
        FROM project_budget_breakdowns 
        WHERE discipline IS NOT NULL
      ) disc
      CROSS JOIN divisions d
      WHERE (
        -- Electrical disciplines to I&E
        (LOWER(disc.discipline) LIKE '%electric%' OR 
         LOWER(disc.discipline) LIKE '%instrument%' OR
         LOWER(disc.discipline) IN ('i&e', 'i & e', 'instrumentation'))
        AND d.code = 'I&E'
      ) OR (
        -- Civil disciplines to Civil
        (LOWER(disc.discipline) LIKE '%civil%' OR 
         LOWER(disc.discipline) LIKE '%concrete%' OR
         LOWER(disc.discipline) LIKE '%grout%')
        AND d.code = 'CIV'
      ) OR (
        -- Everything else to Mechanical
        (LOWER(disc.discipline) NOT LIKE '%electric%' AND 
         LOWER(disc.discipline) NOT LIKE '%instrument%' AND
         LOWER(disc.discipline) NOT LIKE '%civil%' AND
         LOWER(disc.discipline) NOT LIKE '%concrete%' AND
         LOWER(disc.discipline) NOT LIKE '%grout%')
        AND d.code = 'MEC'
      )
      ON CONFLICT (discipline_name) DO NOTHING
    `, [userId])
    console.log(`   ✅ Created ${mappingResult.rowCount} discipline mappings`)

    // 3. Map craft types to divisions
    console.log('\n📋 Step 3: Mapping craft types to divisions...')
    
    // Get division IDs
    const divisionResult = await client.query(`
      SELECT id, code FROM divisions WHERE code IN ('MEC', 'I&E', 'CIV')
    `)
    const divisions = divisionResult.rows.reduce((acc, row) => {
      acc[row.code] = row.id
      return acc
    }, {})

    // Map electrical craft types to I&E
    const elecResult = await client.query(`
      INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
      SELECT id, $1, true
      FROM craft_types
      WHERE LOWER(name) LIKE '%electric%' 
         OR LOWER(name) LIKE '%instrument%'
         OR code IN ('ELEC', 'INST', 'IE')
      ON CONFLICT (craft_type_id, division_id) DO NOTHING
    `, [divisions['I&E']])
    
    // Map civil craft types
    const civilResult = await client.query(`
      INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
      SELECT id, $1, true
      FROM craft_types
      WHERE LOWER(name) LIKE '%civil%'
         OR LOWER(name) LIKE '%concrete%'
         OR LOWER(name) LIKE '%grout%'
         OR code IN ('CIV', 'CONC')
      ON CONFLICT (craft_type_id, division_id) DO NOTHING
    `, [divisions['CIV']])
    
    // Map remaining to Mechanical
    const mechResult = await client.query(`
      INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
      SELECT ct.id, $1, true
      FROM craft_types ct
      WHERE NOT EXISTS (
        SELECT 1 FROM craft_type_divisions ctd 
        WHERE ctd.craft_type_id = ct.id
      )
      AND ct.code NOT IN ('DIRECT', 'INDIRECT', 'STAFF')
      ON CONFLICT (craft_type_id, division_id) DO NOTHING
    `, [divisions['MEC']])
    
    console.log(`   ✅ Mapped ${elecResult.rowCount + civilResult.rowCount + mechResult.rowCount} craft types`)

    // 4. Create division budgets
    console.log('\n📋 Step 4: Creating division budgets...')
    const budgetResult = await client.query(`
      WITH budget_aggregates AS (
        SELECT 
          pbb.project_id,
          ddm.division_id,
          SUM(CASE WHEN pbb.cost_type = 'Labor' THEN pbb.value ELSE 0 END) as labor_budget,
          SUM(CASE WHEN pbb.cost_type = 'Materials' THEN pbb.value ELSE 0 END) as materials_budget,
          SUM(CASE WHEN pbb.cost_type = 'Equipment' THEN pbb.value ELSE 0 END) as equipment_budget,
          SUM(CASE WHEN pbb.cost_type = 'Subcontracts' THEN pbb.value ELSE 0 END) as subcontracts_budget,
          SUM(CASE WHEN pbb.cost_type NOT IN ('Labor', 'Materials', 'Equipment', 'Subcontracts') 
               THEN pbb.value ELSE 0 END) as other_budget,
          MIN(pbb.created_by) as created_by,
          MIN(pbb.created_at) as created_at
        FROM project_budget_breakdowns pbb
        INNER JOIN division_discipline_mapping ddm ON ddm.discipline_name = pbb.discipline
        INNER JOIN project_divisions pd ON pd.project_id = pbb.project_id AND pd.division_id = ddm.division_id
        GROUP BY pbb.project_id, ddm.division_id
      )
      INSERT INTO division_budgets (
        project_id,
        division_id,
        labor_budget,
        materials_budget,
        equipment_budget,
        subcontracts_budget,
        other_budget,
        created_by,
        created_at
      )
      SELECT * FROM budget_aggregates
      WHERE NOT EXISTS (
        SELECT 1 FROM division_budgets db
        WHERE db.project_id = budget_aggregates.project_id
          AND db.division_id = budget_aggregates.division_id
      )
    `)
    console.log(`   ✅ Created ${budgetResult.rowCount} division budgets`)

    // 5. Assign POs to divisions
    console.log('\n📋 Step 5: Assigning purchase orders to divisions...')
    const poResult = await client.query(`
      UPDATE purchase_orders po
      SET division_id = pd.division_id
      FROM project_divisions pd
      WHERE po.project_id = pd.project_id
        AND pd.is_lead_division = true
        AND po.division_id IS NULL
    `)
    console.log(`   ✅ Updated ${poResult.rowCount} purchase orders`)

    // 6. Assign labor to divisions
    console.log('\n📋 Step 6: Assigning labor records to divisions...')
    const laborResult = await client.query(`
      UPDATE labor_actuals la
      SET division_id = ctd.division_id
      FROM craft_type_divisions ctd
      WHERE la.craft_type_id = ctd.craft_type_id
      AND ctd.is_primary = true
      AND la.division_id IS NULL
    `)
    console.log(`   ✅ Updated ${laborResult.rowCount} labor records`)

    // Commit transaction
    await client.query('COMMIT')
    console.log('\n✅ Migration completed successfully!')

    // Show summary
    console.log('\n📊 Migration Summary:')
    const summaryResult = await client.query(`
      SELECT 
        (SELECT COUNT(DISTINCT project_id) FROM project_divisions) as projects_with_divisions,
        (SELECT COUNT(*) FROM division_budgets) as division_budgets,
        (SELECT COUNT(*) FROM purchase_orders WHERE division_id IS NOT NULL) as pos_with_divisions,
        (SELECT COUNT(*) FROM labor_actuals WHERE division_id IS NOT NULL) as labor_with_divisions
    `)
    
    const summary = summaryResult.rows[0]
    console.log(`   Projects with divisions: ${summary.projects_with_divisions}`)
    console.log(`   Division budgets: ${summary.division_budgets}`)
    console.log(`   POs with divisions: ${summary.pos_with_divisions}`)
    console.log(`   Labor with divisions: ${summary.labor_with_divisions}`)

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await client.end()
  }
}

// Run the migration
executeMigration()
  .then(() => {
    console.log('\n🎉 Migration complete! Run validation script to verify:')
    console.log('   npx tsx scripts/validate-division-migration.ts')
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })