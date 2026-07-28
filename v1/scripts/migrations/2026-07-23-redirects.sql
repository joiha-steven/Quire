-- Migration: user-managed URL redirects (301/302). Run ONCE on the live DB.
-- Resolved in middleware so the client gets a real HTTP redirect (a page-level
-- redirect() under a route with loading.tsx downgrades to a 200 meta-refresh).
-- A slug rename auto-adds a permanent (301) redirect from the old path. Idempotent.

create table if not exists public.redirects (
  id          bigint generated always as identity primary key,
  source      text not null unique,           -- normalized request path, e.g. '/old-slug'
  destination text not null,                   -- path ('/new-slug') or absolute URL
  permanent   boolean not null default true,   -- true = 301, false = 302
  created_at  timestamptz not null default now()
);

alter table public.redirects enable row level security;   -- service_role BYPASSRLS; no policies
grant all on public.redirects to service_role;
grant all on all sequences in schema public to service_role;
