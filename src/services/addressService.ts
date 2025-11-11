import { supabase } from '../lib/supabaseClient';

export interface AddressSuggestion {
  display: string;
  street: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  lat: string | null;
  lon: string | null;
}

export async function suggestAddresses(query: string, limit = 5): Promise<AddressSuggestion[]> {
  const { data, error } = await supabase.functions.invoke('address-suggest', {
    body: { q: query, limit, country: 'US' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch address suggestions');
  }

  const suggestions = (data && (data as any).suggestions) as AddressSuggestion[] | undefined;
  return Array.isArray(suggestions) ? suggestions : [];
}


