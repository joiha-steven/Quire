# Backups

Off-box, on a schedule, and **verified by restoring** — not by the fact that the script
exited 0. Source: [`scripts/ops/quire2-backup.sh`](../scripts/ops/quire2-backup.sh),
installed to `/usr/local/bin/` and driven by cron.

The frozen tree backed up to the owner's Google Drive from inside the application, with an
OAuth flow, a `backup_state` table and a destructive in-app restore. 2.0 dropped all of it
(parity exception 1, [`spec/07-parity.md`](spec/07-parity.md)): backup is an operational
concern, it should keep working when the application does not, and an application that can
overwrite every table in itself is a bigger risk than the one it removes.

What the exception promised in exchange is still in the admin: **Settings → Advanced →
Export** (`GET /api/backup/export`, owner-only) streams a `tar.gz` of both databases and the
uploads tree to the owner's machine. Same `VACUUM INTO` snapshot, no third party in the
path, no shell access needed. That is a copy you take; what follows is the copy that happens
whether or not anyone remembers.

## What it copies

| | How | Why that way |
|---|---|---|
| `quire.db`, `analytics.db` | `VACUUM INTO` a temporary file, then `tar -czf` | **Never a file copy.** A live SQLite database has a write-ahead log, and copying the file can capture a torn state that only reveals itself on restore |
| `uploads/` | `rclone sync` with `--backup-dir` | A deleted or overwritten file stays recoverable for 7 days instead of vanishing on the next run |

`.env` is deliberately NOT in the backup. It holds the session secret and the SMTP
password; a copy of it off the box is a second place to lose them from.

## Schedule and retention

- **Hourly** (`:17`) and **daily** (`20:40`). Both take the same snapshot; only the tag
  differs, and only the daily run applies retention.
- Hourly copies kept 3 days, daily copies 30 days, deleted uploads 7 days.
- One run at a time, held by `flock`. An hourly run overlapping the daily one would have
  both writing the same staging file.
- Failure posts to the alert webhook the other backups on the box already use. A backup
  that fails silently is not a backup.

## Restoring

```sh
tar -xzf quire2-<tag>.tar.gz -C /tmp/restore
sqlite3 /tmp/restore/quire.db 'pragma integrity_check;'   # expect: ok
sqlite3 /tmp/restore/quire.db 'select count(*) from posts;'
systemctl stop quire2 && cp /tmp/restore/*.db /var/lib/quire2/data/ && systemctl start quire2
```

Stop the service first. Copying a database under a running process is the same torn-state
problem the backup itself avoids, in the other direction.

**Do this on a schedule, not only when something is on fire.** The restore was exercised
end to end when the script was installed — `integrity_check: ok`, 74 posts, 4 pages — and
an untested backup is a belief, not a backup.

## Instance configuration

The remote, the alert hook and the data paths are at the top of the script. They describe
one machine, so they are the only part worth reading before installing it somewhere else.
