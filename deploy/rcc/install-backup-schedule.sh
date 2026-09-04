#!/usr/bin/env bash
# deploy/rcc/install-backup-schedule.sh — installs a launchd user agent that
# runs backup.sh every day at 02:00. launchd (not cron) because it survives
# macOS updates and runs missed jobs after the mini wakes.
#
#   LAUNCH_AGENTS_DIR  where to write the plist (default ~/Library/LaunchAgents)
#   BACKUP_DIR         passed to backup.sh (default ~/rcc-erp-backups)
#   NO_LOAD=1          write the plist but do not load it (tests)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/rcc-erp-backups}"
AGENTS_DIR="${LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
label=vn.rcc.erp-backup
plist="$AGENTS_DIR/$label.plist"

# launchd starts the job with no login shell, so it never reads the profile
# that puts docker on PATH. Resolve it here instead of guessing: current Docker
# Desktop installs the CLI under ~/.docker/bin, older ones under /usr/local/bin.
docker_bin="$(command -v docker || true)"
[ -n "$docker_bin" ] || {
  echo "docker is not on PATH — install Docker Desktop and open a shell where \`docker\` works, then re-run this script" >&2
  exit 1
}
docker_dir="$(dirname "$docker_bin")"

mkdir -p "$BACKUP_DIR" "$AGENTS_DIR"

cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO_DIR/deploy/rcc/backup.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$docker_dir:$HOME/.docker/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>BACKUP_DIR</key><string>$BACKUP_DIR</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$BACKUP_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$BACKUP_DIR/backup.log</string>
</dict>
</plist>
EOF

plutil -lint "$plist" >/dev/null

if [ -z "${NO_LOAD:-}" ]; then
  launchctl unload "$plist" 2>/dev/null || true
  launchctl load "$plist"
  echo "scheduled: $label daily at 02:00 → $BACKUP_DIR (log: $BACKUP_DIR/backup.log)"
fi
