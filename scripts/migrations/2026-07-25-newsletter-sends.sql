-- Newsletter send log: ONE row per outgoing email (confirm / broadcast / reply / test),
-- so the admin can answer "how many mails has this address had", "who got this post",
-- and "which sends failed" without a per-subscriber counter that answers none of them.
-- Keyed by email, NOT a subscriber FK: reply notifications go to commenters who may
-- never have subscribed.
create table if not exists public.newsletter_sends (
  id         bigint generated always as identity primary key,
  email      text not null,
  kind       text not null check (kind in ('confirm', 'broadcast', 'reply', 'test')),
  post_slug  text,                                   -- broadcast only
  sent_at    timestamptz not null default now(),
  ok         boolean not null,                       -- false = SMTP refused it; see error
  error      text,
  -- Open tracking (broadcast only): an unguessable per-send token behind the 1x1 pixel.
  -- It identifies the SEND row, never the address, so the URL leaks nothing on its own.
  open_token text unique,
  opened_at  timestamptz
);
create index if not exists newsletter_sends_email_idx on public.newsletter_sends (email);
create index if not exists newsletter_sends_post_idx  on public.newsletter_sends (post_slug) where post_slug is not null;

alter table public.newsletter_sends enable row level security;   -- service_role BYPASSRLS
grant all on public.newsletter_sends to service_role;
grant all on all sequences in schema public to service_role;
