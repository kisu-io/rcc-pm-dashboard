#!/usr/bin/env bash
# deploy/rcc/test_backup.sh — proves backup.sh produces a dump that
# pg_restore can bring back. Uses a throwaway Postgres container.
set -euo pipefail
cd "$(dirname "$0")/../.."

name=rcc-backup-test
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$name" \
  -e POSTGRES_USER=oe -e POSTGRES_PASSWORD=test-only -e POSTGRES_DB=openestimate \
  postgres:16-alpine >/dev/null
until docker exec "$name" pg_isready -U oe -d openestimate >/dev/null 2>&1; do sleep 1; done

psql_in() { docker exec -i "$name" psql -U oe -d openestimate -v ON_ERROR_STOP=1 "$@"; }

psql_in -c "create table rcc_probe(x int); insert into rcc_probe values (42);"

backup_dir=$(mktemp -d)
BACKUP_DIR="$backup_dir" PG_EXEC="docker exec -i $name" SKIP_APP_DATA=1 deploy/rcc/backup.sh

dump=$(ls "$backup_dir"/oce-*.dump)
[ -s "$dump" ] || { echo "FAIL: dump is empty"; exit 1; }

psql_in -c "drop table rcc_probe;"
docker exec -i "$name" pg_restore -U oe -d openestimate --clean --if-exists < "$dump"

got=$(psql_in -tAc "select x from rcc_probe")
[ "$got" = "42" ] || { echo "FAIL: restored value was '$got', expected 42"; exit 1; }

echo "OK: backup restores"

# A failed nightly backup must be visible in a directory listing and must not
# leave a 0-byte dump that looks like a backup.
fail_dir=$(mktemp -d)
set +e
PG_EXEC=false SKIP_APP_DATA=1 BACKUP_DIR="$fail_dir" deploy/rcc/backup.sh >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -ne 0 ] || { echo "FAIL: backup.sh exited 0 although pg_dump failed"; exit 1; }
[ -f "$fail_dir/BACKUP-FAILED" ] || { echo "FAIL: no BACKUP-FAILED sentinel after a failed backup"; exit 1; }
if ls "$fail_dir"/oce-*.dump >/dev/null 2>&1; then
  echo "FAIL: a partial dump survived a failed backup"; exit 1
fi

echo "OK: backup fails loudly"
