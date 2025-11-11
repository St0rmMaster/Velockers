import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const encoder = new TextEncoder();

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'Exce1sior Configurator <no-reply@exce1sior.app>';
const MANUFACTURER_EMAILS = (Deno.env.get('MANUFACTURER_APPROVAL_EMAILS') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://exce1sior.app';
const FUNCTIONS_BASE_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL') ?? `${PUBLIC_SITE_URL}/functions`;
const APPROVAL_SECRET = Deno.env.get('DEALER_APPROVAL_SECRET') ?? '';

if (!RESEND_API_KEY) {
  console.warn('send-email function: RESEND_API_KEY is not configured – emails will fail.');
}

if (!APPROVAL_SECRET) {
  console.warn('send-email function: DEALER_APPROVAL_SECRET is not configured – approval links will not be signed.');
}

type TemplatePayload =
  | {
      template: 'dealer-application';
      dealerId: string;
      dealerName: string;
      dealerEmail: string;
      region: string;
    }
  | {
      template: 'dealer-status-change';
      dealerId: string;
      dealerName: string;
      dealerEmail: string;
      region: string;
      status: 'approved' | 'rejected';
      reason?: string | null;
    };

async function getSigningKey() {
  if (!APPROVAL_SECRET) {
    throw new Error('Missing DEALER_APPROVAL_SECRET env variable');
  }

  return await crypto.subtle.importKey('raw', encoder.encode(APPROVAL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createApprovalLink(dealerId: string, action: 'approve' | 'reject') {
  const key = await getSigningKey();
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
  const token = await create({ alg: 'HS256', typ: 'JWT' }, { dealerId, action, exp }, key);
  const endpoint = `${FUNCTIONS_BASE_URL.replace(/\/$/, '')}/dealer-approval-action`;
  return `${endpoint}?token=${encodeURIComponent(token)}`;
}

async function sendResendEmail(payload: { to: string | string[]; subject: string; html: string; text?: string }) {
  if (!RESEND_API_KEY) {
    throw new Error('Resend API key not configured');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, ''),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${errorBody}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST requests are supported' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const payload = (await req.json()) as TemplatePayload;

    if (!payload?.template) {
      return new Response(JSON.stringify({ error: 'Missing template field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (payload.template === 'dealer-application') {
      if (!MANUFACTURER_EMAILS.length) {
        throw new Error('MANUFACTURER_APPROVAL_EMAILS env variable is required');
      }

      const approveLink = await createApprovalLink(payload.dealerId, 'approve');
      const rejectLink = await createApprovalLink(payload.dealerId, 'reject');
      const subject = `New dealer application: ${payload.dealerName}`;
      const html = `
        <h2>New Dealer Application</h2>
        <p><strong>Name:</strong> ${payload.dealerName}</p>
        <p><strong>Email:</strong> ${payload.dealerEmail}</p>
        <p><strong>Region:</strong> ${payload.region.toUpperCase()}</p>
        <p>Use the buttons below to approve or reject this application. Links expire in 24 hours.</p>
        <p>
          <a href="${approveLink}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#16a34a;color:#ffffff;text-decoration:none;margin-right:12px;">Approve</a>
          <a href="${rejectLink}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#ffffff;text-decoration:none;">Reject</a>
        </p>
        <p>or manage applications in the admin panel.</p>
      `;

      await sendResendEmail({
        to: MANUFACTURER_EMAILS,
        subject,
        html,
        text: `New dealer application from ${payload.dealerName} (${payload.dealerEmail}) in region ${payload.region}. Approve: ${approveLink} Reject: ${rejectLink}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (payload.template === 'dealer-status-change') {
      const subject = `Your Exce1sior dealer application has been ${payload.status}`;
      const reasonBlock =
        payload.status === 'rejected' && payload.reason
          ? `<p><strong>Reason:</strong> ${payload.reason}</p>`
          : '';
      const html = `
        <h2>Dealer Application Update</h2>
        <p>Hello ${payload.dealerName},</p>
        <p>Your dealer application for region ${payload.region.toUpperCase()} has been <strong>${payload.status}</strong>.</p>
        ${reasonBlock}
        <p>Thank you for your interest in Exce1sior.</p>
      `;

      await sendResendEmail({
        to: payload.dealerEmail,
        subject,
        html,
        text: `Hello ${payload.dealerName}, your dealer application has been ${payload.status}. ${payload.reason ?? ''}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported template' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('send-email function error', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
