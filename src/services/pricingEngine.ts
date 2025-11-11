import type { DealerMarkup, Product } from '../types/database';

export interface PriceBreakdown {
  base_usd: number;
  material_price_usd: number;
  options_price_usd: number;
  subtotal_usd: number;
  markups: Array<{
    name: string;
    type: 'fixed' | 'percentage';
    value: number;
    applied_amount: number;
  }>;
  subtotal_after_markups: number;
  exchange_rate: number;
  currency: string;
  subtotal_local: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
}

export interface PricingInput {
  model: Product;
  material?: Product;
  options?: Product[];
  dealerMarkups?: DealerMarkup[];
  exchangeRate?: number;
  currency?: string;
  taxRate?: number;
  shippingCost?: number;
}

/**
 * Calculate complete price breakdown with dealer markup chain
 */
export function calculatePriceBreakdown(input: PricingInput): PriceBreakdown {
  const {
    model,
    material,
    options = [],
    dealerMarkups = [],
    exchangeRate = 1.0,
    currency = 'EUR',
    taxRate = 0,
    shippingCost = 0,
  } = input;

  // Step 1: Calculate base price in USD
  const base_usd = model.price_usd ?? model.price_eur ?? 0;
  const material_price_usd = material?.price_usd ?? material?.price_eur ?? 0;
  const options_price_usd = options.reduce((sum, opt) => sum + (opt.price_usd ?? opt.price_eur ?? 0), 0);
  const subtotal_usd = base_usd + material_price_usd + options_price_usd;

  // Step 2: Apply dealer markup chain
  const markupsApplied: Array<{
    name: string;
    type: 'fixed' | 'percentage';
    value: number;
    applied_amount: number;
  }> = [];

  let currentPrice = subtotal_usd;

  // Sort markups by order_index
  const sortedMarkups = [...dealerMarkups].sort((a, b) => a.order_index - b.order_index);

  for (const markup of sortedMarkups) {
    let appliedAmount = 0;

    if (markup.type === 'fixed') {
      // Fixed markup in dealer's local currency - convert to USD for calculation
      appliedAmount = markup.value / exchangeRate; // Convert local to USD
    } else if (markup.type === 'percentage') {
      // Percentage markup
      const basis = markup.basis === 'base' ? subtotal_usd : currentPrice;
      appliedAmount = basis * markup.value;
    }

    currentPrice += appliedAmount;

    markupsApplied.push({
      name: markup.name,
      type: markup.type,
      value: markup.value,
      applied_amount: appliedAmount,
    });
  }

  const subtotal_after_markups = currentPrice;

  // Step 3: Convert to dealer's local currency
  const subtotal_local = subtotal_after_markups * exchangeRate;

  // Step 4: Add tax
  const tax_amount = subtotal_local * taxRate;

  // Step 5: Add shipping
  const total = subtotal_local + tax_amount + shippingCost;

  return {
    base_usd,
    material_price_usd,
    options_price_usd,
    subtotal_usd,
    markups: markupsApplied,
    subtotal_after_markups,
    exchange_rate: exchangeRate,
    currency,
    subtotal_local,
    tax_rate: taxRate,
    tax_amount,
    shipping_cost: shippingCost,
    total,
  };
}

/**
 * Format price for display with currency symbol
 */
export function formatPriceWithCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
}

/**
 * Calculate price for preview (without tax/shipping)
 */
export function calculateQuickPrice(
  basePrice: number,
  markups: DealerMarkup[],
  exchangeRate: number = 1.0
): number {
  let price = basePrice;
  const sortedMarkups = [...markups].sort((a, b) => a.order_index - b.order_index);

  for (const markup of sortedMarkups) {
    if (markup.type === 'fixed') {
      price += markup.value / exchangeRate;
    } else {
      const basis = markup.basis === 'base' ? basePrice : price;
      price += basis * markup.value;
    }
  }

  return price * exchangeRate;
}

