-- Migration: analytics v2 (timezone-correct buckets, audience, engagement,
-- channel grouping, per-page drill-down). Run ONCE on the live DB. The app is
-- resilient: getAnalytics falls back to the pre-v2 shape until this runs, so
-- nothing breaks; after it runs the new sections light up. Idempotent.

-- 1) Audience columns on analytics_events (coarse UA buckets — NOT the raw UA, so
--    no fingerprint / no new PII). recordView fills them going forward; old rows
--    stay null and are grouped as 'Unknown' by the RPC.
alter table public.analytics_events add column if not exists device  text;  -- desktop | mobile | tablet
alter table public.analytics_events add column if not exists browser text;  -- Chrome | Safari | …
alter table public.analytics_events add column if not exists os      text;  -- Windows | iOS | …

-- 2) Engagement: dwell time (ms on the page before leaving) on the scroll sample.
alter table public.analytics_scroll add column if not exists dwell_ms integer;

-- Helpful indexes for the audience group-bys and the per-page drill-down.
create index if not exists analytics_events_device_idx on public.analytics_events (device);
create index if not exists analytics_scroll_dwell_idx  on public.analytics_scroll (dwell_ms);

-- 3) Replace analytics_summary with the tz-aware v2 (adds tz param; time buckets
--    are truncated in the owner's timezone so "days" line up with local midnight).
--    Drop the old 4-arg overload so a 4-arg call stays unambiguous.
--    NOTE: the helper functions analytics_channel / analytics_facet must be
--    created BEFORE analytics_summary — its SQL body references them and Postgres
--    validates the body at creation (check_function_bodies).
drop function if exists public.analytics_summary(timestamptz, integer, text, timestamptz);

-- Classify a referrer host into a traffic channel. Direct = no referrer.
create or replace function public.analytics_channel(host text)
returns text language sql immutable as $$
  select case
    when host is null or host = '' then 'direct'
    when host ~* 'google\.|bing\.|yahoo\.|duckduckgo|yandex|baidu|ecosia\.|brave\.|startpage|search\.' then 'search'
    when host ~* 'facebook|fb\.com|instagram|twitter|(^|\.)x\.com|t\.co|linkedin|reddit|youtu|pinterest|tiktok|threads\.net|mastodon|telegram|t\.me|whatsapp|(^|\.)vk\.com' then 'social'
    else 'referral'
  end;
$$;

-- Top N distinct-visitor counts for one low-cardinality column (device/browser/os).
-- Null values are surfaced as 'Unknown' so pre-v2 rows still show up.
create or replace function public.analytics_facet(since timestamptz, col text, top_n integer)
returns jsonb language plpgsql stable as $$
declare result jsonb;
begin
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'visitors', visitors) order by visitors desc), '[]'::jsonb)
    from (
      select coalesce(nullif(%I, ''), 'Unknown') as name, count(distinct visitor)::int as visitors
      from public.analytics_events where created_at >= $1
      group by 1 order by count(distinct visitor) desc limit $2
    ) f
  $q$, col) into result using since, top_n;
  return result;
end;
$$;

