-- Enhance notifications table with additional fields
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium' 
  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50) 
  CHECK (related_entity_type IN ('project', 'purchase_order', 'change_order', 'labor_forecast', 'financial_snapshot', 'user', 'system')),
ADD COLUMN IF NOT EXISTS related_entity_id UUID,
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications(user_id, is_read) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_priority 
  ON public.notifications(priority) 
  WHERE is_read = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related_entity 
  ON public.notifications(related_entity_type, related_entity_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_expires 
  ON public.notifications(expires_at) 
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Create notification categories enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'change_order_created',
      'change_order_updated', 
      'po_import_complete',
      'po_threshold_exceeded',
      'labor_variance_alert',
      'labor_entry_reminder',
      'project_deadline_approaching',
      'project_status_changed',
      'budget_threshold_alert',
      'financial_snapshot_ready',
      'user_assigned_project',
      'user_role_changed',
      'document_uploaded',
      'system_announcement',
      'data_quality_issue'
    );
  END IF;
END $$;

-- Add type column if it doesn't exist
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS type notification_type;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;

-- Users can only view their own notifications
CREATE POLICY "users_view_own_notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "users_delete_own_notifications" ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type notification_type,
    p_priority VARCHAR DEFAULT 'medium',
    p_related_entity_type VARCHAR DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        priority,
        related_entity_type,
        related_entity_id,
        action_url,
        expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_priority,
        p_related_entity_type,
        p_related_entity_id,
        p_action_url,
        p_expires_at,
        p_metadata
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
    p_notification_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true,
        updated_at = NOW()
    WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid()
    AND is_read = false
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.notifications
        WHERE user_id = auth.uid()
        AND is_read = false
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired notifications (to be called by a scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET deleted_at = NOW()
    WHERE expires_at < NOW()
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;