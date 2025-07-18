-- Add data import tracking for monitoring data freshness and import history
-- This enables the PM dashboard to show when data was last updated and by whom

-- Create data_imports table to track all imports
CREATE TABLE public.data_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  import_type varchar NOT NULL CHECK (import_type IN ('labor', 'po', 'budget', 'employee')),
  import_status varchar NOT NULL CHECK (import_status IN ('pending', 'processing', 'success', 'failed')),
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by uuid NOT NULL,
  file_name text,
  file_hash text, -- For duplicate detection
  records_processed integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  error_details jsonb, -- Detailed error information
  metadata jsonb, -- Additional import metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT data_imports_pkey PRIMARY KEY (id),
  CONSTRAINT data_imports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT data_imports_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.profiles(id)
);

-- Create indexes for performance
CREATE INDEX idx_data_imports_project_id ON public.data_imports(project_id);
CREATE INDEX idx_data_imports_import_type ON public.data_imports(import_type);
CREATE INDEX idx_data_imports_imported_at ON public.data_imports(imported_at DESC);
CREATE INDEX idx_data_imports_status ON public.data_imports(import_status);

-- Add trigger to update updated_at
CREATE TRIGGER update_data_imports_updated_at
  BEFORE UPDATE ON public.data_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

-- Controllers can see all imports
CREATE POLICY "Controllers can view all data imports" ON public.data_imports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'controller'
    )
  );

-- Project managers can see imports for their projects
CREATE POLICY "Project managers can view their project imports" ON public.data_imports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = data_imports.project_id
      AND projects.project_manager_id = auth.uid()
    )
  );

-- Ops managers can see imports for their division
CREATE POLICY "Ops managers can view division imports" ON public.data_imports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.profiles prof ON prof.id = auth.uid()
      WHERE p.id = data_imports.project_id
      AND p.division_id = prof.division_id
      AND prof.role = 'ops_manager'
    )
  );

-- Users can create imports for projects they have access to
CREATE POLICY "Users can create imports for accessible projects" ON public.data_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    imported_by = auth.uid()
    AND (
      -- Controllers can import for any project
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'controller'
      )
      OR
      -- Project managers can import for their projects
      EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_id
        AND projects.project_manager_id = auth.uid()
      )
      OR
      -- Ops managers can import for their division
      EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.profiles prof ON prof.id = auth.uid()
        WHERE p.id = project_id
        AND p.division_id = prof.division_id
        AND prof.role = 'ops_manager'
      )
    )
  );

-- Users can update their own imports
CREATE POLICY "Users can update their own imports" ON public.data_imports
  FOR UPDATE
  TO authenticated
  USING (imported_by = auth.uid())
  WITH CHECK (imported_by = auth.uid());

-- Add comment
COMMENT ON TABLE public.data_imports IS 'Tracks all data imports for audit trail and data freshness monitoring';