-- Fix orders table: Add missing comment column if it doesn't exist
-- Run this in Supabase SQL Editor

-- Check if comment column exists, if not - add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'comment'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN comment TEXT;
        RAISE NOTICE 'Column "comment" added to orders table';
    ELSE
        RAISE NOTICE 'Column "comment" already exists in orders table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'orders'
ORDER BY ordinal_position;

