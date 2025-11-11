import { supabase } from '../lib/supabaseClient';

export interface TaxRateRequest {
  zip: string;
  country?: string; // default 'US'
  state?: string;
  city?: string;
  street?: string;
}

export async function getTaxRateByZip(params: TaxRateRequest): Promise<number> {
  const { zip, country = 'US', state, city, street } = params;
  const { data, error } = await supabase.functions.invoke('get-tax-rate', {
    body: { zip, country, state, city, street },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch tax rate');
  }

  const rate = (data && (data as any).rate) as number | undefined;
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    throw new Error('Invalid tax rate response');
  }
  return rate;
}


