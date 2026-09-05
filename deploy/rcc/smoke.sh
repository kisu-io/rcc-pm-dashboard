#!/usr/bin/env bash
# deploy/rcc/smoke.sh <base-url> — post-deploy checks.
#   deploy/rcc/smoke.sh http://localhost:8080      (on the mini, before the tunnel)
#   deploy/rcc/smoke.sh https://erp.example.com    (from anywhere, through the tunnel)
#   1. /api/health answers 200 with a version
#   2. demo login is refused (this is a non-demo install)
#   3. the SPA shell is served
set -euo pipefail
base="${1:?usage: smoke.sh <base-url>}"
base="${base%/}"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

code=$(curl -sS -o "$tmp" -w '%{http_code}' "$base/api/health")
[ "$code" = "200" ] || { echo "FAIL: /api/health returned $code"; exit 1; }
grep -q '"version"' "$tmp" || { echo "FAIL: /api/health has no version field"; exit 1; }
echo "health: $(head -c 200 "$tmp")"

# Path confirmed in Task 4 Step 4; update here if the OpenAPI lookup differed.
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$base/api/v1/users/auth/demo-login/" \
  -H 'content-type: application/json' -d '{"email":"demo@openestimate.local"}')
case "$code" in
  403|404) echo "demo login: refused ($code)";;
  *) echo "FAIL: demo login answered $code — SEED_DEMO is not off"; exit 1;;
esac

curl -sS "$base/" | grep -q '<div id="root"' || { echo "FAIL: SPA shell not served"; exit 1; }
echo "OK: $base"
