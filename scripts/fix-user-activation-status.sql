-- Fix "Not Activated" status for existing users
-- This updates last_login_at for users who clearly have been using the system

-- First, let's see the current state
SELECT 
    id,
    email,
    first_name || ' ' || last_name as name,
    role,
    created_at,
    last_login_at,
    CASE 
        WHEN last_login_at IS NOT NULL THEN 'Active'
        ELSE 'Not Activated'
    END as current_status
FROM profiles
ORDER BY email;

-- Update last_login_at for all existing users who don't have it set
-- This assumes existing users have logged in at least once
UPDATE profiles
SET last_login_at = COALESCE(created_at, NOW())
WHERE last_login_at IS NULL;

-- Verify the update
SELECT 
    id,
    email,
    first_name || ' ' || last_name as name,
    role,
    created_at,
    last_login_at,
    CASE 
        WHEN last_login_at IS NOT NULL THEN 'Active'
        ELSE 'Not Activated'
    END as status_after_update
FROM profiles
ORDER BY email;

-- Add comment to track this fix
COMMENT ON COLUMN profiles.last_login_at IS 'Timestamp of last login. Initially populated for existing users on 2025-01-13 to fix display issue.';