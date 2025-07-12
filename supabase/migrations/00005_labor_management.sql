-- Create labor actuals table (weekly actual costs and hours)
CREATE TABLE IF NOT EXISTS public.labor_actuals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    week_ending DATE NOT NULL,
    total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    headcount INTEGER DEFAULT 0,
    overtime_hours DECIMAL(10, 2) DEFAULT 0,
    rate_per_hour DECIMAL(10, 2) GENERATED ALWAYS AS (
        CASE WHEN total_hours > 0 THEN total_cost / total_hours ELSE 0 END
    ) STORED,
    notes TEXT,
    entered_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_labor_actual_per_week UNIQUE (project_id, craft_type_id, week_ending),
    CONSTRAINT positive_hours CHECK (total_hours >= 0),
    CONSTRAINT positive_cost CHECK (total_cost >= 0)
);

-- Create labor running averages table
CREATE TABLE IF NOT EXISTS public.labor_running_averages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    avg_rate DECIMAL(10, 2) NOT NULL,
    total_hours DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    weeks_included INTEGER NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_avg_per_project_craft UNIQUE (project_id, craft_type_id)
);

-- Create labor headcount forecasts table
CREATE TABLE IF NOT EXISTS public.labor_headcount_forecasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    week_starting DATE NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    weekly_hours DECIMAL(10, 2) DEFAULT 40,
    forecast_rate DECIMAL(10, 2),
    forecast_cost DECIMAL(15, 2) GENERATED ALWAYS AS (
        headcount * weekly_hours * COALESCE(forecast_rate, 0)
    ) STORED,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_forecast_per_week UNIQUE (project_id, craft_type_id, week_starting),
    CONSTRAINT positive_headcount CHECK (headcount >= 0),
    CONSTRAINT positive_weekly_hours CHECK (weekly_hours >= 0 AND weekly_hours <= 168)
);

-- Create indexes
CREATE INDEX idx_labor_actuals_project ON public.labor_actuals(project_id);
CREATE INDEX idx_labor_actuals_craft ON public.labor_actuals(craft_type_id);
CREATE INDEX idx_labor_actuals_week ON public.labor_actuals(week_ending DESC);
CREATE INDEX idx_labor_actuals_project_week ON public.labor_actuals(project_id, week_ending DESC);

CREATE INDEX idx_labor_running_averages_project ON public.labor_running_averages(project_id);
CREATE INDEX idx_labor_running_averages_craft ON public.labor_running_averages(craft_type_id);

CREATE INDEX idx_labor_headcount_forecasts_project ON public.labor_headcount_forecasts(project_id);
CREATE INDEX idx_labor_headcount_forecasts_craft ON public.labor_headcount_forecasts(craft_type_id);
CREATE INDEX idx_labor_headcount_forecasts_week ON public.labor_headcount_forecasts(week_starting);
CREATE INDEX idx_labor_headcount_forecasts_project_week ON public.labor_headcount_forecasts(project_id, week_starting);

-- Enable RLS
ALTER TABLE public.labor_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_running_averages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_headcount_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for labor tables (inherit project access)
CREATE POLICY "users_view_labor_actuals" ON public.labor_actuals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_actuals.project_id
        )
    );

CREATE POLICY "authorized_users_manage_labor_actuals" ON public.labor_actuals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = labor_actuals.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role IN ('controller', 'accounting') OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

CREATE POLICY "users_view_labor_running_averages" ON public.labor_running_averages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_running_averages.project_id
        )
    );

CREATE POLICY "users_view_labor_headcount_forecasts" ON public.labor_headcount_forecasts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_headcount_forecasts.project_id
        )
    );

CREATE POLICY "authorized_users_manage_labor_forecasts" ON public.labor_headcount_forecasts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = labor_headcount_forecasts.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- Create triggers
CREATE TRIGGER update_labor_actuals_updated_at
    BEFORE UPDATE ON public.labor_actuals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_running_averages_updated_at
    BEFORE UPDATE ON public.labor_running_averages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_headcount_forecasts_updated_at
    BEFORE UPDATE ON public.labor_headcount_forecasts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update running averages
