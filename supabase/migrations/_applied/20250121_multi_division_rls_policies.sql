-- Migration: Row Level Security Policies for Multi-Division Support
-- Description: Implements division-based access control for all cost tracking tables

-- =====================================================
-- Enable RLS on new tables
-- =====================================================

ALTER TABLE project_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_discipline_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE craft_type_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_forecasts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Project Divisions Policies
-- =====================================================

-- Controllers and executives can see all project divisions
CREATE POLICY "project_divisions_controller_executive_access" ON project_divisions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Project managers can see divisions for their projects
CREATE POLICY "project_divisions_pm_access" ON project_divisions
FOR SELECT USING (
  project_id IN (
    SELECT id FROM projects
    WHERE project_manager_id = auth.uid()
  )
  OR
  division_pm_id = auth.uid()
);

-- Division PMs can update their division info
CREATE POLICY "project_divisions_division_pm_update" ON project_divisions
FOR UPDATE USING (
  division_pm_id = auth.uid()
) WITH CHECK (
  division_pm_id = auth.uid()
);

-- Ops managers can see divisions in their division
CREATE POLICY "project_divisions_ops_manager_access" ON project_divisions
FOR SELECT USING (
  division_id IN (
    SELECT division_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'ops_manager'
  )
);

-- =====================================================
-- Division Budgets Policies
-- =====================================================

-- Controllers and executives have full access
CREATE POLICY "division_budgets_controller_executive_access" ON division_budgets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Division PMs can view and update their division budgets
CREATE POLICY "division_budgets_division_pm_access" ON division_budgets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = division_budgets.project_id
    AND pd.division_id = division_budgets.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- Ops managers can view budgets in their division
CREATE POLICY "division_budgets_ops_manager_access" ON division_budgets
FOR SELECT USING (
  division_id IN (
    SELECT division_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'ops_manager'
  )
);

-- =====================================================
-- Division Forecasts Policies
-- =====================================================

-- Controllers and executives have full access
CREATE POLICY "division_forecasts_controller_executive_access" ON division_forecasts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Division PMs can manage their division forecasts
CREATE POLICY "division_forecasts_division_pm_access" ON division_forecasts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = division_forecasts.project_id
    AND pd.division_id = division_forecasts.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- =====================================================
-- Purchase Orders Division-Based Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_policy" ON purchase_orders;

-- Controllers and executives see all POs
CREATE POLICY "purchase_orders_controller_executive_access" ON purchase_orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Ops managers see POs in their division
CREATE POLICY "purchase_orders_ops_manager_access" ON purchase_orders
FOR SELECT USING (
  division_id IN (
    SELECT division_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'ops_manager'
  )
);

-- Project managers see POs for their projects
CREATE POLICY "purchase_orders_pm_access" ON purchase_orders
FOR SELECT USING (
  project_id IN (
    SELECT project_id FROM project_divisions
    WHERE division_pm_id = auth.uid()
  )
);

-- Division PMs can create and update POs for their division
CREATE POLICY "purchase_orders_division_pm_write" ON purchase_orders
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = purchase_orders.project_id
    AND pd.division_id = purchase_orders.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

CREATE POLICY "purchase_orders_division_pm_update" ON purchase_orders
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = purchase_orders.project_id
    AND pd.division_id = purchase_orders.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- =====================================================
-- Change Orders Division-Based Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "change_orders_select_policy" ON change_orders;
DROP POLICY IF EXISTS "change_orders_insert_policy" ON change_orders;
DROP POLICY IF EXISTS "change_orders_update_policy" ON change_orders;

-- Controllers and executives have full access
CREATE POLICY "change_orders_controller_executive_access" ON change_orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Division PMs can manage COs for their division
CREATE POLICY "change_orders_division_pm_access" ON change_orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = change_orders.project_id
    AND pd.division_id = change_orders.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- Ops managers can view COs in their division
CREATE POLICY "change_orders_ops_manager_access" ON change_orders
FOR SELECT USING (
  division_id IN (
    SELECT division_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'ops_manager'
  )
);

-- =====================================================
-- Labor Actuals Division-Based Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "labor_actuals_select_policy" ON labor_actuals;
DROP POLICY IF EXISTS "labor_actuals_insert_policy" ON labor_actuals;
DROP POLICY IF EXISTS "labor_actuals_update_policy" ON labor_actuals;

