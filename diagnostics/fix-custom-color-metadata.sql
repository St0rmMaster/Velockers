-- Fix Custom hull color metadata
-- Removes deprecated priceEur field and ensures priceUsd is set correctly

-- Show current state
SELECT 
  id, 
  name, 
  type,
  price_usd,
  price_eur,
  metadata->>'kind' as kind,
  metadata->>'priceUsd' as metadata_price_usd,
  metadata->>'priceEur' as metadata_price_eur,
  metadata
FROM products 
WHERE type = 'color' 
  AND metadata->>'kind' = 'custom';

-- Fix the metadata for custom colors
-- This will:
-- 1. Remove the priceEur field from metadata
-- 2. Set priceUsd in metadata if not already set
-- 3. Update price_usd column to match

UPDATE products
SET 
  -- Calculate the correct price
  price_usd = COALESCE(
    (metadata->>'priceUsd')::numeric,
    (metadata->>'priceEur')::numeric * 1.16, -- Convert EUR to USD if needed
    price_usd,
    price_eur * 1.16,
    0
  ),
  -- Clean metadata: remove priceEur and ensure priceUsd is set
  metadata = jsonb_set(
    metadata - 'priceEur', -- Remove deprecated priceEur field
    '{priceUsd}',
    to_jsonb(
      COALESCE(
        (metadata->>'priceUsd')::numeric,
        (metadata->>'priceEur')::numeric * 1.16,
        price_usd,
        price_eur * 1.16,
        0
      )
    )
  ),
  updated_at = now()
WHERE type = 'color' 
  AND metadata->>'kind' = 'custom';

-- Verify the fix
SELECT 
  id, 
  name, 
  type,
  price_usd,
  metadata->>'kind' as kind,
  metadata->>'priceUsd' as metadata_price_usd,
  metadata->>'priceEur' as metadata_price_eur,
  metadata
FROM products 
WHERE type = 'color' 
  AND metadata->>'kind' = 'custom';

