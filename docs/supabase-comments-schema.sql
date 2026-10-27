-- Guest comments for the articles (scripts/comment-submit.mjs). Run once in the Supabase SQL editor.
-- Visitors (the anon role) may post a comment that is NOT approved yet, and may read only approved comments.
-- A publisher approves or deletes comments in the CMS (/admin/submissions) with the service_role key.

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  post_path   text not null check (char_length(post_path) between 1 and 300),
  language    text not null check (language in ('vi', 'en')),
  author_name text not null check (char_length(author_name) between 1 and 80),
  body        text not null check (char_length(body) between 1 and 2000),
  approved    boolean not null default false
);

alter table public.comments enable row level security;

revoke all on public.comments from anon, authenticated;
grant insert (post_path, language, author_name, body) on public.comments to anon;
grant select (post_path, author_name, body, created_at) on public.comments to anon;
grant select, insert, update, delete on public.comments to service_role;

drop policy if exists "visitors can post comments" on public.comments;
create policy "visitors can post comments" on public.comments
  for insert to anon with check (approved = false);

drop policy if exists "everyone can read approved comments" on public.comments;
create policy "everyone can read approved comments" on public.comments
  for select to anon using (approved = true);

create index if not exists comments_post_idx on public.comments (post_path, created_at) where approved;
create index if not exists comments_pending_idx on public.comments (created_at desc) where not approved;

-- Bound anonymous traffic at the database (a small shared bucket, no visitor identifiers stored).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.comment_rate_buckets (
  minute timestamptz primary key,
  hits integer not null
);
revoke all on private.comment_rate_buckets from public, anon, authenticated;

create or replace function private.guard_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_minute timestamptz := date_trunc('minute', statement_timestamp());
  bucket_hits integer;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('role', true)) = 'anon' then
    insert into private.comment_rate_buckets (minute, hits) values (bucket_minute, 1)
      on conflict (minute) do update set hits = private.comment_rate_buckets.hits + 1
      returning hits into bucket_hits;
    if bucket_hits > 20 then
      raise exception 'Comment rate limit reached; please try again later' using errcode = 'P0001';
    end if;
    delete from private.comment_rate_buckets where minute < bucket_minute - interval '2 minutes';
  end if;
  new.created_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function private.guard_comment() from public, anon, authenticated;
drop trigger if exists guard_comment on public.comments;
create trigger guard_comment before insert on public.comments
  for each row execute function private.guard_comment();
