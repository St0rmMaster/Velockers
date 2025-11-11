import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const BUILD_VERSION = 'get-tax-rate@2025-11-10-taxcloud-v3-cart';

const TAXCLOUD_CONNECTION_ID = Deno.env.get('TAXCLOUD_CONNECTION_ID') ?? '';
const TAXCLOUD_API_KEY = Deno.env.get('TAXCLOUD_API_KEY') ?? '';
const TAXCLOUD_ORIGIN_LINE1 = Deno.env.get('TAXCLOUD_ORIGIN_LINE1') ?? '';
const TAXCLOUD_ORIGIN_LINE2 = Deno.env.get('TAXCLOUD_ORIGIN_LINE2') ?? '';
const TAXCLOUD_ORIGIN_CITY = Deno.env.get('TAXCLOUD_ORIGIN_CITY') ?? '';
const TAXCLOUD_ORIGIN_STATE = Deno.env.get('TAXCLOUD_ORIGIN_STATE') ?? '';
const TAXCLOUD_ORIGIN_ZIP = Deno.env.get('TAXCLOUD_ORIGIN_ZIP') ?? '';
const TAXCLOUD_ORIGIN_COUNTRY = Deno.env.get('TAXCLOUD_ORIGIN_COUNTRY') ?? 'US';
const TAXCLOUD_DEFAULT_TIC = Deno.env.get('TAXCLOUD_DEFAULT_TIC') ?? '00000';
const DEFAULT_CUSTOMER_ID = Deno.env.get('TAXCLOUD_DEFAULT_CUSTOMER_ID') ?? 'configurator-customer';

const STATE_ABBREVIATIONS: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

function normalizeState(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const upper = trimmed.toUpperCase();
  return STATE_ABBREVIATIONS[upper] ?? trimmed.toUpperCase();
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  subtotal?: number;
  destination?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    zip?: string;
    countryCode?: string;
  };
  cartId?: string;
  customerId?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST is supported' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const body = (await req.json()) as RequestBody | null;

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!TAXCLOUD_CONNECTION_ID || !TAXCLOUD_API_KEY) {
      return new Response(JSON.stringify({ error: 'TaxCloud credentials not configured' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { subtotal, destination, cartId, customerId } = body;

    if (typeof subtotal !== 'number' || Number.isNaN(subtotal)) {
      return new Response(JSON.stringify({ error: 'subtotal is required and must be a number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      !destination ||
      !destination.line1 ||
      !destination.city ||
      !destination.state ||
      !destination.zip
    ) {
      return new Response(
        JSON.stringify({
          error: 'destination is required with line1, city, state, zip',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const normalizedState = normalizeState(destination.state);
    if (!normalizedState || normalizedState.length !== 2) {
      return new Response(
        JSON.stringify({
          error: 'Invalid destination state. Provide 2-letter state code or recognizable state name',
          details: { state: destination.state },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const normalizedOriginState = normalizeState(TAXCLOUD_ORIGIN_STATE);
    if (!normalizedOriginState || normalizedOriginState.length !== 2) {
      return new Response(
        JSON.stringify({
          error:
            'Invalid origin state. Ensure TAXCLOUD_ORIGIN_STATE is a 2-letter abbreviation or full state name',
          details: { state: TAXCLOUD_ORIGIN_STATE },
        }),
        {
          status: 501,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    if (!TAXCLOUD_ORIGIN_LINE1 || !TAXCLOUD_ORIGIN_CITY || !TAXCLOUD_ORIGIN_STATE || !TAXCLOUD_ORIGIN_ZIP) {
      return new Response(
        JSON.stringify({
          error: 'Origin address is not configured (TAXCLOUD_ORIGIN_LINE1/CITY/STATE/ZIP)',
        }),
        {
          status: 501,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const normalizedDestination = {
      line1: destination.line1,
      line2: destination.line2 ?? undefined,
      city: destination.city,
      state: destination.state,
      zip: destination.zip,
      countryCode: (destination.countryCode ?? 'US').toUpperCase(),
    };

    const ticNumber = Number.parseInt(TAXCLOUD_DEFAULT_TIC, 10);
    if (!Number.isFinite(ticNumber)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid TAXCLOUD_DEFAULT_TIC value. Must be a number (e.g., 0 or 10005).',
          details: { tic: TAXCLOUD_DEFAULT_TIC },
        }),
        { status: 501, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const payload = {
      items: [
        {
          cartId: cartId || `cart-${crypto.randomUUID()}`,
          customerId: customerId || DEFAULT_CUSTOMER_ID,
          currency: {
            currencyCode: 'USD',
          },
          destination: {
            ...normalizedDestination,
            state: normalizedState,
          },
          origin: {
            line1: TAXCLOUD_ORIGIN_LINE1,
            line2: TAXCLOUD_ORIGIN_LINE2 || undefined,
            city: TAXCLOUD_ORIGIN_CITY,
            state: normalizedOriginState,
            zip: TAXCLOUD_ORIGIN_ZIP,
            countryCode: TAXCLOUD_ORIGIN_COUNTRY,
          },
          lineItems: [
            {
              index: 0,
              itemId: 'configurator-cart',
              price: subtotal,
              quantity: 1,
              tic: ticNumber,
            },
          ],
        },
      ],
    };

    const url = `https://api.v3.taxcloud.com/tax/connections/${encodeURIComponent(
      TAXCLOUD_CONNECTION_ID,
    )}/carts`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': TAXCLOUD_API_KEY,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const raw = await resp.text();
      let errorDetails: any = { status: resp.status, raw };
      try {
        const jsonError = JSON.parse(raw);
        errorDetails = { ...errorDetails, ...jsonError };
      } catch {
        // Если не JSON, оставляем raw
      }
      console.error('TaxCloud API error (cart create):', errorDetails);
      return new Response(
        JSON.stringify({
          error: 'TaxCloud API error',
          message: `TaxCloud returned status ${resp.status}`,
          details: errorDetails,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const data = await resp.json();

    const firstItem = (data as any)?.items?.[0];
    const firstLineItem = firstItem?.lineItems?.[0];
    const taxInfo = firstLineItem?.tax;
    const taxRate = typeof taxInfo?.rate === 'number' ? taxInfo.rate : Number.parseFloat(taxInfo?.rate ?? '');
    const taxAmount =
      typeof taxInfo?.amount === 'number' ? taxInfo.amount : Number.parseFloat(taxInfo?.amount ?? '');

    if (!Number.isFinite(taxRate) || !Number.isFinite(taxAmount)) {
      console.error('Invalid tax response from TaxCloud:', data);
      return new Response(
        JSON.stringify({
          error: 'Invalid tax data from TaxCloud',
          message: 'Could not extract tax rate from TaxCloud response',
          details: { response: data },
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: BUILD_VERSION,
        rate: taxRate,
        amount: taxAmount,
        cart: firstItem ?? null,
        raw: data,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (error) {
    console.error('get-tax-rate error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});


