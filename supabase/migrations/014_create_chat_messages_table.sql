-- Create chat_messages table for customer inquiries
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Customer information
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Message content
  message TEXT NOT NULL,
  
  -- Admin response
  admin_response TEXT,
  admin_response_at TIMESTAMP WITH TIME ZONE,
  admin_id UUID REFERENCES auth.users(id),
  
  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  
  -- Constraint: at least email or phone must be provided
  CONSTRAINT at_least_email_or_phone_chat CHECK (
    customer_email IS NOT NULL OR customer_phone IS NOT NULL
  )
);

-- Create indexes for faster queries
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_status ON public.chat_messages(status);
CREATE INDEX idx_chat_messages_customer_email ON public.chat_messages(customer_email);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert messages (anonymous users can send messages)
CREATE POLICY allow_public_insert_chat_messages
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can read all messages
CREATE POLICY allow_admin_read_chat_messages
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update messages
CREATE POLICY allow_admin_update_chat_messages
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins can delete messages
CREATE POLICY allow_admin_delete_chat_messages
ON public.chat_messages
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_chat_messages_updated_at_trigger
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_messages_updated_at();

-- Add comment to table
COMMENT ON TABLE public.chat_messages IS 'Customer inquiries from the configurator chat';

