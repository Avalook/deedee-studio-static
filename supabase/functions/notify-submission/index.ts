// Supabase Edge Function: email DeeDee when someone submits a form or posts a comment.
// Triggered by a Database Webhook (INSERT on form_submissions and comments). See docs/SUPABASE-NOTIFY.md.
//
// No shared secret is needed: the request is only a hint ("table X, row id Y"). The function looks the row up with
// the project's own service key (built into Edge Functions) and sends mail only if that row really exists and was
// created in the last few minutes. Row ids are random UUIDs that visitors cannot read, so nobody can make this
// function send mail by calling it. The email text comes from the database row, never from the request body.
// Secrets (set with `supabase secrets set`): RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO (comma separated).
import { buildNotification, isFreshRow, parseWebhook, sameSecret } from './email.mjs';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // Optional extra lock: if WEBHOOK_SECRET is set, the webhook must send it in x-webhook-secret.
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && !sameSecret(req.headers.get('x-webhook-secret'), secret)) return new Response('Unauthorized', { status: 401 });
  const hint = parseWebhook(await req.json().catch(() => null));
  if (!hint) return new Response('ignored');

  const lookup = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${hint.table}?id=eq.${hint.id}&select=*`, {
    headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
  });
  const row = lookup.ok ? (await lookup.json())[0] : null;
  if (!isFreshRow(row)) return new Response('unknown or stale row', { status: 404 });

  const mail = buildNotification({ type: 'INSERT', table: hint.table, record: row });
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
