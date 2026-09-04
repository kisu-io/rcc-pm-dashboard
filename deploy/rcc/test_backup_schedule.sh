#!/usr/bin/env bash
# deploy/rcc/test_backup_schedule.sh — the installer writes a valid launchd
# plist pointing at this repo's backup.sh, at 02:00, without loading it.
set -euo pipefail
cd "$(dirname "$0")/../.."

agents=$(mktemp -d)
LAUNCH_AGENTS_DIR="$agents" NO_LOAD=1 BACKUP_DIR="$agents/backups" deploy/rcc/install-backup-schedule.sh

plist="$agents/vn.rcc.erp-backup.plist"
[ -f "$plist" ] || { echo "FAIL: plist not written"; exit 1; }
plutil -lint "$plist" >/dev/null || { echo "FAIL: plist is not valid"; exit 1; }
grep -q "$PWD/deploy/rcc/backup.sh" "$plist" || { echo "FAIL: plist does not point at this repo's backup.sh"; exit 1; }
grep -q '<key>Hour</key><integer>2</integer>' "$plist" || { echo "FAIL: not scheduled at 02:00"; exit 1; }
[ -d "$agents/backups" ] || { echo "FAIL: BACKUP_DIR was not created"; exit 1; }

echo "OK: backup schedule"
