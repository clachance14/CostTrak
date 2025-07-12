-- Create documents table for file management
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('project', 'purchase_order', 'change_order')),
    entity_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (category IN ('contract', 'invoice', 'drawing', 'report', 'other')),
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_category ON public.documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Controllers and executives can see all documents
CREATE POLICY "controllers_executives_view_all_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('controller', 'executive')
        )
    );

-- Ops managers can see documents for their division's projects
CREATE POLICY "ops_managers_view_division_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.projects p ON p.division_id = u.division_id
            WHERE u.id = auth.uid()
            AND u.role = 'ops_manager'
            AND (
                (documents.entity_type = 'project' AND documents.entity_id = p.id)
                OR (documents.entity_type = 'purchase_order' AND EXISTS (
                    SELECT 1 FROM public.purchase_orders po
                    WHERE po.id = documents.entity_id AND po.project_id = p.id
                ))
                OR (documents.entity_type = 'change_order' AND EXISTS (
                    SELECT 1 FROM public.change_orders co
                    WHERE co.id = documents.entity_id AND co.project_id = p.id
                ))
            )
        )
    );

-- Project managers can see documents for their projects
CREATE POLICY "project_managers_view_project_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.projects p ON p.project_manager_id = u.id
            WHERE u.id = auth.uid()
            AND u.role = 'project_manager'
            AND (
                (documents.entity_type = 'project' AND documents.entity_id = p.id)
                OR (documents.entity_type = 'purchase_order' AND EXISTS (
                    SELECT 1 FROM public.purchase_orders po
                    WHERE po.id = documents.entity_id AND po.project_id = p.id
                ))
                OR (documents.entity_type = 'change_order' AND EXISTS (
                    SELECT 1 FROM public.change_orders co
                    WHERE co.id = documents.entity_id AND co.project_id = p.id
                ))
            )
        )
    );

-- Accounting can see financial documents
CREATE POLICY "accounting_view_financial_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'accounting'
        )
        AND documents.category IN ('invoice', 'contract', 'report')
    );

-- Users can upload documents based on their permissions
CREATE POLICY "users_can_upload_documents" ON public.documents
    FOR INSERT
    WITH CHECK (
        -- User must be authenticated
        auth.uid() = uploaded_by
        AND (
            -- Controllers and executives can upload to any entity
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid()
                AND users.role IN ('controller', 'executive')
            )
            OR
            -- Ops managers can upload to their division's projects
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.projects p ON p.division_id = u.division_id
                WHERE u.id = auth.uid()
                AND u.role = 'ops_manager'
                AND (
                    (entity_type = 'project' AND entity_id = p.id)
                    OR (entity_type = 'purchase_order' AND EXISTS (
                        SELECT 1 FROM public.purchase_orders po
                        WHERE po.id = entity_id AND po.project_id = p.id
                    ))
                    OR (entity_type = 'change_order' AND EXISTS (
                        SELECT 1 FROM public.change_orders co
                        WHERE co.id = entity_id AND co.project_id = p.id
                    ))
                )
            )
            OR
            -- Project managers can upload to their projects
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.projects p ON p.project_manager_id = u.id
                WHERE u.id = auth.uid()
                AND u.role = 'project_manager'
                AND (
                    (entity_type = 'project' AND entity_id = p.id)
                    OR (entity_type = 'purchase_order' AND EXISTS (
                        SELECT 1 FROM public.purchase_orders po
                        WHERE po.id = entity_id AND po.project_id = p.id
                    ))
                    OR (entity_type = 'change_order' AND EXISTS (
                        SELECT 1 FROM public.change_orders co
                        WHERE co.id = entity_id AND co.project_id = p.id
                    ))
                )
            )
        )
    );

-- Only controllers can delete documents (soft delete)
CREATE POLICY "controllers_can_delete_documents" ON public.documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'controller'
        )
    )
    WITH CHECK (
        -- Only allow updating deleted_at field
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'controller'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_documents_updated_at();

-- Create storage bucket for documents (this would be done via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);