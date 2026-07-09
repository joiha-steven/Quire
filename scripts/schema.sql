-- quire — full Postgres schema (Supabase).
-- Run this ONCE on a fresh Supabase project to create every table, index, and RPC
-- the app needs. Paste it into the Supabase SQL Editor (Dashboard → SQL Editor →
-- New query → Run), or pipe it through psql with your connection string.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- The app connects with the service_role key, which BYPASSES row-level security, so
-- RLS is enabled with no public policies — i.e. nothing is reachable with the anon
-- key, all access is server-side only. Binaries (images/files/icons) live on the
-- local filesystem, not here; these tables hold text + metadata only.

-- ----- schema_migrations -----------------------------------------------------
-- Ledger of which files in scripts/migrations/ have run, so scripts/migrate.sh
-- applies only NEW ones on upgrade. A fresh install applies THIS file (which already
-- includes every past migration's effect), so we seed those filenames as applied —
-- keep this list in sync when you add a migration (its effect goes in this file too).
create table if not exists public.schema_migrations (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
insert into public.schema_migrations (name) values
  ('2026-06-25-analytics-deepening.sql'),
  ('2026-06-25-analytics-fix-visitor-counts.sql')
on conflict (name) do nothing;

-- ----- posts -----------------------------------------------------------------
create table if not exists public.posts (
  slug            text primary key,
  title           text not null default '',
  date            timestamptz not null default now(),
  status          text not null default 'draft' check (status in ('draft', 'published')),
  categories      text[] not null default '{}',
  tags            text[] not null default '{}',
  featured_image  text,
  excerpt         text,
  reading_minutes integer,
  content         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Soft delete: NULL = live, a timestamp = in Trash. Nothing is hard-deleted on a
  -- normal delete; permanent removal happens only on explicit Trash purge.
  deleted_at      timestamptz,
  -- Full-text vector over title + body (accent-sensitive 'simple' config; the
  -- /search route's local layer adds accent-insensitivity). Maintained by Postgres.
  search          tsvector generated always as (
                    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
                  ) stored
);
alter table public.posts add column if not exists deleted_at timestamptz;
create index if not exists posts_status_date_idx on public.posts (status, date desc);
create index if not exists posts_search_gin      on public.posts using gin (search);
create index if not exists posts_categories_gin  on public.posts using gin (categories);
create index if not exists posts_tags_gin        on public.posts using gin (tags);
create index if not exists posts_deleted_at_idx   on public.posts (deleted_at);

-- ----- pages (share the /{slug} namespace with posts) ------------------------
create table if not exists public.pages (
  slug            text primary key,
  title           text not null default '',
  status          text not null default 'draft' check (status in ('draft', 'published')),
  featured_image  text,
  content         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz -- soft delete: NULL = live, timestamp = in Trash
);
alter table public.pages add column if not exists deleted_at timestamptz;
create index if not exists pages_deleted_at_idx on public.pages (deleted_at);

-- ----- post_revisions (time machine: last 3 per post) ------------------------
create table if not exists public.post_revisions (
  id        bigint generated always as identity primary key,
  slug      text not null,
  data      jsonb not null,
  saved_at  timestamptz not null default now()
);
create index if not exists post_revisions_slug_idx on public.post_revisions (slug, saved_at desc);

-- ----- media (image metadata; binaries on Blob) ------------------------------
create table if not exists public.media (
  path        text primary key,
  filename    text not null,
  size        bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  width       integer,
  height      integer,
  thumb       text,
  variants    boolean not null default false,
  deleted_at  timestamptz -- soft delete: NULL = live, timestamp = in Trash (blob kept until purge)
);
alter table public.media add column if not exists deleted_at timestamptz;
create index if not exists media_uploaded_at_idx on public.media (uploaded_at desc);
create index if not exists media_deleted_at_idx  on public.media (deleted_at);

-- ----- files (attachment metadata; binaries on Blob) -------------------------
create table if not exists public.files (
  url          text primary key,
  filename     text not null,
  size         bigint not null default 0,
  content_type text not null default '',
  uploaded_at  timestamptz not null default now(),
  deleted_at   timestamptz -- soft delete: NULL = live, timestamp = in Trash (blob kept until purge)
);
alter table public.files add column if not exists deleted_at timestamptz;
create index if not exists files_uploaded_at_idx on public.files (uploaded_at desc);
create index if not exists files_deleted_at_idx  on public.files (deleted_at);

-- ----- comments (per-post reader comments; text only) ------------------------
-- `parent_id` is a plain self-reference (NO FK constraint on purpose): purging one
-- comment must never cascade-delete live replies. The tree is rebuilt in the app,
-- which re-roots any orphan (parent purged) and renders a deleted-but-still-replied
-- node as a tombstone. `depth` (0..2) enforces the 3-tier reply limit at WRITE time;
-- display nesting is recomputed from the actual ancestry present. Soft delete like
-- every other table (Invariant 6): NULL = live, timestamp = in Trash.
create table if not exists public.comments (
  id             bigint generated always as identity primary key,
  post_slug      text not null,
  parent_id      bigint,
  depth          smallint not null default 0 check (depth between 0 and 2),
  author_name    text not null default '',
  author_email   text not null default '',  -- admin-only; NEVER sent to the public client
  author_website text,
  author_ip      text,                       -- admin-only; client IP captured at submit
  author_country text,                       -- admin-only; ISO 3166-1 alpha-2 from the edge
  provider       text not null default 'manual' check (provider in ('manual', 'google', 'facebook')),
  content        text not null default '',   -- limited markdown source (<=1000 chars), rendered safe on read
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists comments_post_idx       on public.comments (post_slug, deleted_at, created_at);
create index if not exists comments_parent_idx     on public.comments (parent_id);
create index if not exists comments_deleted_at_idx on public.comments (deleted_at);

-- ----- settings (single row, id = 1) -----------------------------------------
create table if not exists public.settings (
  id   integer primary key default 1 check (id = 1),
  data jsonb not null
);

-- ----- mcp_tokens (MCP server access tokens; only the SHA-256 hash is stored) --
-- The plaintext token is shown once on creation and never persisted. `prefix` is a
-- short non-secret display hint (e.g. "vbmcp_AbCd"). Max 5 enforced in the app.
create table if not exists public.mcp_tokens (
  id           bigint generated always as identity primary key,
  name         text not null default '',
  token_hash   text not null unique,
  prefix       text not null default '',
  created_at   timestamptz not null default now(),
  -- Tokens expire 180 days after creation; the app sets this explicitly on insert
  -- and rejects an expired bearer. (Connectors silently re-authorize; a manual
  -- token must be recreated.)
  expires_at   timestamptz not null default (now() + interval '180 days'),
  last_used_at timestamptz
);
create index if not exists mcp_tokens_hash_idx on public.mcp_tokens (token_hash);
-- Upgrade path: add expires_at to a pre-existing mcp_tokens table (no-op on fresh installs).
alter table public.mcp_tokens
  add column if not exists expires_at timestamptz not null default (now() + interval '180 days');

-- ----- mcp_clients (OAuth Dynamic Client Registration; redirect_uri allowlist) --
-- A connector registers via /api/mcp/register; we mint a unique client_id and store
-- its redirect_uris. /api/mcp/authorize accepts a redirect_uri only if it exactly
-- matches one here (or is a loopback address) — closes the open-redirect hole.
create table if not exists public.mcp_clients (
  client_id     text primary key,
  redirect_uris text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- ----- mcp_used_codes (single-use OAuth authorization codes; replay guard) -------
-- One row per consumed code jti. Codes are stateless HMAC blobs; the token endpoint
-- inserts the jti on first exchange and the PRIMARY KEY rejects any replay. expires_at
-- mirrors the code's own expiry so spent rows can be swept (optional; an expired code
-- is already rejected upstream).
create table if not exists public.mcp_used_codes (
  jti        text primary key,
  expires_at timestamptz not null
);
create index if not exists mcp_used_codes_expires_idx on public.mcp_used_codes (expires_at);

-- ----- backup_state (Google Drive backup: secret refresh token + run state) ---
-- Single row (id=1). The refresh_token is a SECRET and never leaves the server —
-- it is NOT stored in `settings.data` (which is sent to the admin client). Backup
-- config (enabled/interval/keep) lives in settings; only secrets + run state here.
create table if not exists public.backup_state (
  id            int primary key default 1,
  refresh_token text,
  folder_id     text,
  last_run_at   timestamptz,
  last_status   text,
  last_error    text,
  last_size     bigint,
  constraint backup_state_singleton check (id = 1)
);

-- ----- integration_keys (server-only secrets for OPTIONAL comment features) ---
-- Single row (id=1). Turnstile keys the owner enters in Admin → Settings. SECRET —
-- like backup_state, NEVER read into settings.data / the client payload. Env vars
-- of the same name still work as a fallback.
create table if not exists public.integration_keys (
  id                   int primary key default 1 check (id = 1),
  turnstile_site_key   text,
  turnstile_secret_key text,
  cloudflare_api_token text,
  cloudflare_zone_id   text,
  constraint integration_keys_singleton check (id = 1)
);
-- Upgrade path: drop the removed Facebook-login columns from a pre-existing table,
-- and add the Cloudflare cache-purge columns to a pre-existing table.
alter table public.integration_keys
  drop column if exists facebook_id,
  drop column if exists facebook_secret;
alter table public.integration_keys
  add column if not exists cloudflare_api_token text,
  add column if not exists cloudflare_zone_id text;

-- ----- activity_log ----------------------------------------------------------
create table if not exists public.activity_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  action text not null,
  detail text not null default ''
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);

-- ----- analytics_events (one row per page view; no PII — visitor is a salted hash) -
create table if not exists public.analytics_events (
  id            bigint generated always as identity primary key,
  path          text not null,
  visitor       text not null,
  referrer_host text,                         -- external referrer host (no path/query); null = direct/internal
  country       text,                          -- ISO 3166-1 alpha-2 from the edge, if available
  created_at    timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_path_idx    on public.analytics_events (path);

-- ----- analytics_scroll (max scroll depth sample per page leave) --------------
create table if not exists public.analytics_scroll (
  id         bigint generated always as identity primary key,
  path       text not null,
  depth      integer not null,
  visitor    text not null,
  created_at timestamptz not null default now()
);
create index if not exists analytics_scroll_created_idx on public.analytics_scroll (created_at);
create index if not exists analytics_scroll_path_idx    on public.analytics_scroll (path);

-- ----- RLS: lock every table to server-side (service_role) access only --------
alter table public.posts            enable row level security;
alter table public.pages            enable row level security;
alter table public.comments         enable row level security;
alter table public.post_revisions   enable row level security;
alter table public.media            enable row level security;
alter table public.files            enable row level security;
alter table public.settings         enable row level security;
alter table public.backup_state     enable row level security;
alter table public.integration_keys enable row level security;
alter table public.mcp_tokens       enable row level security;
alter table public.mcp_clients      enable row level security;
alter table public.mcp_used_codes   enable row level security;
alter table public.activity_log     enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_scroll enable row level security;

-- ----- RPC: analytics summary for the admin dashboard ------------------------
-- since   = window start; top_n = how many top pages; bucket = 'hour' (24h range)
-- or 'day'; prev_since = start of the PREVIOUS window [prev_since, since) used for
-- the period-over-period trend (null -> no trend). Also returns new/returning
-- visitor counts and the top referrer hosts + countries (group B). The old 3-arg
-- signature is dropped in the same migration so calls stay unambiguous.
create or replace function public.analytics_summary(
  since timestamptz,
  top_n integer default 10,
  bucket text default 'day',
  prev_since timestamptz default null
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totalViews', (select count(*) from public.analytics_events where created_at >= since),
    'uniqueVisitors', (select count(distinct visitor) from public.analytics_events where created_at >= since),
    'avgReadDepth', (select coalesce(round(avg(depth))::int, 0) from public.analytics_scroll where created_at >= since),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors, 'avgDepth', avg_depth))
      from (
        select e.path,
               count(*)::int as views,
               count(distinct e.visitor)::int as visitors,
               (select coalesce(round(avg(s.depth))::int, 0)
                  from public.analytics_scroll s
                  where s.path = e.path and s.created_at >= since) as avg_depth
        from public.analytics_events e
        where e.created_at >= since
        group by e.path
        order by count(*) desc
        limit top_n
      ) x
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'visitors', visitors))
      from (
        select to_char(date_trunc(bucket, created_at),
                       case when bucket = 'hour' then 'YYYY-MM-DD HH24:00' else 'YYYY-MM-DD' end) as day,
               count(*)::int as views,
               count(distinct visitor)::int as visitors
        from public.analytics_events
        where created_at >= since
        group by date_trunc(bucket, created_at)
        order by date_trunc(bucket, created_at)
      ) d
    ), '[]'::jsonb),
    -- Previous window [prev_since, since) for the trend; null when prev_since is null.
    'prevViews', (select count(*) from public.analytics_events
                    where prev_since is not null and created_at >= prev_since and created_at < since),
    'prevVisitors', (select count(distinct visitor) from public.analytics_events
                       where prev_since is not null and created_at >= prev_since and created_at < since),
    -- A visitor in the window who also has an event before `since` is "returning".
    'returningVisitors', (
      select count(distinct e.visitor) from public.analytics_events e
      where e.created_at >= since
        and exists (select 1 from public.analytics_events p
                      where p.visitor = e.visitor and p.created_at < since)
    ),
    -- Referrers + countries count DISTINCT VISITORS (one person = 1), not views.
    'topReferrers', coalesce((
      select jsonb_agg(jsonb_build_object('host', host, 'visitors', visitors))
      from (
        select referrer_host as host, count(distinct visitor)::int as visitors
        from public.analytics_events
        where created_at >= since and referrer_host is not null and referrer_host <> ''
        group by referrer_host order by count(distinct visitor) desc limit top_n
      ) r
    ), '[]'::jsonb),
    'topCountries', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'visitors', visitors))
      from (
        select country, count(distinct visitor)::int as visitors
        from public.analytics_events
        where created_at >= since and country is not null and country <> ''
        group by country order by count(distinct visitor) desc limit top_n
      ) c
    ), '[]'::jsonb)
  );
$$;

-- ----- RPC: all-time view totals per path (the content tables' View column) ---
create or replace function public.analytics_totals()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(path, c), '{}'::jsonb)
  from (select path, count(*)::int c from public.analytics_events group by path) t;
$$;
