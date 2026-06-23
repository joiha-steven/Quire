-- Runs AFTER the schema (02_schema.sql). Grants service_role the table/function
-- privileges it needs (RLS is bypassed by the role, but privileges are still
-- checked). anon stays empty on purpose — no JWT must see nothing.
grant usage on schema public to anon, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Cover anything added later in the same session/owner (e.g. future migrations run
-- as this owner) without a re-grant.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
