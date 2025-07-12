-- Check if two_factor_enabled column exists and add it if missing

-- First check if the column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'two_factor_enabled';

-- If the column doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    
    RAISE NOTICE 'Added two_factor_enabled column to users table';
  ELSE
    RAISE NOTICE 'two_factor_enabled column already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'two_factor_enabled';