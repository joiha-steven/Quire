-- Migration: newsletter — subscribers + SMTP config. Run ONCE on the live DB.
-- Double opt-in: a new subscriber is 'pending' until they click the confirm link
-- (token). SMTP creds live on integration_keys (server-only, never in settings.data).
-- Idempotent.

create table if not exists public.subscribers (
  id           bigint generated always as identity primary key,
  email        text not null unique,
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  token        text not null,                 -- secret for confirm + unsubscribe links
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists subscribers_status_idx on public.subscribers (status);
alter table public.subscribers enable row level security;   -- service_role BYPASSRLS

-- SMTP (Nodemailer) config — server-only secrets, like the Turnstile/Cloudflare keys.
alter table public.integration_keys add column if not exists smtp_host   text;
alter table public.integration_keys add column if not exists smtp_port   integer;
alter table public.integration_keys add column if not exists smtp_user   text;
alter table public.integration_keys add column if not exists smtp_pass   text;
alter table public.integration_keys add column if not exists smtp_from   text;
alter table public.integration_keys add column if not exists smtp_secure boolean not null default true;

grant all on public.subscribers to service_role;
grant all on all sequences in schema public to service_role;
