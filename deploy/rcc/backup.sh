#!/usr/bin/env bash
# deploy/rcc/backup.sh — nightly logical backup of the RCC ERP.
#
# Scheduled by deploy/rcc/install-backup-schedule.sh (launchd, 02:00 daily).
#
# Writes to BACKUP_DIR:
#   oce-<stamp>.dump       pg_dump custom format (restore: pg_restore --clean --if-exists)
#   app-data-<stamp>.tgz   the /data volume (uploads, vector store)
#   BACKUP-FAILED          written on any failure, removed on success
# and deletes files older than KEEP_DAYS. Copying BACKUP_DIR off the mini
# (an external disk, iCloud Drive) is the operator's step; this script only
# makes sure there is something to copy.
set -Eeuo pipefail

# A tar of an empty directory is ~100 bytes. Anything under this is not a backup.
MIN_TARBALL_BYTES=1024

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/rcc-erp-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_USER="${POSTGRES_USER:-oe}"
PG_DB="${POSTGRES_DB:-openestimate}"

COMPOSE=(docker compose -f "$REPO_DIR/docker-compose.prod.yml" -f "$REPO_DIR/deploy/rcc/docker-compose.rcc.yml")

# Runs a program inside Postgres. PG_EXEC is a test hook so the script can be
# exercised against a plain container without the compose stack.
pg_exec() {
  if [ -n "${PG_EXEC:-}" ]; then
    # shellcheck disable=SC2086
    $PG_EXEC "$@"
  else
    "${COMPOSE[@]}" exec -T postgres "$@"
  fi
}

mkdir -p "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M%S)

# This runs unattended at 02:00 into a log nobody reads, so a failure has to be
# visible in a plain `ls` of BACKUP_DIR — otherwise it stays invisible until
# retention deletes the last good dump.
#
# The dump is deleted only while it is still unvalidated: `set -e` would
# otherwise leave the 0-byte file pg_dump was writing, and a 0-byte file in a
# listing looks exactly like a backup. Once it has passed the -s check it is a
# real, restorable dump, so a later failure marks the run but keeps it.
mark_failed() {
  printf '%s backup failed — see backup.log\n' "$stamp" > "$BACKUP_DIR/BACKUP-FAILED"
  if [ -n "${dump:-}" ] && [ -z "${dump_ok:-}" ]; then rm -f "$dump"; fi
}
trap mark_failed ERR

die() { echo "$*" >&2; mark_failed; exit 1; }

dump="$BACKUP_DIR/oce-$stamp.dump"
pg_exec pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$dump"
[ -s "$dump" ] || die "backup failed: $dump is empty"
dump_ok=1
echo "database: $dump ($(du -h "$dump" | cut -f1))"

if [ -z "${SKIP_APP_DATA:-}" ]; then
  project=$(basename "$REPO_DIR" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | sed 's/-*$//')
  volume="${APP_DATA_VOLUME:-${project}_app_data}"
  tarball="$BACKUP_DIR/app-data-$stamp.tgz"
  # `docker run -v` CREATES a missing named volume, so without this check a
  # wrong project derivation would tar an empty directory and report success.
  docker volume inspect "$volume" >/dev/null 2>&1 \
    || die "app-data volume '$volume' not found — set APP_DATA_VOLUME"
  docker run --rm -v "$volume:/data:ro" -v "$BACKUP_DIR:/out" alpine:3 \
    tar czf "/out/$(basename "$tarball")" -C /data .
  size=$(stat -f%z "$tarball" 2>/dev/null || stat -c%s "$tarball")
  [ "$size" -ge "$MIN_TARBALL_BYTES" ] \
    || die "app-data backup is only ${size} bytes — volume '$volume' looks empty"
  echo "app data: $tarball ($(du -h "$tarball" | cut -f1))"
fi

find "$BACKUP_DIR" \( -name 'oce-*.dump' -o -name 'app-data-*.tgz' \) -mtime +"$KEEP_DAYS" -delete

rm -f "$BACKUP_DIR/BACKUP-FAILED"
