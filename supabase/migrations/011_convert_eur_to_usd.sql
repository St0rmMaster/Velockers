-- Exce1sior Configurator - Convert EUR to USD
-- Migration 011: Change price_eur to price_usd and convert all prices
-- Created: 2025-10-26
-- Purpose: Convert all prices from EUR to USD (multiply by 1.16, round up to nearest 10)

-- ============================================================================
-- ADD price_usd COLUMN TO PRODUCTS TABLE
-- ============================================================================

-- Add new column
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10, 2) DEFAULT 0;

-- Convert existing prices: EUR * 1.16, rounded up to nearest 10
UPDATE products
SET price_usd = CASE
  WHEN price_eur IS NOT NULL THEN CEILING((price_eur * 1.16) / 10) * 10
  ELSE 0
END
WHERE price_usd = 0;

-- Update metadata for models (basePrices array)
UPDATE products
SET metadata = jsonb_set(
  metadata::jsonb,
  '{basePrices}',
  (
    SELECT jsonb_agg(
      jsonb_set(
        jsonb_set(
          elem,
          '{amountUsd}',
          to_jsonb(CEILING((COALESCE((elem->>'amountEur')::numeric, 0) * 1.16) / 10) * 10)
        ),
        '{amountEur}',
        elem->'amountEur' -- Keep old value for compatibility
      )
    )
    FROM jsonb_array_elements(metadata->'basePrices') elem
  ),
  true
)::json
WHERE type = 'model' 
AND metadata ? 'basePrices'
AND jsonb_typeof(metadata->'basePrices') = 'array';

-- Update metadata for custom colors (priceUsd in metadata)
UPDATE products
SET metadata = jsonb_set(
  metadata::jsonb,
  '{priceUsd}',
  to_jsonb(CEILING((COALESCE((metadata->>'priceEur')::numeric, 0) * 1.16) / 10) * 10),
  true
)::json
WHERE type = 'color'
AND metadata ? 'kind'
AND metadata->>'kind' = 'custom'
AND metadata ? 'priceEur';

COMMENT ON COLUMN products.price_usd IS 'Product price in USD (converted from EUR at 1.16 rate)';
COMMENT ON COLUMN products.price_eur IS 'Legacy price in EUR (kept for backward compatibility)';

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================

SELECT 
  type,
  COUNT(*) as count,
  AVG(price_eur) as avg_eur,
  AVG(price_usd) as avg_usd,
  AVG(price_usd / NULLIF(price_eur, 0)) as avg_conversion_rate
FROM products
WHERE price_eur > 0
GROUP BY type
ORDER BY type;

-- Show sample conversions
SELECT 
  id,
  name,
  type,
  price_eur as "EUR Price",
  price_usd as "USD Price",
  ROUND(price_usd / NULLIF(price_eur, 0), 2) as "Conversion Rate"
FROM products
WHERE price_eur > 0
LIMIT 10;

