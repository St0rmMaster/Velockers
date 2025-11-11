// Currency conversion service using ECB API

const ECB_API_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const CACHE_KEY = 'ecb_currency_rates';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface CurrencyRates {
  rates: Record<string, number>;
  timestamp: string;
  base: 'EUR';
}

/**
 * Fetch current exchange rates from ECB API
 */
export async function fetchECBRates(): Promise<CurrencyRates> {
  try {
    const response = await fetch(ECB_API_URL);
    if (!response.ok) {
      throw new Error(`ECB API returned ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML using DOMParser (built-in browser API)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Extract rates from XML
    const cubeElements = xmlDoc.getElementsByTagName('Cube');
    const rates: Record<string, number> = { EUR: 1.0 }; // EUR base rate is always 1.0
    
    for (let i = 0; i < cubeElements.length; i++) {
      const cube = cubeElements[i];
      const currency = cube.getAttribute('currency');
      const rate = cube.getAttribute('rate');
      
      if (currency && rate) {
        rates[currency] = parseFloat(rate);
      }
    }

    const result: CurrencyRates = {
      rates,
      timestamp: new Date().toISOString(),
      base: 'EUR',
    };

    // Cache the result
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: result,
      cachedAt: Date.now(),
    }));

    return result;
  } catch (error) {
    console.error('Failed to fetch ECB rates:', error);
    
    // Try to return cached data
    const cached = getCachedRates();
    if (cached) {
      console.warn('Using cached currency rates due to API failure');
      return cached;
    }

    // Fallback: return 1:1 rates with warning
    console.warn('No cached rates available, using 1:1 fallback');
    return {
      rates: { EUR: 1.0, USD: 1.0, GBP: 1.0, CNY: 1.0, JPY: 1.0, SGD: 1.0 },
      timestamp: new Date().toISOString(),
      base: 'EUR',
    };
  }
}

/**
 * Get cached rates from localStorage
 */
function getCachedRates(): CurrencyRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, cachedAt } = JSON.parse(cached);
    
    // Check if cache is still valid (24h TTL)
    const age = Date.now() - cachedAt;
    if (age > CACHE_TTL) {
      return null; // Cache expired
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Get exchange rates (from cache or fresh fetch)
 */
export async function getExchangeRates(): Promise<CurrencyRates> {
  // Try cache first
  const cached = getCachedRates();
  if (cached) {
    return cached;
  }

  // Fetch fresh rates
  return fetchECBRates();
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: number; rate: number }> {
  const rates = await getExchangeRates();

  const fromRate = rates.rates[fromCurrency] || 1.0;
  const toRate = rates.rates[toCurrency] || 1.0;

  // Convert: amount in FROM → EUR → TO
  const amountInEUR = amount / fromRate;
  const amountInTO = amountInEUR * toRate;
  
  const exchangeRate = toRate / fromRate;

  return {
    amount: amountInTO,
    rate: exchangeRate,
  };
}

/**
 * Get specific exchange rate (EUR to target currency)
 */
export async function getExchangeRate(currency: string): Promise<number> {
  const rates = await getExchangeRates();
  return rates.rates[currency] || 1.0;
}

/**
 * Check if cached rates are still fresh
 */
export function isCacheFresh(): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const { cachedAt } = JSON.parse(cached);
    const age = Date.now() - cachedAt;
    
    return age < CACHE_TTL;
  } catch {
    return false;
  }
}

/**
 * Force refresh of currency rates
 */
export async function refreshRates(): Promise<CurrencyRates> {
  localStorage.removeItem(CACHE_KEY);
  return fetchECBRates();
}

/**
 * Get list of supported currencies
 */
export async function getSupportedCurrencies(): Promise<string[]> {
  const rates = await getExchangeRates();
  return Object.keys(rates.rates).sort();
}

