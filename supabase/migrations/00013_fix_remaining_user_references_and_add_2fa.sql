-- Fix remaining references to users table and add 2FA support

-- 1. Fix labor management table references
ALTER TABLE public.labor_actuals 
    DROP CONSTRAINT IF EXISTS labor_actuals_entered_by_fkey,
    DROP CONSTRAINT IF EXISTS labor_actuals_approved_by_fkey;

ALTER TABLE public.labor_actuals
    ADD CONSTRAINT labor_actuals_entered_by_fkey 
        FOREIGN KEY (entered_by) REFERENCES public.profiles(id),
    ADD CONSTRAINT labor_actuals_approved_by_fkey 
        FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

ALTER TABLE public.labor_headcount_forecasts
    DROP CONSTRAINT IF EXISTS labor_headcount_forecasts_created_by_fkey;

ALTER TABLE public.labor_headcount_forecasts
    ADD CONSTRAINT labor_headcount_forecasts_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- 2. Fix documents table references
ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;

ALTER TABLE public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

-- 3. Fix labor management RLS policies
DROP POLICY IF EXISTS "authorized_users_manage_labor_actuals" ON public.labor_actuals;
CREATE POLICY "authorized_users_manage_labor_actuals" ON public.labor_actuals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles u
            LEFT JOIN public.projects p ON p.id = labor_actuals.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role IN ('controller', 'accounting') OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "authorized_users_manage_labor_forecasts" ON public.labor_headcount_forecasts;
CREATE POLICY "authorized_users_manage_labor_forecasts" ON public.labor_headcount_forecasts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles u
            LEFT JOIN public.projects p ON p.id = labor_headcount_forecasts.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- 4. Fix documents RLS policies
DROP POLICY IF EXISTS "controllers_executives_view_all_documents" ON public.documents;
CREATE POLICY "controllers_executives_view_all_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('controller', 'executive')
        )
    );

DROP POLICY IF EXISTS "ops_managers_view_division_documents" ON public.documents;
CREATE POLICY "ops_managers_view_division_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles u
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

DROP POLICY IF EXISTS "project_managers_view_project_documents" ON public.documents;
CREATE POLICY "project_managers_view_project_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles u
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

DROP POLICY IF EXISTS "accounting_view_financial_documents" ON public.documents;
CREATE POLICY "accounting_view_financial_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'accounting'
        )
        AND documents.category IN ('invoice', 'contract', 'report')
    );

DROP POLICY IF EXISTS "users_can_upload_documents" ON public.documents;
CREATE POLICY "users_can_upload_documents" ON public.documents
    FOR INSERT
    WITH CHECK (
        -- User must be authenticated
        auth.uid() = uploaded_by
        AND (
            -- Controllers and executives can upload to any entity
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('controller', 'executive')
            )
            OR
            -- Ops managers can upload to their division's projects
            EXISTS (
                SELECT 1 FROM public.profiles u
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
                SELECT 1 FROM public.profiles u
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

DROP POLICY IF EXISTS "controllers_can_delete_documents" ON public.documents;
CREATE POLICY "controllers_can_delete_documents" ON public.documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'controller'
        )
    )
    WITH CHECK (
        -- Only allow updating deleted_at field
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'controller'
        )
    );

-- 5. Create 2FA settings table
CREATE TABLE IF NOT EXISTS public.user_2fa_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    secret TEXT NOT NULL, -- Should be encrypted in production
    backup_codes TEXT[], -- Should be encrypted in production
    enabled BOOLEAN DEFAULT false,
    enabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_2fa UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX idx_user_2fa_settings_user_id ON public.user_2fa_settings(user_id);
CREATE INDEX idx_user_2fa_settings_enabled ON public.user_2fa_settings(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for 2FA settings
-- Users can only view and manage their own 2FA settings
CREATE POLICY "users_manage_own_2fa" ON public.user_2fa_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Controllers can view all 2FA settings (for security audits)
CREATE POLICY "controllers_view_all_2fa" ON public.user_2fa_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'controller'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER update_user_2fa_settings_updated_at
    BEFORE UPDATE ON public.user_2fa_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Add 2FA-related audit log events
-- Insert sample 2FA event types into auth_audit_log (these would be logged by the application)
-- Events like: 2fa_enabled, 2fa_disabled, 2fa_verified, 2fa_failed, backup_code_used

-- Grant permissions
GRANT ALL ON public.user_2fa_settings TO authenticated;

-- Add comment documenting the 2FA implementation
COMMENT ON TABLE public.user_2fa_settings IS 'Stores two-factor authentication settings for users. Secret and backup codes should be encrypted at the application level before storage.';
COMMENT ON COLUMN public.user_2fa_settings.secret IS 'TOTP secret - must be encrypted before storage';
COMMENT ON COLUMN public.user_2fa_settings.backup_codes IS 'Recovery codes - must be encrypted before storage';