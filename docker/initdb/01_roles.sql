-- Self-host Postgres bootstrap (runs once, on first DB init, BEFORE the schema).
-- Recreates the two Supabase roles the app + PostgREST rely on:
--   anon         — the no-JWT role PostgREST falls back to; granted nothing, so an
--                  unauthenticated request can reach no data.
--   service_role — the app's role (carried in the SUPABASE_SERVICE_ROLE_KEY JWT).
--                  BYPASSRLS mirrors Supabase: every table has RLS enabled with no
--                  policies, and the app reaches them only by bypassing it.
-- PostgREST connects as the superuser and SET ROLEs to whichever the JWT names.

create role anon nologin;
create role service_role nologin bypassrls;
