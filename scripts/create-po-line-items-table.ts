#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { Client } from 'pg'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const connectionString = process.env.POSTGRES_URL!

async function createTable() {
  const client = new Client({ 
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })
  
  try {
    await client.connect()
    console.log('Connected to database')
    
    // Check if table already exists
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_po_line_items'
      );
    `)
    
    if (checkResult.rows[0].exists) {
      console.log('Table project_po_line_items already exists')
      await client.end()
      return
    }
    
    console.log('Creating project_po_line_items table...')
    
    // Create the table
    await client.query(`
      CREATE TABLE public.project_po_line_items (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
          line_number INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by UUID REFERENCES public.profiles(id),
          CONSTRAINT project_po_line_items_project_line_unique UNIQUE(project_id, line_number)
      );
    `)
    console.log('Table created successfully')
    
    // Create indexes
    await client.query('CREATE INDEX idx_project_po_line_items_project_id ON public.project_po_line_items(project_id);')
    await client.query('CREATE INDEX idx_project_po_line_items_created_by ON public.project_po_line_items(created_by);')
    console.log('Indexes created')
    
    // Enable RLS
    await client.query('ALTER TABLE public.project_po_line_items ENABLE ROW LEVEL SECURITY;')
    console.log('RLS enabled')
    
    // Create RLS policies
    await client.query(`
      CREATE POLICY "Users can view PO line items for projects they have access to"
          ON public.project_po_line_items
          FOR SELECT
          USING (
              EXISTS (
                  SELECT 1 FROM public.projects p
                  WHERE p.id = project_po_line_items.project_id
                  AND (
                      p.project_manager_id = auth.uid()
                      OR p.superintendent_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.profiles pr
                          WHERE pr.id = auth.uid()
                          AND pr.role IN ('executive', 'controller', 'accounting')
                      )
                      OR EXISTS (
                          SELECT 1 FROM public.profiles pr
                          WHERE pr.id = auth.uid()
                          AND pr.role = 'ops_manager'
                          AND p.division_id = pr.division_id
                      )
                      OR EXISTS (
                          SELECT 1 FROM public.user_project_access upa
                          WHERE upa.user_id = auth.uid()
                          AND upa.project_id = p.id
                      )
                  )
              )
          );
    `)
    
    await client.query(`
      CREATE POLICY "Controllers and PMs can create PO line items"
          ON public.project_po_line_items
          FOR INSERT
          WITH CHECK (
              EXISTS (
                  SELECT 1 FROM public.projects p
                  WHERE p.id = project_po_line_items.project_id
                  AND (
                      EXISTS (
                          SELECT 1 FROM public.profiles pr
                          WHERE pr.id = auth.uid()
                          AND pr.role = 'controller'
                      )
                      OR p.project_manager_id = auth.uid()
                  )
              )
          );
    `)
    
    await client.query(`
      CREATE POLICY "Controllers and PMs can update PO line items"
          ON public.project_po_line_items
          FOR UPDATE
          USING (
              EXISTS (
                  SELECT 1 FROM public.projects p
                  WHERE p.id = project_po_line_items.project_id
                  AND (
                      EXISTS (
                          SELECT 1 FROM public.profiles pr
                          WHERE pr.id = auth.uid()
                          AND pr.role = 'controller'
                      )
                      OR p.project_manager_id = auth.uid()
                  )
              )
          );
    `)
    
    await client.query(`
      CREATE POLICY "Controllers can delete PO line items"
          ON public.project_po_line_items
          FOR DELETE
          USING (
              EXISTS (
                  SELECT 1 FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                  AND pr.role = 'controller'
              )
          );
    `)
    console.log('RLS policies created')
    
    // Create updated_at trigger
    await client.query(`
      CREATE TRIGGER update_project_po_line_items_updated_at
          BEFORE UPDATE ON public.project_po_line_items
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `)
    console.log('Trigger created')
    
    // Add comments
    await client.query(`
      COMMENT ON TABLE public.project_po_line_items IS 'Stores client PO line items for projects';
    `)
    await client.query(`
      COMMENT ON COLUMN public.project_po_line_items.line_number IS 'Line item number from client PO';
    `)
    await client.query(`
      COMMENT ON COLUMN public.project_po_line_items.description IS 'Description of work/service for this line item';
    `)
    await client.query(`
      COMMENT ON COLUMN public.project_po_line_items.amount IS 'Dollar amount for this line item';
    `)
    console.log('Comments added')
    
    console.log('✅ Table project_po_line_items created successfully!')
    
  } catch (error) {
    console.error('Error creating table:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

createTable()