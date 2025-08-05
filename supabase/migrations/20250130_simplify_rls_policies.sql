-- Migration: Simplify RLS Policies
-- Date: 2025-01-30
-- Description: Remove division-based RLS complexity, keep simple project-based access

-- Drop existing complex RLS policies
DROP POLICY IF EXISTS "Users can view their profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Controllers can view all profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view projects they have access to" ON projects;
DROP POLICY IF EXISTS "Users can update projects they manage" ON projects;
DROP POLICY IF EXISTS "Controllers can manage all projects" ON projects;
DROP POLICY IF EXISTS "Project managers can view their projects" ON projects;
DROP POLICY IF EXISTS "Ops managers can view division projects" ON projects;

-- Create simplified RLS policies

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Controllers and executives can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('controller', 'executive')
        )
    );

-- Projects policies (simplified)
CREATE POLICY "All authenticated users can view projects" ON projects
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Purchase orders policies
CREATE POLICY "All authenticated users can view purchase orders" ON purchase_orders
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage purchase orders" ON purchase_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- PO line items policies
CREATE POLICY "All authenticated users can view PO line items" ON po_line_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage PO line items" ON po_line_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Change orders policies
CREATE POLICY "All authenticated users can view change orders" ON change_orders
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers and PMs can manage change orders" ON change_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('controller', 'project_manager')
        )
    );

-- Employees policies
CREATE POLICY "All authenticated users can view employees" ON employees
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage employees" ON employees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Labor actuals policies
CREATE POLICY "All authenticated users can view labor actuals" ON labor_actuals
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage labor actuals" ON labor_actuals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Labor employee actuals policies
CREATE POLICY "All authenticated users can view labor employee actuals" ON labor_employee_actuals
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage labor employee actuals" ON labor_employee_actuals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Labor headcount forecasts policies
CREATE POLICY "All authenticated users can view headcount forecasts" ON labor_headcount_forecasts
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers and PMs can manage headcount forecasts" ON labor_headcount_forecasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('controller', 'project_manager')
        )
    );

-- Budget line items policies
CREATE POLICY "All authenticated users can view budget line items" ON budget_line_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage budget line items" ON budget_line_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Craft types policies
CREATE POLICY "All authenticated users can view craft types" ON craft_types
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Data imports policies
CREATE POLICY "All authenticated users can view data imports" ON data_imports
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Controllers can manage data imports" ON data_imports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );

-- Audit log policies
CREATE POLICY "Controllers can view audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'controller'
        )
    );