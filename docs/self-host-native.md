# Native self-host (no Docker)

Run Quire directly on a Linux server: **PostgreSQL** + **PostgREST** + the **Next.js app**
as plain services behind any reverse proxy (nginx, CloudPanel, Caddy, …). This is the same
component set the [Docker flavor](../README.md#-get-your-own-copy) bundles, just installed on
the host. Templates for the systemd units + PostgREST config are in [`deploy/native/`](../deploy/native/).

Commands below assume Ubuntu/Debian + `root` (or `sudo`). Adjust paths to your box.

## Overview

```
Internet → CDN/reverse proxy (TLS) → nginx → 127.0.0.1:3000  Next.js app (systemd/supervisor)
                                                  │ supabase-js
                                                  ▼
                                    127.0.0.1:3001  PostgREST (systemd)
                                                  ▼
                                    127.0.0.1:5432  PostgreSQL   (DB `quire`)
Binaries: STORAGE_LOCAL_DIR (media/ + files/), served at /uploads
```

`supabase-js` is only a PostgREST HTTP client, so no Supabase cloud account is involved —
`SUPABASE_URL` just points at your local PostgREST.

## 1. PostgreSQL

```bash
apt install -y postgresql-16
sudo -u postgres createdb quire

# Bootstrap: roles → schema → grants (order matters). Run the files from this repo:
sudo -u postgres psql -d quire -f docker/initdb/01_roles.sql   # anon + service_role
sudo -u postgres psql -d quire -f scripts/schema.sql           # tables / indexes / RLS / RPC
sudo -u postgres psql -d quire -f docker/initdb/03_grants.sql  # grants for service_role
```

Generate the secrets (DB password + PostgREST JWT secret + the app's `service_role` JWT):

```bash
node scripts/docker/gen-keys.mjs   # prints PGPASSWORD, PGRST_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY
```

Create a dedicated login role for PostgREST that can assume `anon` / `service_role`:

```sql
create role authenticator noinherit login password 'PGPASSWORD_FROM_GEN_KEYS';
grant anon, service_role to authenticator;
```

Postgres listens on localhost only by default (good). Ensure `pg_hba.conf` uses `scram-sha-256`
for `127.0.0.1/32` (the default on 16) so PostgREST can connect over TCP with a password.

## 2. PostgREST (systemd)

Download the matching PostgREST release binary to `/usr/local/bin/postgrest`, then:

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin postgrest
mkdir -p /etc/postgrest
cp deploy/native/postgrest.conf /etc/postgrest/quire.conf
# fill REPLACE_WITH_PGPASSWORD + REPLACE_WITH_PGRST_JWT_SECRET, then:
chown postgrest:postgrest /etc/postgrest/quire.conf && chmod 600 /etc/postgrest/quire.conf
cp deploy/native/postgrest.service /etc/systemd/system/postgrest.service
systemctl daemon-reload && systemctl enable --now postgrest
```

Verify: `curl -s http://127.0.0.1:3001/posts` → `401` (anon has no grants, correct); with the
`service_role` JWT it returns `[]` (or your rows).

## 3. The app (build + systemd)

Deploy the source to an app dir owned by a dedicated site user (e.g. `/home/quire/app`),
install Node 20+ for that user, then:

```bash
npm ci
# create .env.local from .env.example — key values for native:
#   SUPABASE_URL=http://127.0.0.1:3001
#   POSTGREST_DIRECT=1
#   SUPABASE_SERVICE_ROLE_KEY=<JWT from gen-keys.mjs>
#   STORAGE_LOCAL_DIR=<app dir>/data/uploads   (mkdir it, owned by the site user)
#   SITE_URL / AUTH_URL / AUTH_SECRET / AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTHORIZED_EMAIL / CRON_SECRET
npm run build
```

Run `next start` under a process manager. Use the systemd template (or supervisor, which
CloudPanel documents for Node sites):

```bash
cp deploy/native/quire.service /etc/systemd/system/quire.service
# fill REPLACE_SITE_USER, REPLACE_APP_DIR, REPLACE_NODE_BIN_DIR (dir of `node`, e.g. an nvm path)
systemctl daemon-reload && systemctl enable --now quire
```

The app binds `127.0.0.1:3000`. Verify: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/` → `200`.

> **GOTCHA:** after loading data out-of-band (see Migration below), run `rm -rf .next/cache`
> before `npm run build`, or Next's persistent Data Cache reuses an empty result and the home
> page renders with no posts. Individual `/[slug]` pages are unaffected.

## 4. Reverse proxy + TLS

Point any reverse proxy at `127.0.0.1:3000` for your domain and terminate TLS there (or at a
CDN like Cloudflare — an Origin Certificate + "Full (strict)" works well). With CloudPanel:
create a **Node.js** site (it wires the nginx vhost → app port and manages SSL in the UI).

## 5. Cron

Add an hourly job (host crontab, or the panel's Cron UI) so variant generation, the backup
sweep, and keep-alive run:

```
0 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron >/dev/null 2>&1
```

## 6. Google OAuth

On your [Google OAuth "Web" client](https://console.cloud.google.com/apis/credentials) register:

- `https://<your-domain>/api/auth/callback/google` (admin sign-in)
- `https://<your-domain>/api/backup/callback` (Google Drive backups)

## Upgrading to a new release

After pulling a new version, **apply any pending DB migrations before restarting the app**:

```bash
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/quire" npm run migrate
npm ci && npm run build   # then restart the systemd service
```

`npm run migrate` (→ `scripts/migrate.sh`, needs `psql`) applies only the files in
`scripts/migrations/` not yet recorded in the `schema_migrations` ledger — it's idempotent
and a no-op when you're already up to date. A fresh install seeds the ledger from
`scripts/schema.sql`, so migrations only ever matter on upgrade. (Docker runs this
automatically as the one-shot `migrate` service before the app starts.)

**Health check:** `GET /api/health` returns `200` when Postgres is reachable and the store is
writable, `503` otherwise — point your reverse proxy / monitor at it. On boot the app also
validates its environment and refuses to start (with a readable list) if a required var is
missing.

## Migrating from an existing instance

Text (PostgreSQL) — dump data-only from the old DB and load into the new one (schema already
applied in step 1). Use a `pg_dump` whose major version is ≥ the source server:

```bash
pg_dump "postgresql://USER:PASS@OLD_HOST:5432/DB" \
  --data-only --schema=public --no-owner --no-privileges -f quire-data.sql
sudo -u postgres psql -d quire -f quire-data.sql   # generated columns (search) are skipped + recomputed
```

Binaries — copy the old store into `STORAGE_LOCAL_DIR` (rsync/cp), preserving the `media/…` and
`files/…` pathnames (image refs are stored **store-relative**, so nothing in the content needs
rewriting).

After loading data: `rm -rf .next/cache && npm run build && systemctl restart quire`.

## Backups & operating

- **Back up two things:** the Postgres database (`pg_dump quire`) and `STORAGE_LOCAL_DIR`. The
  in-app **Google Drive backup** (Admin → Settings → Advanced) snapshots both into one `.tar.gz`.
- Logs: `journalctl -u quire -f` and `journalctl -u postgrest -f`.
- Restart after a redeploy: `npm run build && systemctl restart quire` (services are `enabled`,
  so they survive reboots).
