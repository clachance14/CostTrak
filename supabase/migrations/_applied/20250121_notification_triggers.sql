-- Create helper function for project access checks
CREATE OR REPLACE FUNCTION project_access_allowed(p_project_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Controllers and executives have access to all projects
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role IN ('controller', 'executive')
  ) THEN
    RETURN true;
  END IF;
  
  -- Project managers have access to their projects
  IF EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
    AND project_manager_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Division PMs have access to projects where they manage a division
  IF EXISTS (
    SELECT 1 FROM project_divisions
    WHERE project_id = p_project_id
    AND division_pm_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Ops managers have access to projects in their division
  IF EXISTS (
    SELECT 1 FROM project_divisions pd
    JOIN profiles p ON p.id = p_user_id
    WHERE pd.project_id = p_project_id
    AND pd.division_id = p.division_id
    AND p.role = 'ops_manager'
  ) THEN
    RETURN true;
  END IF;
  
  -- Default: no access
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification_triggers table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_triggers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'project' or 'division'
  entity_id UUID NOT NULL,
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT NOT NULL, -- 'percent', 'days', 'amount'
  comparison_operator TEXT NOT NULL, -- '>=', '<=', '>', '<', '='
  notification_frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  last_triggered_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trigger_type, entity_type, entity_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_triggers_entity ON notification_triggers(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_active ON notification_triggers(is_active, last_triggered_at);

-- Enable RLS
ALTER TABLE notification_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_triggers
DROP POLICY IF EXISTS "Users can view notification triggers for their accessible projects and divisions" ON notification_triggers;
CREATE POLICY "Users can view notification triggers for their accessible projects and divisions"
  ON notification_triggers FOR SELECT
  USING (
    CASE 
      WHEN entity_type = 'project' THEN
        EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = entity_id
          AND project_access_allowed(p.id, auth.uid())
        )
      WHEN entity_type = 'division' THEN
        EXISTS (
          SELECT 1 FROM project_divisions pd
          JOIN projects p ON p.id = pd.project_id
          WHERE pd.division_id = entity_id
          AND project_access_allowed(p.id, auth.uid())
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS "Only controllers and executives can manage notification triggers" ON notification_triggers;
CREATE POLICY "Only controllers and executives can manage notification triggers"
  ON notification_triggers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('controller', 'executive')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_notification_triggers_updated_at ON notification_triggers;
CREATE TRIGGER update_notification_triggers_updated_at
  BEFORE UPDATE ON notification_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_triggers_updated_at();

-- Sample notification triggers for common scenarios
-- These can be inserted via the API when needed