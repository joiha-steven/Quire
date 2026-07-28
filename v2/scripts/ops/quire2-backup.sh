#!/usr/bin/env bash
# Off-box backup for Quire 2.0: both SQLite databases and the uploads tree, to R2.
#
# This is parity exception 1 made real. Google Drive backup was dropped on the argument that
# replication would replace it, and until this ran the only copy of everything the owner had
# written lived in one directory on one machine.
#
# It is a SEPARATE script from `jk-backup.sh` on purpose. That one backs up the money site
# and four others, it is proven, and it is monitored; adding a sixth engine to it to serve a
# blog would put those backups at risk for no gain. This reuses its remote, its retention
# habit and its alert hook, and nothing else of it.
#
#   Databases : VACUUM INTO, never a file copy. A live SQLite database has a write-ahead log
#               and copying the file can capture a torn state that only fails on restore.
#   Uploads   : rclone sync with --backup-dir, so a deleted file is recoverable for 7 days.
#   Retention : hourly copies for 3 days, daily copies for 30.
#
# Install:
#   install -m 755 quire2-backup.sh /usr/local/bin/
#   crontab -e ->  17 * * * * /usr/local/bin/quire2-backup.sh
#                  40 20 * * * /usr/local/bin/quire2-backup.sh daily

set -uo pipefail

DATA=/var/lib/quire2/data
UPLOADS=/var/lib/quire2/uploads
BUN=/home/quire2/.bun/bin/bun
REMOTE="r2:joiha-server-backup/sv1-usa-joiha/quire2"
STAGE=/root/backups/stage
LOG=/root/backups/quire2-backup.log
LOCK=/var/lock/quire2-backup.lock
ALERT_HOOK_FILE=/root/.alert-webhook

MODE="${1:-hourly}"
TAG="$(date +%Y%m%d-%H%M)"
[ "$MODE" = daily ] && TAG="$(date +%Y%m%d)-daily"

mkdir -p "$STAGE" "$(dirname "$LOG")"
log(){ echo "[$(date +'%F %T')] $*" >>"$LOG"; }

fail(){
  log "FAIL: $*"
  local url; url="$(cat "$ALERT_HOOK_FILE" 2>/dev/null)" || true
  if [ -n "${url:-}" ] && command -v jq >/dev/null 2>&1; then
    jq -n --arg t ":red_circle: *quire2* backup FAIL" --arg d "$1" \
      '{alias:"backup sv1-usa",emoji:":floppy_disk:",text:$t,attachments:[{color:"#e01b1b",text:$d}]}' \
      | curl -sS -m 15 -X POST -H 'Content-Type: application/json' --data @- "$url" >/dev/null 2>&1 || true
  fi
  exit 1
}

# One at a time. An hourly run overlapping the daily one would have them both writing the
# same staging file.
exec 9>"$LOCK" || fail "lock"
flock -n 9 || { log "another run holds the lock; skipping"; exit 0; }

ARCHIVE="$STAGE/quire2-${TAG}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$ARCHIVE"' EXIT

for db in "$DATA"/*.db; do
  [ -e "$db" ] || continue
  # Paths go in through the ENVIRONMENT, not argv: `bun -e` starts its arguments at argv[1],
  # so reading them from argv[2] handed the database an undefined path.
  SRC="$db" DEST="$TMP/$(basename "$db")" "$BUN" -e \
    'import{Database}from"bun:sqlite";const d=new Database(process.env.SRC,{readonly:true});d.exec(`vacuum into ${JSON.stringify(process.env.DEST)}`);d.close()' \
    2>>"$LOG" || fail "vacuum $(basename "$db")"
done
[ -n "$(ls -A "$TMP")" ] || fail "no databases found in $DATA"

tar -C "$TMP" -czf "$ARCHIVE" . 2>>"$LOG" || fail "tar"
rclone copyto "$ARCHIVE" "$REMOTE/db/quire2-${TAG}.tar.gz" 2>>"$LOG" || fail "rclone db"
log "db ($TAG) -> $(du -h "$ARCHIVE" | cut -f1)"

if [ -d "$UPLOADS" ]; then
  rclone sync "$UPLOADS" "$REMOTE/uploads/current" \
    --backup-dir "$REMOTE/uploads/_archive/$(date +%Y%m%d)" \
    --transfers 32 --checkers 64 --fast-list --retries 4 2>>"$LOG" || fail "rclone uploads"
  log "uploads synced"
fi

# Retention, on the daily run only: hourly copies for 3 days, dailies for 30, and a deleted
# upload recoverable for 7.
if [ "$MODE" = daily ]; then
  rclone delete "$REMOTE/db/" --min-age 3d  --exclude "*-daily.tar.gz" 2>>"$LOG" || true
  rclone delete "$REMOTE/db/" --min-age 30d --include "*-daily.tar.gz" 2>>"$LOG" || true
  rclone delete "$REMOTE/uploads/_archive/" --min-age 7d 2>>"$LOG" || true
  rclone rmdirs "$REMOTE/uploads/_archive/" --leave-root 2>>"$LOG" || true
fi

log "ok ($MODE)"
