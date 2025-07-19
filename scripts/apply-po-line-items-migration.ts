#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function applyMigration() {
  console.log('Applying project_po_line_items migration...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250719_001_add_project_po_line_items.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')
  
  try {
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration applied successfully!')
    
    // Verify the table was created
    const { data, error: queryError } = await supabase
      .from('project_po_line_items')
      .select('*')
      .limit(1)
    
    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 means table is empty, which is expected
      console.error('Table verification failed:', queryError)
      process.exit(1)
    }
    
    console.log('Table project_po_line_items created successfully!')
    
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

applyMigration()