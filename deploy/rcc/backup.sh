#!/usr/bin/env bash
# deploy/rcc/backup.sh — nightly logical backup of the RCC ERP.
#
# Scheduled by deploy/rcc/install-backup-schedule.sh (launchd, 02:00 daily).
#
# Writes to BACKUP_DIR:
#   oce-<stamp>.dump       pg_dump custom format (restore: pg_restore --clean --if-exists)
#   app-data-<stamp>.tgz   the /data volume (uploads, vector store)
# and deletes files older than KEEP_DAYS. Copying BACKUP_DIR off the mini
# (iCloud Drive, an external disk) is the operator's step; this script only
# makes sure there is something to copy.
set -euo pipefail

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

dump="$BACKUP_DIR/oce-$stamp.dump"
pg_exec pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$dump"
[ -s "$dump" ] || { echo "backup failed: $dump is empty" >&2; rm -f "$dump"; exit 1; }
echo "database: $dump ($(du -h "$dump" | cut -f1))"

if [ -z "${SKIP_APP_DATA:-}" ]; then
  project=$(basename "$REPO_DIR" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | sed 's/-*$//')
  volume="${APP_DATA_VOLUME:-${project}_app_data}"
  tarball="$BACKUP_DIR/app-data-$stamp.tgz"
  docker run --rm -v "$volume:/data:ro" -v "$BACKUP_DIR:/out" alpine:3 \
    tar czf "/out/$(basename "$tarball")" -C /data .
  echo "app data: $tarball ($(du -h "$tarball" | cut -f1))"
fi

find "$BACKUP_DIR" \( -name 'oce-*.dump' -o -name 'app-data-*.tgz' \) -mtime +"$KEEP_DAYS" -delete
