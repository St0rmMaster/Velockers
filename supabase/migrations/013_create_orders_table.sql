-- Create orders table for customer orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Customer contact information
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  comment TEXT,
  
  -- Configuration snapshot
  configuration JSONB NOT NULL,
  
  -- Price information
  total_price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Order status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processing', 'completed', 'cancelled')),
  
  -- Webhook tracking (for future use)
  webhook_sent_at TIMESTAMP WITH TIME ZONE,
  webhook_response JSONB,
  
  -- Constraint: at least email or phone must be provided
  CONSTRAINT at_least_email_or_phone CHECK (
    customer_email IS NOT NULL OR customer_phone IS NOT NULL
  )
);

-- Create index for faster queries
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_customer_email ON public.orders(customer_email);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Public can insert orders (anonymous users can place orders)
CREATE POLICY allow_public_insert_orders
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can read all orders
CREATE POLICY allow_admin_read_orders
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update orders
CREATE POLICY allow_admin_update_orders
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_orders_updated_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();

-- Add comment to table
COMMENT ON TABLE public.orders IS 'Customer orders from the configurator';

