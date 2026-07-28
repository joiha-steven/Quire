-- Changes to an EXISTING content database. Applied at boot, after `schema.sql`, in order,
-- each inside its own transaction, each recorded in `schema_migrations`.
--
-- `schema.sql` states the FINAL shape and is what a fresh database is built from, so a
-- fresh database records every migration here as applied WITHOUT running it (see
-- `applyMigrations` in db.ts). That is the whole reason this file can hold plain
-- `alter table ... add column` statements: SQLite has no `if not exists` for a column, and
-- running one twice is an error rather than a no-op.
--
-- So a schema change is TWO edits, always: the new shape in `schema.sql`, and the step that
-- gets an existing database there from here. Doing only the first leaves the live instance
-- behind; doing only the second leaves a fresh install without the column.
--
-- Format: `-- migration: <name>` opens a step, everything until the next header is its SQL.
-- Names are ordered and never reused — the ledger keys on them.

-- migration: 001-google-comment-keys
-- Google sign-in for COMMENTERS (ADR 0013). The client id is public, the secret is not;
-- both sit with the other owner-pasted keys rather than in the environment, so they can be
-- entered in the admin like every other integration.
alter table integration_keys add column google_client_id text;
alter table integration_keys add column google_client_secret text;
