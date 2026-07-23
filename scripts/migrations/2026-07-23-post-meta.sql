-- Migration: per-post SEO overrides + a visible cover image. Run ONCE on the live DB.
-- meta_title / meta_description override the <title> + description/OG when set (else the
-- post title + excerpt are used). cover_image is a visible hero shown at the top of the
-- post (and the OG image fallback). Real dateModified uses the existing updated_at.
-- Idempotent.

alter table public.posts add column if not exists meta_title       text;
alter table public.posts add column if not exists meta_description text;
alter table public.posts add column if not exists cover_image      text;
