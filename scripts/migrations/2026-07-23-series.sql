-- Migration: post series / collections. Run ONCE on the live DB. A post may belong to
-- one named series with an explicit order; the public "series box" + /series/[slug]
-- page read these. Null series = not part of any series. Idempotent.

alter table public.posts add column if not exists series       text;
alter table public.posts add column if not exists series_order integer not null default 0;

create index if not exists posts_series_idx on public.posts (series);
