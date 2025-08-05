-- Manual Migration Steps for CostTrak Simplification
-- Run these in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Execute each section one at a time

-- =====================================================
-- STEP 1: Drop Views (Run this first)
-- =====================================================

-- Drop regular views
DROP VIEW IF EXISTS budget_category_rollup CASCADE;
DROP VIEW IF EXISTS budget_cost_type_rollup CASCADE;
DROP VIEW IF EXISTS budget_wbs_rollup CASCADE;
DROP VIEW IF EXISTS division_cost_summary CASCADE;
DROP VIEW IF EXISTS project_budget_breakdown_summary CASCADE;
DROP VIEW IF EXISTS project_cost_type_summary CASCADE;
DROP VIEW IF EXISTS project_financial_summary CASCADE;
DROP VIEW IF EXISTS project_po_cost_summary CASCADE;
DROP VIEW IF EXISTS v_civil_id CASCADE;
DROP VIEW IF EXISTS v_ie_id CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS mv_wbs_rollups CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_project_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_division_summary CASCADE;

-- =====================================================
-- STEP 2: Drop Division Tables
-- =====================================================
DROP TABLE IF EXISTS divisions CASCADE;
DROP TABLE IF EXISTS project_divisions CASCADE;
DROP TABLE IF EXISTS division_budgets CASCADE;
DROP TABLE IF EXISTS division_forecasts CASCADE;
DROP TABLE IF EXISTS division_discipline_mapping CASCADE;
DROP TABLE IF EXISTS craft_type_divisions CASCADE;

-- =====================================================
-- STEP 3: Drop Complex Feature Tables
-- =====================================================
DROP TABLE IF EXISTS wbs_structure CASCADE;
DROP TABLE IF EXISTS excel_sheet_mappings CASCADE;
DROP TABLE IF EXISTS discipline_registry CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_triggers CASCADE;
DROP TABLE IF EXISTS co_attachments CASCADE;
DROP TABLE IF EXISTS financial_snapshots CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS monthly_forecasts CASCADE;
DROP TABLE IF EXISTS labor_categories CASCADE;
DROP TABLE IF EXISTS labor_running_averages CASCADE;
DROP TABLE IF EXISTS phase_allocations CASCADE;
DROP TABLE IF EXISTS po_forecast_history CASCADE;
DROP TABLE IF EXISTS project_budget_breakdowns CASCADE;
DROP TABLE IF EXISTS project_budgets CASCADE;
DROP TABLE IF EXISTS project_contract_breakdowns CASCADE;
DROP TABLE IF EXISTS project_po_line_items CASCADE;
DROP TABLE IF EXISTS cost_codes CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS auth_audit_log CASCADE;
DROP TABLE IF EXISTS direct_labor_allocations CASCADE;
DROP TABLE IF EXISTS extra_costs CASCADE;
DROP TABLE IF EXISTS labor_forecasts CASCADE;
DROP TABLE IF EXISTS forecast_disciplines CASCADE;

-- =====================================================
-- STEP 4: Drop All RLS Policies FIRST (Run this before simplifying tables)
-- =====================================================
-- Drop specific policies that depend on division_id
DROP POLICY IF EXISTS "ops_managers_view_division_projects" ON projects;
DROP POLICY IF EXISTS "controllers_ops_manage_purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "users_manage_po_line_items" ON po_line_items;
DROP POLICY IF EXISTS "ops_manager_read_labor_employee_actuals" ON labor_employee_actuals;
DROP POLICY IF EXISTS "Ops managers can view division imports" ON data_imports;
DROP POLICY IF EXISTS "Users can create imports for accessible projects" ON data_imports;
DROP POLICY IF EXISTS "Users can view budget items for accessible projects" ON budget_line_items;

-- Drop all other policies to be safe
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 5: Simplify Tables (Run AFTER dropping policies)
-- =====================================================
-- Update all users to project_manager role
UPDATE profiles SET role = 'project_manager' WHERE role IS NOT NULL;

-- Remove 2FA from profiles
ALTER TABLE profiles 
DROP COLUMN IF EXISTS two_factor_secret,
DROP COLUMN IF EXISTS two_factor_enabled,
DROP COLUMN IF EXISTS two_factor_backup_codes;

-- Simplify projects table
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_division_id_fkey,
DROP COLUMN IF EXISTS risk_factors,
DROP COLUMN IF EXISTS action_items,
DROP COLUMN IF EXISTS data_health_status,
DROP COLUMN IF EXISTS data_health_checked_at,
DROP COLUMN IF EXISTS client_id,
DROP COLUMN IF EXISTS division_id;

-- Add import reminder tracking
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS last_import_reminder_sent timestamp with time zone;

-- =====================================================
-- STEP 6: Create Simple RLS Policies
-- =====================================================
-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE craft_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_employee_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_headcount_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies (all authenticated users can access everything)
CREATE POLICY "auth_users_all" ON profiles FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON projects FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON employees FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON craft_types FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON purchase_orders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON po_line_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON change_orders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON labor_actuals FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON labor_employee_actuals FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON labor_headcount_forecasts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON budget_line_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON data_imports FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_view" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- STEP 7: Update User Role Enum (Run this separately)
-- =====================================================
-- Note: This requires recreating the enum type. 
-- In Supabase, you may need to do this through the dashboard
-- or contact support to modify the enum.
-- For now, we've updated all users to project_manager role above.

-- =====================================================
-- STEP 8: Verify Results
-- =====================================================
-- Check remaining tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected tables (should be ~12):
-- audit_log, budget_line_items, change_orders, craft_types, 
-- data_imports, employees, labor_actuals, labor_employee_actuals,
-- labor_headcount_forecasts, po_line_items, profiles, projects, purchase_orders