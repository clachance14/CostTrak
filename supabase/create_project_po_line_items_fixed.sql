-- Create project_po_line_items table for storing client PO line items
-- Run this in the Supabase Dashboard SQL Editor

-- Check if table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'project_po_line_items'
  ) THEN
    -- Create table
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
    
    -- Create indexes
    CREATE INDEX idx_project_po_line_items_project_id ON public.project_po_line_items(project_id);
    CREATE INDEX idx_project_po_line_items_created_by ON public.project_po_line_items(created_by);
    
    -- Enable RLS
    ALTER TABLE public.project_po_line_items ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies
    CREATE POLICY "Users can view PO line items for projects they have access to"
        ON public.project_po_line_items
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_po_line_items.project_id
                AND (
                    -- Project managers can see their projects
                    p.project_manager_id = auth.uid()
                    -- Superintendents can see their projects
                    OR p.superintendent_id = auth.uid()
                    -- Executives, Controllers, and Accounting can see all
                    OR EXISTS (
                        SELECT 1 FROM public.profiles pr
                        WHERE pr.id = auth.uid()
                        AND pr.role IN ('executive', 'controller', 'accounting')
                    )
                    -- Ops managers can see their division's projects
                    OR EXISTS (
                        SELECT 1 FROM public.profiles pr
                        WHERE pr.id = auth.uid()
                        AND pr.role = 'ops_manager'
                        AND p.division_id = pr.division_id
                    )
                )
            )
        );
    
    CREATE POLICY "Controllers and PMs can create PO line items"
        ON public.project_po_line_items
        FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_po_line_items.project_id
                AND (
                    -- Controllers can create for any project
                    EXISTS (
                        SELECT 1 FROM public.profiles pr
                        WHERE pr.id = auth.uid()
                        AND pr.role = 'controller'
                    )
                    -- Project managers can create for their projects
                    OR p.project_manager_id = auth.uid()
                )
            )
        );
    
    CREATE POLICY "Controllers and PMs can update PO line items"
        ON public.project_po_line_items
        FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_po_line_items.project_id
                AND (
                    -- Controllers can update for any project
                    EXISTS (
                        SELECT 1 FROM public.profiles pr
                        WHERE pr.id = auth.uid()
                        AND pr.role = 'controller'
                    )
                    -- Project managers can update for their projects
                    OR p.project_manager_id = auth.uid()
                )
            )
        );
    
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
    
    -- Create updated_at trigger
    CREATE TRIGGER update_project_po_line_items_updated_at
        BEFORE UPDATE ON public.project_po_line_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    
    -- Add comments
    COMMENT ON TABLE public.project_po_line_items IS 'Stores client PO line items for projects';
    COMMENT ON COLUMN public.project_po_line_items.line_number IS 'Line item number from client PO';
    COMMENT ON COLUMN public.project_po_line_items.description IS 'Description of work/service for this line item';
    COMMENT ON COLUMN public.project_po_line_items.amount IS 'Dollar amount for this line item';
    
    RAISE NOTICE 'Table project_po_line_items created successfully';
  ELSE
    RAISE NOTICE 'Table project_po_line_items already exists';
  END IF;
END $$;