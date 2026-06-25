-- Migration: top referrers + countries should count DISTINCT VISITORS, not page
-- views (one person loading N pages = 1, not N). Run ONCE on the live Supabase DB
-- (SQL editor) after the earlier analytics-deepening migration. Idempotent — it
-- only replaces the function in place (no schema change). Safe to re-run.

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
    -- one person = 1 (distinct visitor), not per page view
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
