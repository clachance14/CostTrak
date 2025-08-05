-- Migration: Simplify CostTrak Schema - Drop Unnecessary Tables
-- Date: 2025-01-30
-- Description: Remove complex features to focus on core PO, Labor, and Budget import functionality

-- Drop views first (dependencies)
DROP VIEW IF EXISTS budget_category_rollup CASCADE;
DROP VIEW IF EXISTS budget_cost_type_rollup CASCADE;
DROP VIEW IF EXISTS budget_wbs_rollup CASCADE;
DROP VIEW IF EXISTS division_cost_summary CASCADE;
DROP VIEW IF EXISTS mv_wbs_rollups CASCADE;
DROP VIEW IF EXISTS project_budget_breakdown_summary CASCADE;
DROP VIEW IF EXISTS project_cost_type_summary CASCADE;
DROP VIEW IF EXISTS project_financial_summary CASCADE;
DROP VIEW IF EXISTS project_po_cost_summary CASCADE;
DROP VIEW IF EXISTS v_civil_id CASCADE;
DROP VIEW IF EXISTS v_ie_id CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS mv_project_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_division_summary CASCADE;

-- Drop tables related to divisions (keeping division_id fields in core tables)
DROP TABLE IF EXISTS divisions CASCADE;
DROP TABLE IF EXISTS project_divisions CASCADE;
DROP TABLE IF EXISTS division_budgets CASCADE;
DROP TABLE IF EXISTS division_forecasts CASCADE;
DROP TABLE IF EXISTS division_discipline_mapping CASCADE;
DROP TABLE IF EXISTS craft_type_divisions CASCADE;

-- Drop WBS-related tables (keeping basic categories)
DROP TABLE IF EXISTS wbs_structure CASCADE;
DROP TABLE IF EXISTS excel_sheet_mappings CASCADE;

-- Drop discipline-related tables
DROP TABLE IF EXISTS discipline_registry CASCADE;

-- Drop notification system tables
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_triggers CASCADE;

-- Drop document management tables
DROP TABLE IF EXISTS co_attachments CASCADE;

-- Drop financial snapshot tables
DROP TABLE IF EXISTS financial_snapshots CASCADE;

-- Drop invoice tables
DROP TABLE IF EXISTS invoices CASCADE;

-- Drop other complex features
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

-- Remove 2FA columns from profiles table
ALTER TABLE profiles 
DROP COLUMN IF EXISTS two_factor_secret,
DROP COLUMN IF EXISTS two_factor_enabled,
DROP COLUMN IF EXISTS two_factor_backup_codes;

-- Simplify projects table - remove division references
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_division_id_fkey;

-- Note: We're keeping division_id columns in tables like labor_employee_actuals 
-- for basic grouping, but removing the complex division management system