-- Controllers and executives have full access
CREATE POLICY "labor_actuals_controller_executive_access" ON labor_actuals
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Division PMs can manage labor for their division
CREATE POLICY "labor_actuals_division_pm_access" ON labor_actuals
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = labor_actuals.project_id
    AND pd.division_id = labor_actuals.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- Accounting can enter labor actuals
CREATE POLICY "labor_actuals_accounting_access" ON labor_actuals
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'accounting'
  )
);

-- =====================================================
-- Labor Headcount Forecasts Division-Based Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "labor_headcount_forecasts_select_policy" ON labor_headcount_forecasts;
DROP POLICY IF EXISTS "labor_headcount_forecasts_insert_policy" ON labor_headcount_forecasts;
DROP POLICY IF EXISTS "labor_headcount_forecasts_update_policy" ON labor_headcount_forecasts;

-- Controllers and executives have full access
CREATE POLICY "labor_headcount_controller_executive_access" ON labor_headcount_forecasts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive')
  )
);

-- Division PMs can manage forecasts for their division
CREATE POLICY "labor_headcount_division_pm_access" ON labor_headcount_forecasts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = labor_headcount_forecasts.project_id
    AND pd.division_id = labor_headcount_forecasts.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- =====================================================
-- Invoices Division-Based Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

-- Controllers, executives, and accounting have full access
CREATE POLICY "invoices_controller_executive_accounting_access" ON invoices
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('controller', 'executive', 'accounting')
  )
);

-- Division PMs can view invoices for their division
CREATE POLICY "invoices_division_pm_access" ON invoices
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_divisions pd
    WHERE pd.project_id = invoices.project_id
    AND pd.division_id = invoices.division_id
    AND pd.division_pm_id = auth.uid()
  )
);

-- =====================================================
-- Reference Table Policies
-- =====================================================

-- All authenticated users can view reference tables
CREATE POLICY "division_discipline_mapping_view" ON division_discipline_mapping
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "craft_type_divisions_view" ON craft_type_divisions
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only controllers can modify reference tables
CREATE POLICY "division_discipline_mapping_modify" ON division_discipline_mapping
FOR INSERT, UPDATE, DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'controller'
  )
);

CREATE POLICY "craft_type_divisions_modify" ON craft_type_divisions
FOR INSERT, UPDATE, DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'controller'
  )
);

-- =====================================================
-- Create helper functions for division access checks
-- =====================================================

-- Function to check if user has access to a division
CREATE OR REPLACE FUNCTION user_has_division_access(
  p_user_id uuid,
  p_division_id uuid
) RETURNS boolean AS $$
DECLARE
  v_user_role text;
  v_user_division_id uuid;
BEGIN
  -- Get user role and division
  SELECT role, division_id INTO v_user_role, v_user_division_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Controllers and executives have access to all divisions
  IF v_user_role IN ('controller', 'executive') THEN
    RETURN true;
  END IF;
  
  -- Ops managers have access to their division
  IF v_user_role = 'ops_manager' AND v_user_division_id = p_division_id THEN
    RETURN true;
  END IF;
  
  -- Project managers have access to divisions they manage
  IF EXISTS (
    SELECT 1 FROM project_divisions
    WHERE division_id = p_division_id
    AND division_pm_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get divisions accessible to a user
CREATE OR REPLACE FUNCTION get_user_accessible_divisions(
  p_user_id uuid
) RETURNS TABLE(division_id uuid) AS $$
DECLARE
  v_user_role text;
  v_user_division_id uuid;
BEGIN
  -- Get user role and division
  SELECT role, division_id INTO v_user_role, v_user_division_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Controllers and executives see all divisions
  IF v_user_role IN ('controller', 'executive') THEN
    RETURN QUERY SELECT id FROM divisions WHERE is_active = true;
  -- Ops managers see their division
  ELSIF v_user_role = 'ops_manager' AND v_user_division_id IS NOT NULL THEN
    RETURN QUERY SELECT v_user_division_id;
  -- Project managers see divisions they manage
  ELSIF v_user_role = 'project_manager' THEN
    RETURN QUERY 
    SELECT DISTINCT pd.division_id 
    FROM project_divisions pd
    WHERE pd.division_pm_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION user_has_division_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_divisions TO authenticated;