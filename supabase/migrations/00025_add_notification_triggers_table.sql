-- Add notification triggers table for defining alert rules
-- This enables automated notifications for data staleness, budget overruns, etc.

CREATE TABLE public.notification_triggers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trigger_type varchar NOT NULL CHECK (trigger_type IN (
    'stale_data', 
    'budget_overrun', 
    'margin_threshold', 
    'po_risk', 
    'missing_forecast',
    'invoice_overdue',
    'change_order_pending'
  )),
  entity_type varchar NOT NULL CHECK (entity_type IN ('project', 'division', 'company')),
  entity_id uuid,
  threshold_value numeric,
  threshold_unit varchar,
  comparison_operator varchar DEFAULT '>=' CHECK (comparison_operator IN ('>', '>=', '<', '<=', '=')),
  notification_frequency varchar DEFAULT 'once' CHECK (notification_frequency IN ('once', 'daily', 'weekly')),
  last_triggered_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_triggers_pkey PRIMARY KEY (id),
  CONSTRAINT notification_triggers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Create indexes
CREATE INDEX idx_notification_triggers_type ON public.notification_triggers(trigger_type);
CREATE INDEX idx_notification_triggers_entity ON public.notification_triggers(entity_type, entity_id);
CREATE INDEX idx_notification_triggers_active ON public.notification_triggers(is_active);

-- Add trigger to update updated_at
CREATE TRIGGER update_notification_triggers_updated_at
  BEFORE UPDATE ON public.notification_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check and create notifications based on triggers
CREATE OR REPLACE FUNCTION check_notification_triggers()
RETURNS void AS $$
DECLARE
  trigger_record record;
  should_notify boolean;
  notification_message text;
  notification_title text;
  target_user_id uuid;
BEGIN
  -- Check all active triggers
  FOR trigger_record IN 
    SELECT * FROM public.notification_triggers 
    WHERE is_active = true
  LOOP
    should_notify := false;
    
    -- Check stale data triggers
    IF trigger_record.trigger_type = 'stale_data' THEN
      -- Check if project data is stale
      IF trigger_record.entity_type = 'project' THEN
        SELECT 
          CASE 
            WHEN data_health_status IN ('stale', 'missing') THEN true
            ELSE false
          END,
          project_manager_id
        INTO should_notify, target_user_id
        FROM public.projects
        WHERE id = trigger_record.entity_id
        AND status IN ('active', 'planning');
        
        IF should_notify THEN
          notification_title := 'Data Update Required';
          notification_message := 'Project data has not been updated in over ' || 
            COALESCE(trigger_record.threshold_value::text || ' ' || trigger_record.threshold_unit, '7 days');
        END IF;
      END IF;
    
    -- Check budget overrun triggers
    ELSIF trigger_record.trigger_type = 'budget_overrun' THEN
      IF trigger_record.entity_type = 'project' THEN
        SELECT 
          CASE 
            WHEN (estimated_final_cost - revised_contract) / NULLIF(revised_contract, 0) * 100 > trigger_record.threshold_value 
            THEN true
            ELSE false
          END,
          project_manager_id
        INTO should_notify, target_user_id
        FROM public.projects
        WHERE id = trigger_record.entity_id
        AND status IN ('active', 'planning');
        
        IF should_notify THEN
          notification_title := 'Budget Overrun Alert';
          notification_message := 'Project is forecasted to exceed budget by more than ' || 
            trigger_record.threshold_value::text || '%';
        END IF;
      END IF;
    
    -- Check margin threshold triggers
    ELSIF trigger_record.trigger_type = 'margin_threshold' THEN
      IF trigger_record.entity_type = 'project' THEN
        SELECT 
          CASE 
            WHEN margin_percent < trigger_record.threshold_value 
            THEN true
            ELSE false
          END,
          project_manager_id
        INTO should_notify, target_user_id
        FROM public.projects
        WHERE id = trigger_record.entity_id
        AND status IN ('active', 'planning');
        
        IF should_notify THEN
          notification_title := 'Low Margin Alert';
          notification_message := 'Project margin has fallen below ' || 
            trigger_record.threshold_value::text || '%';
        END IF;
      END IF;
    END IF;
    
    -- Create notification if needed
    IF should_notify AND target_user_id IS NOT NULL THEN
      -- Check if we should create a new notification based on frequency
      IF trigger_record.notification_frequency = 'once' AND trigger_record.last_triggered_at IS NOT NULL THEN
        CONTINUE; -- Skip if already triggered once
      ELSIF trigger_record.notification_frequency = 'daily' 
        AND trigger_record.last_triggered_at > NOW() - INTERVAL '1 day' THEN
        CONTINUE; -- Skip if triggered within last day
      ELSIF trigger_record.notification_frequency = 'weekly' 
        AND trigger_record.last_triggered_at > NOW() - INTERVAL '7 days' THEN
        CONTINUE; -- Skip if triggered within last week
      END IF;
      
      -- Insert notification
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        created_at
      ) VALUES (
        target_user_id,
        notification_title,
        notification_message,
        NOW()
      );
      
      -- Update last triggered timestamp
      UPDATE public.notification_triggers
      SET last_triggered_at = NOW()
      WHERE id = trigger_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE public.notification_triggers ENABLE ROW LEVEL SECURITY;

-- Controllers can manage all triggers
CREATE POLICY "Controllers can manage notification triggers" ON public.notification_triggers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'controller'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'controller'
    )
  );

-- Project managers can view and create triggers for their projects
CREATE POLICY "Project managers can manage their project triggers" ON public.notification_triggers
  FOR ALL
  TO authenticated
  USING (
    entity_type = 'project' 
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = entity_id
      AND projects.project_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_type = 'project' 
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = entity_id
      AND projects.project_manager_id = auth.uid()
    )
  );

-- Create default notification triggers for all active projects
INSERT INTO public.notification_triggers (
  trigger_type,
  entity_type,
  entity_id,
  threshold_value,
  threshold_unit,
  notification_frequency
)
SELECT 
  'stale_data',
  'project',
  id,
  7,
  'days',
  'daily'
FROM public.projects
WHERE status IN ('active', 'planning')
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE public.notification_triggers IS 'Defines rules for automated notifications based on project metrics and data health';