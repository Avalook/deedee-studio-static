// Supabase Edge Function: email DeeDee when someone submits a form or posts a comment.
// Triggered by a Database Webhook (INSERT on form_submissions and comments). See docs/SUPABASE-NOTIFY.md.
// Secrets (set with `supabase secrets set`): WEBHOOK_SECRET, RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO (comma separated).
import { buildNotification, sameSecret } from './email.mjs';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!sameSecret(req.headers.get('x-webhook-secret'), Deno.env.get('WEBHOOK_SECRET'))) return new Response('Unauthorized', { status: 401 });
  const mail = buildNotification(await req.json().catch(() => null));
  if (!mail) return new Response('ignored');
  const to = (Deno.env.get('NOTIFY_TO') ?? '').split(',').map((address) => address.trim()).filter(Boolean);
  if (!to.length) return new Response('NOTIFY_TO is empty', { status: 500 });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('NOTIFY_FROM'), to, subject: mail.subject, text: mail.text }),
  });
  return new Response(response.ok ? 'sent' : 'failed', { status: response.ok ? 200 : 502 });
});
