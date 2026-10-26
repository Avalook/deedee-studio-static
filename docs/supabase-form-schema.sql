-- Table for the contact and project-inquiry forms (scripts/form-submit.mjs).
-- Run this once in the Supabase SQL editor, then put the project URL and the *anon* (public) key into
-- supabase-config.json. Never put the service_role key in the site.

create table if not exists public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  form_label  text not null check (char_length(form_label) between 1 and 200),
  language    text not null check (language in ('vi', 'en')),
  page_path   text not null check (char_length(page_path) <= 300),
  name        text check (char_length(name) <= 200),
  email       text check (char_length(email) <= 320),
  phone       text check (char_length(phone) <= 60),
  -- every field as {key, label, value}, in form order, so the dashboard stays readable
  fields      jsonb not null check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 30 and pg_column_size(fields) <= 40000),
  handled     boolean not null default false
);

alter table public.form_submissions enable row level security;

-- Visitors (the anon role) may insert and nothing else: no select, update or delete policy exists,
-- so the public key cannot read anybody's submission back.
revoke all on public.form_submissions from anon, authenticated;
grant insert on public.form_submissions to anon;

drop policy if exists "visitors can submit forms" on public.form_submissions;
create policy "visitors can submit forms"
  on public.form_submissions
  for insert
  to anon
  with check (handled = false);

-- Read submissions in the Supabase dashboard (Table editor) or with the service_role key on a server.
-- Optional: get an email for each new row with a Database Webhook or an Edge Function on INSERT.
-- Optional: add Cloudflare Turnstile or hCaptcha in front of the insert if spam appears; the page only
-- applies a hidden-field honeypot and a 15 second cool-down per browser.
