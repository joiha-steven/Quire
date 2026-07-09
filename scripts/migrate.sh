#!/usr/bin/env sh
# Apply pending SQL migrations from scripts/migrations/ in filename order, each tracked
# in the public.schema_migrations ledger so it runs AT MOST once. Idempotent: safe to
# re-run any time; a fresh install already has every past migration seeded (schema.sql),
# so this is a no-op there.
#
#   Native:  DATABASE_URL=postgres://user:pass@host:5432/db  sh scripts/migrate.sh
#   or set the standard PG* env (PGHOST/PGUSER/PGDATABASE/PGPASSWORD) and run it bare.
#   Docker:  the one-shot `migrate` compose service runs this against the bundled db.
#
# Requires the `psql` client. Run BEFORE starting the app after pulling a new release.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIG_DIR="$SCRIPT_DIR/migrations"

# Use DATABASE_URL when given, else fall back to psql's PG* environment variables.
CONN="${DATABASE_URL:-}"
psql_run() { psql ${CONN:+"$CONN"} -v ON_ERROR_STOP=1 -q "$@"; }

# Ensure the ledger exists (older installs predate it).
psql_run -c "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());"

applied=0
for f in "$MIG_DIR"/*.sql; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  seen="$(psql_run -tAc "select 1 from public.schema_migrations where name = '$name'")"
  [ "$seen" = "1" ] && continue
  echo "[migrate] applying $name"
  # The migration + its ledger insert run in ONE transaction, so a failure rolls back
  # cleanly and the file is retried next run.
  psql_run --single-transaction -f "$f" -c "insert into public.schema_migrations (name) values ('$name');"
  applied=$((applied + 1))
done

if [ "$applied" -eq 0 ]; then
  echo "[migrate] up to date — no pending migrations"
else
  echo "[migrate] applied $applied migration(s)"
fi
