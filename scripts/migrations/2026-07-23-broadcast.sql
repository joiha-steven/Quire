-- Migration: broadcast-on-publish tracking. Run ONCE on the live DB. A post is emailed
-- to confirmed subscribers exactly once, when it first goes live; `broadcast_at` records
-- that. Idempotent.

alter table public.posts add column if not exists broadcast_at timestamptz;

-- Backfill: mark every ALREADY-LIVE post as broadcast, so enabling the newsletter never
-- mass-emails the back catalogue. Drafts + future-dated (scheduled) posts stay NULL, so
-- they broadcast when they actually go live. Runs once (only touches NULL rows).
update public.posts
   set broadcast_at = now()
 where broadcast_at is null and status = 'published' and date <= now();