create or replace function public.analytics_summary(
  since timestamptz,
  top_n integer default 10,
  bucket text default 'day',
  prev_since timestamptz default null,
  tz text default 'UTC'
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totalViews', (select count(*) from public.analytics_events where created_at >= since),
    'uniqueVisitors', (select count(distinct visitor) from public.analytics_events where created_at >= since),
    'avgReadDepth', (select coalesce(round(avg(depth))::int, 0) from public.analytics_scroll where created_at >= since),
    'avgDwellMs', (select coalesce(round(avg(dwell_ms))::int, 0)
                     from public.analytics_scroll where created_at >= since and dwell_ms is not null),
    -- Visitors who viewed exactly one page in the window (bounce-ish signal).
    'singlePageVisitors', (
      select count(*) from (
        select visitor from public.analytics_events
        where created_at >= since group by visitor having count(*) = 1
      ) s
    ),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors,
                                          'avgDepth', avg_depth, 'avgDwellMs', avg_dwell))
      from (
        select e.path,
               count(*)::int as views,
               count(distinct e.visitor)::int as visitors,
               (select coalesce(round(avg(s.depth))::int, 0)
                  from public.analytics_scroll s
                  where s.path = e.path and s.created_at >= since) as avg_depth,
               (select coalesce(round(avg(s.dwell_ms))::int, 0)
                  from public.analytics_scroll s
                  where s.path = e.path and s.created_at >= since and s.dwell_ms is not null) as avg_dwell
        from public.analytics_events e
        where e.created_at >= since
        group by e.path
        order by count(*) desc
        limit top_n
      ) x
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'visitors', visitors) order by ord)
      from (
        select date_trunc(bucket, created_at at time zone tz) as ord,
               to_char(date_trunc(bucket, created_at at time zone tz),
                       case bucket when 'hour' then 'YYYY-MM-DD HH24:00'
                                   when 'month' then 'YYYY-MM'
                                   else 'YYYY-MM-DD' end) as day,
               count(*)::int as views,
               count(distinct visitor)::int as visitors
        from public.analytics_events
        where created_at >= since
        group by 1, 2
      ) d
    ), '[]'::jsonb),
    'prevViews', (select count(*) from public.analytics_events
                    where prev_since is not null and created_at >= prev_since and created_at < since),
    'prevVisitors', (select count(distinct visitor) from public.analytics_events
                       where prev_since is not null and created_at >= prev_since and created_at < since),
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
    ), '[]'::jsonb),
    -- Traffic channels: derived from the referrer host, distinct visitors each.
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'visitors', visitors) order by visitors desc)
      from (
        select public.analytics_channel(referrer_host) as channel, count(distinct visitor)::int as visitors
        from public.analytics_events where created_at >= since
        group by 1
      ) ch
    ), '[]'::jsonb),
    'devices',  public.analytics_facet(since, 'device',  top_n),
    'browsers', public.analytics_facet(since, 'browser', top_n),
    'systems',  public.analytics_facet(since, 'os',      top_n),
    -- Read-depth distribution: quartile buckets of the scroll samples.
    'depthBuckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket, 'samples', samples) order by bucket)
      from (
        select least(3, depth / 25) as bucket, count(*)::int as samples
        from public.analytics_scroll where created_at >= since
        group by 1
      ) b
    ), '[]'::jsonb)
  );
$$;

-- 4) Per-page drill-down: one page's trend, sources, audience + engagement.
create or replace function public.analytics_page(
  page_path text,
  since timestamptz,
  bucket text default 'day',
  prev_since timestamptz default null,
  tz text default 'UTC'
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'path', page_path,
    'totalViews', (select count(*) from public.analytics_events where path = page_path and created_at >= since),
    'uniqueVisitors', (select count(distinct visitor) from public.analytics_events where path = page_path and created_at >= since),
    'avgReadDepth', (select coalesce(round(avg(depth))::int, 0) from public.analytics_scroll where path = page_path and created_at >= since),
    'avgDwellMs', (select coalesce(round(avg(dwell_ms))::int, 0)
                     from public.analytics_scroll where path = page_path and created_at >= since and dwell_ms is not null),
    'prevViews', (select count(*) from public.analytics_events
                    where path = page_path and prev_since is not null and created_at >= prev_since and created_at < since),
    'prevVisitors', (select count(distinct visitor) from public.analytics_events
                       where path = page_path and prev_since is not null and created_at >= prev_since and created_at < since),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'visitors', visitors) order by ord)
      from (
        select date_trunc(bucket, created_at at time zone tz) as ord,
               to_char(date_trunc(bucket, created_at at time zone tz),
                       case bucket when 'hour' then 'YYYY-MM-DD HH24:00'
                                   when 'month' then 'YYYY-MM'
                                   else 'YYYY-MM-DD' end) as day,
               count(*)::int as views,
               count(distinct visitor)::int as visitors
        from public.analytics_events
        where path = page_path and created_at >= since
        group by 1, 2
      ) d
    ), '[]'::jsonb),
    'topReferrers', coalesce((
      select jsonb_agg(jsonb_build_object('host', host, 'visitors', visitors))
      from (
        select referrer_host as host, count(distinct visitor)::int as visitors
        from public.analytics_events
        where path = page_path and created_at >= since and referrer_host is not null and referrer_host <> ''
        group by referrer_host order by count(distinct visitor) desc limit 10
      ) r
    ), '[]'::jsonb),
    'topCountries', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'visitors', visitors))
      from (
        select country, count(distinct visitor)::int as visitors
        from public.analytics_events
        where path = page_path and created_at >= since and country is not null and country <> ''
        group by country order by count(distinct visitor) desc limit 10
      ) c
    ), '[]'::jsonb),
    'depthBuckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket, 'samples', samples) order by bucket)
      from (
        select least(3, depth / 25) as bucket, count(*)::int as samples
        from public.analytics_scroll where path = page_path and created_at >= since
        group by 1
      ) b
    ), '[]'::jsonb)
  );
$$;
