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
CREATE INDEX idx_notification_triggers_entity ON notification_triggers(entity_type, entity_id);
CREATE INDEX idx_notification_triggers_active ON notification_triggers(is_active, last_triggered_at);

-- Enable RLS
ALTER TABLE notification_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_triggers
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
CREATE TRIGGER update_notification_triggers_updated_at
  BEFORE UPDATE ON notification_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_triggers_updated_at();

-- Sample notification triggers for common scenarios
-- These can be inserted via the API when needed