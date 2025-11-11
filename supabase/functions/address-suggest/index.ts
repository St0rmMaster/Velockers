import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const BUILD_VERSION = 'address-suggest@2025-11-10-01';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  q?: string;
  limit?: number;
  country?: string; // default 'US'
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
    const body = (await req.json()) as RequestBody;
    const q = String(body?.q || '').trim();
    const limit = Math.min(Math.max(Number(body?.limit ?? 5), 1), 10);
    const country = (body?.country || 'US').toLowerCase();

    if (!q || q.length < 3) {
      return new Response(JSON.stringify({ success: true, version: BUILD_VERSION, suggestions: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const search = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      countrycodes: country,
      limit: String(limit),
      q,
    });

    const url = `https://nominatim.openstreetmap.org/search?${search.toString()}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        // Nominatim просит осмысленный User-Agent
        'User-Agent': 'Exce1siorConfigurator/1.0 (Edge Function address-suggest)',
      },
    });

    if (!resp.ok) {
      const raw = await resp.text();
      return new Response(JSON.stringify({ error: 'Geocoding provider error', status: resp.status, raw }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = (await resp.json()) as Array<any>;
    const suggestions = (data || []).map((item) => {
      const a = item?.address ?? {};
      const city = a.city || a.town || a.village || a.hamlet || a.suburb || null;
      const street = [a.house_number, a.road].filter(Boolean).join(' ').trim() || null;
      const state = a.state || null;
      const postcode = a.postcode || null;
      return {
        display: item?.display_name || '',
        street,
        city,
        state,
        postcode,
        lat: item?.lat || null,
        lon: item?.lon || null,
      };
    });

    return new Response(JSON.stringify({ success: true, version: BUILD_VERSION, suggestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('address-suggest error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});