CREATE OR REPLACE FUNCTION public.update_labor_running_average(
    p_project_id UUID,
    p_craft_type_id UUID
) RETURNS void AS $$
DECLARE
    v_avg_rate DECIMAL(10, 2);
    v_total_hours DECIMAL(12, 2);
    v_total_cost DECIMAL(15, 2);
    v_weeks_included INTEGER;
BEGIN
    -- Calculate aggregates for last 8 weeks
    SELECT 
        AVG(rate_per_hour),
        SUM(total_hours),
        SUM(total_cost),
        COUNT(*)
    INTO v_avg_rate, v_total_hours, v_total_cost, v_weeks_included
    FROM public.labor_actuals
    WHERE project_id = p_project_id
    AND craft_type_id = p_craft_type_id
    AND week_ending >= CURRENT_DATE - INTERVAL '8 weeks'
    AND total_hours > 0;
    
    -- Insert or update running average
    INSERT INTO public.labor_running_averages (
        project_id,
        craft_type_id,
        avg_rate,
        total_hours,
        total_cost,
        weeks_included,
        last_updated
    ) VALUES (
        p_project_id,
        p_craft_type_id,
        COALESCE(v_avg_rate, 0),
        COALESCE(v_total_hours, 0),
        COALESCE(v_total_cost, 0),
        COALESCE(v_weeks_included, 0),
        NOW()
    )
    ON CONFLICT (project_id, craft_type_id) DO UPDATE SET
        avg_rate = EXCLUDED.avg_rate,
        total_hours = EXCLUDED.total_hours,
        total_cost = EXCLUDED.total_cost,
        weeks_included = EXCLUDED.weeks_included,
        last_updated = EXCLUDED.last_updated,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update running averages when actuals change
CREATE OR REPLACE FUNCTION public.trigger_update_running_average()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.update_labor_running_average(
        COALESCE(NEW.project_id, OLD.project_id),
        COALESCE(NEW.craft_type_id, OLD.craft_type_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_running_avg_on_actual_change
    AFTER INSERT OR UPDATE OR DELETE ON public.labor_actuals
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_running_average();

-- Function to calculate labor forecast variance
CREATE OR REPLACE FUNCTION public.calculate_labor_variance(
    p_project_id UUID,
    p_week_ending DATE
) RETURNS TABLE (
    craft_type_id UUID,
    craft_type_name VARCHAR,
    actual_hours DECIMAL,
    actual_cost DECIMAL,
    forecast_hours DECIMAL,
    forecast_cost DECIMAL,
    hours_variance DECIMAL,
    cost_variance DECIMAL,
    variance_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id,
        ct.name,
        COALESCE(la.total_hours, 0),
        COALESCE(la.total_cost, 0),
        COALESCE(lf.weekly_hours * lf.headcount, 0),
        COALESCE(lf.forecast_cost, 0),
        COALESCE(la.total_hours, 0) - COALESCE(lf.weekly_hours * lf.headcount, 0),
        COALESCE(la.total_cost, 0) - COALESCE(lf.forecast_cost, 0),
        CASE 
            WHEN COALESCE(lf.forecast_cost, 0) > 0 
            THEN ((COALESCE(la.total_cost, 0) - COALESCE(lf.forecast_cost, 0)) / lf.forecast_cost) * 100
            ELSE 0
        END
    FROM public.craft_types ct
    LEFT JOIN public.labor_actuals la ON 
        la.craft_type_id = ct.id AND 
        la.project_id = p_project_id AND 
        la.week_ending = p_week_ending
    LEFT JOIN public.labor_headcount_forecasts lf ON 
        lf.craft_type_id = ct.id AND 
        lf.project_id = p_project_id AND 
        lf.week_starting = p_week_ending - INTERVAL '6 days'
    WHERE (la.id IS NOT NULL OR lf.id IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_labor_running_average TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_labor_variance TO authenticated;