-- ========================================
-- Fix Custom hull color duplicate issue
-- ========================================
-- Problem: There are TWO records with "Custom hull color":
--   1. type='color' with kind='custom' - USED by configurator
--   2. type='option' - UNUSED duplicate
--
-- Solution: Delete the unused option record
-- ========================================

-- STEP 1: Show current state (before fix)
SELECT 
  id,
  type,
  name,
  price_usd,
  metadata->>'kind' as kind,
  metadata->>'code' as code,
  is_active
FROM products 
WHERE name ILIKE '%custom%hull%color%'
ORDER BY type;

-- STEP 2: Delete the UNUSED option record
DELETE FROM products
WHERE id = 'ac3e52e8-3d72-4d20-b9d9-cfe4d624ffc2'
  AND type = 'option'
  AND name = 'Custom hull color';

-- STEP 3: Verify - should only have ONE record left (type='color')
SELECT 
  id,
  type,
  name,
  price_usd,
  price_eur,
  metadata->>'kind' as kind,
  metadata->>'code' as code,
  metadata->>'priceUsd' as metadata_price_usd,
  is_active
FROM products 
WHERE name ILIKE '%custom%hull%color%'
ORDER BY type;

-- ========================================
-- Result: Only ONE record should remain:
--   id: 1596293c-5ef5-49ae-ae8b-814019bae1aa
--   type: color
--   metadata.kind: custom
-- ========================================

-- STEP 4 (OPTIONAL): Update price if needed
-- Uncomment if you want to change the price from 350 to 300:
/*
UPDATE products
SET 
  price_usd = 300.00,
  metadata = jsonb_set(metadata, '{priceUsd}', '300'),
  updated_at = now()
WHERE id = '1596293c-5ef5-49ae-ae8b-814019bae1aa'
  AND type = 'color';
*/

-- STEP 5: Final verification
SELECT 
  'After fix:' as status,
  id,
  type,
  name,
  price_usd,
  metadata->>'priceUsd' as metadata_price_usd,
  is_active
FROM products 
WHERE id = '1596293c-5ef5-49ae-ae8b-814019bae1aa';

