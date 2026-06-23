> Split from CLAUDE.md — read when touching backups: Google Drive auth, restore, the backup cron, `backup_state`, `lib/backup.ts`, `lib/gdrive.ts`.

# Backups — Google Drive (Admin → Settings → Advanced)

- **What it is.** A full-site snapshot to the owner's Google Drive: one self-contained
  `.tar.gz` = `db.json` (every text table except `backup_state`) + `blob/<pathname>` (every
  binary, read through the storage driver via `readBlob` — Vercel fetches the public URL, the
  local driver reads disk, so a snapshot works on either backend) + `manifest.json`. Built in
  `/tmp` then resumable-uploaded into a `vibeblog-backups`
  Drive folder. Runs on a schedule (cron, every `settings.backups.intervalDays`, default 4) or
  the "Back up now" button; retention keeps the newest `settings.backups.keep` (default 4).
- **Auth is SEPARATE from sign-in.** A dedicated `drive.file` OAuth flow (reuses the Google
  client `AUTH_GOOGLE_*`, never touches the login scope): `GET /api/backup/connect` → Google
  consent → `GET /api/backup/callback` exchanges the code for a **refresh token**, stored in
  `backup_state` (server-only). `drive.file` = the app only ever sees files IT created. The
  **redirect URI is `backupRedirectUri(settings)` = `${resolveSiteUrl(settings)}/api/backup/callback`**
  — derived from the canonical site URL, NOT `req.nextUrl.origin` (which is a `*.vercel.app` host
  when the admin is opened there → `redirect_uri_mismatch`). So the URI registered on the OAuth
  client must use the canonical host (`settings.siteUrl`).
- **Secret hygiene (HARD RULE).** The Drive refresh token must NEVER reach the client. It lives
  in `backup_state`, NOT in `settings.data` (which is sent to the admin). Only non-secret config
  (`enabled`/`intervalDays`/`keep`) lives in `settings.backups` and flows through the settings
  form; the connection + snapshot list come from owner-only `/api/backup` (returns `toStatus`,
  never the token) — same split as MCP tokens.
- **`backup_state` writes MUST `revalidateTag(DB_TAG, 'max')`** (`backup-state.ts`:
  `setDriveAuth`/`clearDriveAuth`/`setFolderId`/`recordRun`). The state read is Data-Cache-eligible
  (tag `db`, 1h) and is read by BOTH `/api/backup` and the admin Overview — `force-dynamic` on one
  route is NOT enough to dodge the *shared* Data Cache, so without busting it the admin showed stale
  "not connected" after a successful connect (the bug that shipped in 1.0.11–1.0.13).
- **Restore is DESTRUCTIVE** (`POST /api/backup/restore`): replaces every text table (settings
  upserted by id=1; others delete-all then insert with `id`/`search` stripped) and re-uploads
  every blob. A **pre-restore snapshot is taken first**. UI confirms before calling.
- **Routes:** `/api/backup` (GET status+list, POST run-now, DELETE `?id=`), `/api/backup/restore`,
  `/api/backup/{connect,callback,disconnect}`. All owner-only (middleware + `requireOwner`); the
  cron calls `maybeRunBackup()` directly (no HTTP). New mutating action? `logActivity('backup.*')`.
- **Owner setup (one-time):** enable the **Google Drive API** in the Cloud project behind
  `AUTH_GOOGLE_ID`, add `https://<domain>/api/backup/callback` (+ localhost) as an Authorized
  redirect URI on the OAuth client, then click **Connect Google Drive**. No new env var.
