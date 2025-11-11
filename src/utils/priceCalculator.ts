import type { Catalog, Configuration, PriceBreakdown } from '../types';
import { getBasePrice, getOption } from './catalogLoader';

/**
 * Calculate total price according to specification:
 * Total ex VAT = Base RRP (model × material) + Σ(selected options prices)
 */
export function calculatePrice(
  catalog: Catalog,
  configuration: Configuration
): PriceBreakdown {
  // 1. Get base price (RRP) for model × material combination
  const basePrice = getBasePrice(
    catalog,
    configuration.modelId,
    configuration.materialId
  ) || 0;

  // 2. Calculate options total
  let optionsTotal = 0;
  let customColorPrice = 0;

  for (const optionId of configuration.optionIds) {
    const option = getOption(catalog, optionId);
    if (option) {
      optionsTotal += option.priceUsd;
    }
  }

  // 3. Add custom color price if selected
  if (configuration.colour.type === 'custom') {
    customColorPrice = catalog.customColor.priceUsd;
    optionsTotal += customColorPrice;
  }

  // 4. Calculate total
  const total = basePrice + optionsTotal;

  return {
    basePrice,
    optionsTotal,
    customColorPrice,
    total,
  };
}

/**
 * Format price for display with USD symbol and thousand separators
 */
export function formatPrice(amount: number, locale: 'en' | 'ru' = 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validate price calculation (for testing)
 * Returns true if calculation matches expected value
 */
export function validatePrice(
  catalog: Catalog,
  configuration: Configuration,
  expectedTotal: number
): boolean {
  const result = calculatePrice(catalog, configuration);
  return Math.abs(result.total - expectedTotal) < 0.01; // Allow for floating point errors
}

