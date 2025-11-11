#!/usr/bin/env node

/**
 * Fix Custom hull color metadata
 * 
 * Problem: metadata.priceEur is deprecated, should use metadata.priceUsd
 * This script removes priceEur from custom color metadata and ensures priceUsd is set correctly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCustomColorMetadata() {
  console.log('🔍 Finding custom color products...\n');

  // Find all color products with kind='custom'
  const { data: colorProducts, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('type', 'color')
    .filter('metadata->>kind', 'eq', 'custom');

  if (fetchError) {
    console.error('❌ Error fetching products:', fetchError);
    process.exit(1);
  }

  if (!colorProducts || colorProducts.length === 0) {
    console.log('✅ No custom color products found');
    return;
  }

  console.log(`Found ${colorProducts.length} custom color product(s)\n`);

  for (const product of colorProducts) {
    console.log(`📝 Processing: ${product.name} (${product.id})`);
    console.log(`   Current metadata:`, JSON.stringify(product.metadata, null, 2));

    const metadata = product.metadata || {};
    const priceEur = metadata.priceEur;
    const priceUsd = metadata.priceUsd;
    const currentPriceUsd = product.price_usd;

    let needsUpdate = false;
    const updates = {};

    // Check if priceEur exists (deprecated field)
    if (priceEur !== undefined) {
      console.log(`   ⚠️  Found deprecated priceEur: ${priceEur}`);
      needsUpdate = true;
    }

    // Determine the correct price
    let finalPriceUsd = currentPriceUsd || priceUsd || priceEur || 0;
    
    // If priceEur exists and priceUsd doesn't, convert (assuming 1.16 rate)
    if (priceEur && !priceUsd) {
      finalPriceUsd = Math.ceil(priceEur * 1.16 / 10) * 10;
      console.log(`   🔄 Converting EUR ${priceEur} to USD ${finalPriceUsd}`);
      needsUpdate = true;
    }

    // Build clean metadata without priceEur
    const cleanMetadata = { ...metadata };
    delete cleanMetadata.priceEur;
    
    // Ensure priceUsd is set in metadata
    cleanMetadata.priceUsd = finalPriceUsd;

    if (needsUpdate || JSON.stringify(cleanMetadata) !== JSON.stringify(metadata)) {
      updates.metadata = cleanMetadata;
      needsUpdate = true;
    }

    // Ensure price_usd field is set correctly
    if (currentPriceUsd !== finalPriceUsd) {
      updates.price_usd = finalPriceUsd;
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`   📤 Updating with:`, JSON.stringify(updates, null, 2));

      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id);

      if (updateError) {
        console.error(`   ❌ Error updating product:`, updateError);
        continue;
      }

      console.log(`   ✅ Updated successfully\n`);
    } else {
      console.log(`   ℹ️  No update needed\n`);
    }
  }

  console.log('✅ Done!');
}

// Run the fix
fixCustomColorMetadata().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

