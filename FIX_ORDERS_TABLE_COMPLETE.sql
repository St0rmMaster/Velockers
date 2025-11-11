-- Complete fix for orders table: Add ALL missing columns
-- Run this in Supabase SQL Editor

-- Add customer_address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_address'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_address TEXT;
        RAISE NOTICE 'Column "customer_address" added';
    END IF;
END $$;

-- Add comment column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'comment'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN comment TEXT;
        RAISE NOTICE 'Column "comment" added';
    END IF;
END $$;

-- Add customer_name column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_name TEXT NOT NULL DEFAULT 'Unknown';
        RAISE NOTICE 'Column "customer_name" added';
    END IF;
END $$;

-- Add customer_email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_email TEXT;
        RAISE NOTICE 'Column "customer_email" added';
    END IF;
END $$;

-- Add customer_phone column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_phone TEXT;
        RAISE NOTICE 'Column "customer_phone" added';
    END IF;
END $$;

-- Add configuration column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'configuration'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN configuration JSONB NOT NULL DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Column "configuration" added';
    END IF;
END $$;

-- Add total_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN total_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE 'Column "total_price" added';
    END IF;
END $$;

-- Add currency column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN currency TEXT DEFAULT 'USD';
        RAISE NOTICE 'Column "currency" added';
    END IF;
END $$;

-- Add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processing', 'completed', 'cancelled'));
        RAISE NOTICE 'Column "status" added';
    END IF;
END $$;

-- Add webhook_sent_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'webhook_sent_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN webhook_sent_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Column "webhook_sent_at" added';
    END IF;
END $$;

-- Add webhook_response column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'webhook_response'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN webhook_response JSONB;
        RAISE NOTICE 'Column "webhook_response" added';
    END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Column "created_at" added';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Column "updated_at" added';
    END IF;
END $$;

-- Add constraint: at least email or phone must be provided
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'at_least_email_or_phone'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT at_least_email_or_phone 
        CHECK (customer_email IS NOT NULL OR customer_phone IS NOT NULL);
        RAISE NOTICE 'Constraint "at_least_email_or_phone" added';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Constraint already exists or error: %', SQLERRM;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_orders_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_orders_updated_at_trigger
        BEFORE UPDATE ON public.orders
        FOR EACH ROW
        EXECUTE FUNCTION public.update_orders_updated_at();
        RAISE NOTICE 'Trigger "update_orders_updated_at_trigger" created';
    END IF;
END $$;

-- Show all columns in orders table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'orders'
ORDER BY ordinal_position;

