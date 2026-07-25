# `cmd/import-v1` — one-way importer from Quire 1.x

Moves a live Quire 1.x instance into Quire 2.0. One direction only. There is no
sync, no dual-write, and no path back.

```
import-v1 \
  --postgres "postgres://user:pass@host/db" \
  --uploads  /var/lib/quire/uploads \
  --out      ./data/quire.db \
  --analytics-out ./data/analytics.db \
  [--dry-run] [--skip-analytics] [--verify-only]
```

## Why direct Postgres and not a backup archive

Quire 1.x can already produce a backup archive, and reading that would decouple the
importer from a running database. It was rejected because:

- v1 is still running throughout the project, so a live connection is always available.
- The archive format is itself something that would need porting and verifying, adding
  a second thing that can be wrong.
- Reading the source tables directly makes the row-count verification meaningful: both
  sides are queried the same way.

The backup archive still gets ported (M3) for instance-to-instance migration. It is
just not the import path.

## Order of operations

Foreign keys and derived tables force an order.

```
1.  settings                    (single row, JSON passthrough)
2.  integration_keys            (single row, secrets)
3.  backup_state                (single row; refresh_token dropped, see below)
4.  pages
5.  posts                       -> then post_terms, then posts_fts rebuild
6.  post_revisions
7.  media, files
8.  comments                    (ordered by id so parent_id references resolve)
9.  subscribers, newsletter_sends
10. redirects
11. mcp_tokens, mcp_clients, mcp_used_codes
12. activity_log
13. analytics_events, analytics_scroll   -> analytics.db, batched
14. binaries                    uploads tree copy
```

The whole content import runs in **one transaction** on `quire.db`. Either the
instance is fully imported or the file is untouched.

Analytics imports separately, in batches of 10,000, because it can be large and its
loss is tolerable. `--skip-analytics` exists for fast iteration during development.

## Transforms

| Source | Target | Transform |
|---|---|---|
| any `timestamptz` | `INTEGER` | epoch milliseconds, UTC. NULL preserved |
| any `boolean` | `INTEGER` | 0 / 1 |
| `posts.categories text[]` | `post_terms` rows | one row per term, `kind='category'` |
| `posts.tags text[]` | `post_terms` rows | one row per term, `kind='tag'` |
| `posts.search tsvector` | not imported | `posts_fts` is rebuilt from title + content |
| `settings.data jsonb` | `TEXT` | verbatim JSON, no reshaping |
| `post_revisions.data jsonb` | `TEXT` | verbatim |
| `mcp_clients.redirect_uris text[]` | `TEXT` | JSON array |
| identity `bigint` ids | `INTEGER` | preserved exactly, including gaps |
| `comments.depth smallint` | `INTEGER` | unchanged |
| `backup_state.refresh_token` | dropped | Google Drive backup is removed (parity exception #1). The row is imported with the token nulled so `last_run_at` history survives |

Ids are preserved rather than reassigned. `comments.parent_id` depends on it, and
`newsletter_sends.open_token` links live in already-sent emails.

After the inserts, `sqlite_sequence` is advanced past the maximum id of every
`AUTOINCREMENT` table, and a test asserts that the next insert does not collide.

## Binaries

`--uploads` points at the v1 `STORAGE_LOCAL_DIR`. The tree is copied, not moved, and
never modified in place.

Verification for binaries is stricter than for rows, because a missing image is
invisible until a reader hits the page:

1. Every path in `media` and `files` must exist on disk with a matching byte size.
2. Every image reference inside post and page **content** is extracted and resolved.
   References are stored store-relative (Invariant 3), so this is a string scan for the
   collapsed form plus a lookup.
3. Every derived variant (`-1024`, `-1600`, AVIF, WebP, thumbnails) recorded in `media`
   must exist.
4. Files on disk with no database row are reported, not deleted. That is the existing
   `findUnusedMedia` audit and it stays advisory.

Any failure in 1 to 3 aborts the import. Item 4 is a warning.

## Verification

Runs automatically at the end of every import, and standalone with `--verify-only`.

### Tier 1 — counts

Row count per table on both sides, including the soft-deleted rows. Any mismatch is
fatal.

For `post_terms`, the expected count is computed as the sum of array lengths on the
Postgres side.

### Tier 2 — checksums

For each content-bearing table, a stable checksum over the rows: sort by primary key,
concatenate a canonical rendering of every column, hash. Computed identically on both
sides in Go, so type formatting cannot cause a false difference.

Covers `posts` (slug, title, content, status, dates, series, SEO fields), `pages`,
`comments`, `post_revisions`, `media`, `files`, `redirects`, `subscribers`.

### Tier 3 — spot comparison

50 randomly selected rows per table, compared field by field with a printed diff on
mismatch. This catches transform bugs that a checksum would only report as "different"
without saying where.

Random selection uses a seed printed in the output, so a failure is reproducible.

### Tier 4 — semantic

- Every `post_terms.term` appears in the source array for that post, and vice versa.
- FTS5 returns the expected post for a sample of 20 known title words.
- The `/{slug}` namespace has no collision between `posts` and `pages` (Invariant 2).
- Every `comments.parent_id` either is NULL or points at an existing row, or is a known
  orphan whose parent was purged in v1 (these exist by design and must survive as
  orphans, not be repaired).
- Soft-deleted rows are still soft-deleted, not silently dropped (Invariant 6).

## Idempotency

The importer writes to a **new** database file. It refuses to run against an existing
non-empty `--out` unless `--force` is given, in which case it truncates first.

This is deliberately not an upsert. An incremental importer would need conflict rules
for every table and would be used exactly twice. Re-running from scratch takes minutes
and is trivially correct.

## Cutover procedure

At M4, the real import happens with v1 in read-only mode to avoid a write landing
between the export and the DNS switch.

```
1. Announce a maintenance window (minutes, not hours)
2. Put v1 admin behind a 503; public stays up and readable
3. Run import-v1 against production Postgres and the production uploads tree
4. Run verification; abort on any Tier 1 or Tier 2 failure
5. Run the golden compare against the freshly imported data
6. Start Quire 2.0 on the same host, different port
7. Smoke test: 20 URLs, one MCP write, one comment, one subscribe
8. Switch the reverse proxy to the new port
9. Keep v1 running, stopped but intact, for 7 days
```

Step 9 is the rollback plan. Rolling back means pointing the proxy at the old port
again and accepting the loss of anything written to SQLite in the interim, which is why
the observation window is short and watched.

## What is deliberately not imported

- `posts.search` (rebuilt)
- Row-level security policies (no equivalent, none needed)
- `schema_migrations` (Quire 2.0 has its own ledger, starting empty)
- The 28 `alter table ... add column if not exists` back-compat statements
- Google Drive refresh token
- Next.js session cookies. Everyone signs in again once
