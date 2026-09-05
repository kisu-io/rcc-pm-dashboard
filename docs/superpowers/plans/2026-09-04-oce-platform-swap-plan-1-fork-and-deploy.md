# OCE platform swap — Plan 1: fork and deploy on the Mac mini

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenConstructionERP v16.7.0 running on the Apple Silicon Mac mini from this repo's `platform/oce` branch, reachable over HTTPS through a Cloudflare Tunnel, with no demo data, restorable nightly backups, and the old Next.js core archived on `main`.

**Architecture:** `platform/oce` is checked out from the upstream tag `v16.7.0` (upstream history retained for future merges). Everything RCC-specific is additive and namespaced: `deploy/rcc/` overlays OCE's own `docker-compose.prod.yml` (disables demo seeding, binds the frontend to loopback, adds a `cloudflared` service behind the compose profile `public`), `RCC.md` is the fork runbook, `deploy/rcc/README.md` the Mac mini runbook. Images are built on the mini itself; there is no registry.

**Tech Stack:** Docker Desktop for Mac (Compose ≥ 2.24.4 for `!override`), Cloudflare Tunnel (`cloudflare/cloudflared`), PostgreSQL 16 (pgduckdb image, upstream's choice), launchd for the backup schedule, bash test scripts.

**Spec:** `docs/superpowers/specs/2026-09-04-oce-platform-swap-design.md`

## Global Constraints

- Upstream pin: tag **`v16.7.0`** of `https://github.com/datadrivenconstruction/OpenConstructionERP`.
- Never edit upstream files except: deleting workflows in `.github/workflows/` (Task 5). All new files go under `deploy/rcc/`, `RCC.md`, `docs/superpowers/`.
- Production env: `SEED_DEMO=false`, `OE_REGISTRATION_MODE=admin-approve`, `OE_DEFAULT_REGISTRATION_ROLE=viewer`, `APP_ENV=production`.
- Compose command everywhere, run from the repo root (compose reads repo-root `.env`):
  `docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml` — add `--profile public` to include the tunnel.
- The repo is cloned to `~/rcc-erp` on the mini, so the compose project name is `rcc-erp` and volumes are `rcc-erp_pg_data`, `rcc-erp_app_data`.
- Local check URL: `http://localhost:8080` (frontend bound to `127.0.0.1:8080`). Public URL: `https://${RCC_DOMAIN}`.
- Secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN`) are generated/entered by the user on the mini, never typed by the assistant and never committed.
- Commit messages: `<type>: <description>` (feat/fix/chore/docs/test/ci), one task = one or more small commits.

---

### Task 1: Archive the old core on `main`

The current branch `feat/module-progress-home` is 3 commits ahead of `main` (`5633861`, `61acaa7`, `d1cd3f8`) with no PR. Merge it first so the archived Next.js app is its final version.

**Files:**
- Commit: `docs/superpowers/specs/2026-09-04-oce-platform-swap-design.md`, `docs/superpowers/plans/2026-09-04-oce-platform-swap-plan-1-fork-and-deploy.md`

**Interfaces:**
- Produces: tag `legacy-nextjs-final` on `origin/main` — Plan 4 references it for rollback.

- [ ] **Step 1: Commit the spec and this plan on the old branch**

They ride along in the archive PR (so `main` records why the core was replaced) and Task 2 Step 3 copies them onto `platform/oce` from here.

```bash
git add docs/superpowers
git commit -m "docs: design spec and Plan 1 for the OpenConstructionERP platform swap"
```

Run: `git status --short | grep -v '^??' ; git log --oneline main..HEAD`
Expected: no tracked changes; the three commits above plus the docs commit.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/module-progress-home
gh pr create --base main --head feat/module-progress-home \
  --title "feat(home): report progress by the six delivery modules" \
  --body "$(cat <<'EOF'
## Summary
- Home page reports progress per delivery module (Legal, Design, Procurement, Construction, Sales & Marketing, Operation) as agreed at the 2026-09-04 review
- Work and gates counted separately; no phantom bars for modules without records
- Records supabase-phase10 as applied to production
- Adds the design spec and Plan 1 for the platform swap to OpenConstructionERP (docs/superpowers/)

This is the final feature of the Next.js core before the platform swap.

## Test plan
- [ ] `npm run lint && npm run typecheck && npm test` green in CI
- [ ] Vercel preview renders `/` with six module cards

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI, then merge (user's click or `gh pr merge`)**

Run: `gh pr checks --watch` then `gh pr merge --squash --delete-branch=false`
Expected: PR merged; `git fetch origin && git log --oneline -1 origin/main` shows the squash commit.

- [ ] **Step 4: Tag the archive**

```bash
git fetch origin main
git tag -a legacy-nextjs-final origin/main -m "Last version of the Next.js/Supabase core before the OpenConstructionERP platform swap"
git push origin legacy-nextjs-final
```

Run: `git ls-remote --tags origin | grep legacy-nextjs-final`
Expected: one line with the tag.

---

### Task 2: Fork OCE v16.7.0 onto `platform/oce`

**Files:**
- Create (via checkout): the entire OCE tree at `v16.7.0`
- Create: `docs/superpowers/specs/2026-09-04-oce-platform-swap-design.md`, `docs/superpowers/plans/2026-09-04-oce-platform-swap-plan-1-fork-and-deploy.md` (copied from `feat/module-progress-home`)

**Interfaces:**
- Produces: branch `platform/oce` whose first commit is upstream's `v16.7.0`; remote `upstream` for future merges.

- [ ] **Step 1: Add the upstream remote and fetch the pinned tag (≈1.1 GB, one-time)**

```bash
git remote add upstream https://github.com/datadrivenconstruction/OpenConstructionERP.git
git fetch upstream --tags --no-recurse-submodules
```

Run: `git tag -l 'v16.7.0'`
Expected: `v16.7.0`

- [ ] **Step 2: Create the branch from the tag**

The working tree contains untracked files (`_import_*.sql`, `.claude/`, `coverage/`, `.env.local`). None collide with OCE paths, so checkout succeeds and leaves them in place.

```bash
git checkout -b platform/oce v16.7.0
```

Run: `git describe --tags --exact-match && ls backend frontend deploy && ls backend/app/modules | wc -l`
Expected: `v16.7.0`; the three directories; a module count ≥ 190.

- [ ] **Step 3: Bring the spec and plans over from the old branch and commit**

```bash
git checkout feat/module-progress-home -- docs/superpowers
git add docs/superpowers
git commit -m "docs: add the OCE platform-swap design spec and Plan 1"
```

Run: `git log --oneline -2`
Expected: our docs commit on top of upstream's `v16.7.0` commit.

---

### Task 3: RCC compose overlay, tunnel service, env template (test-first)

**Files:**
- Create: `deploy/rcc/test_config.sh`
- Create: `deploy/rcc/docker-compose.rcc.yml`
- Create: `deploy/rcc/.env.example`

**Interfaces:**
- Consumes: upstream `docker-compose.prod.yml` service names `postgres`, `backend`, `frontend`, `qdrant`; its `build:` blocks are kept (images are built locally).
- Produces: env variables `RCC_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN`; compose profile `public` (adds `cloudflared`); loopback port `127.0.0.1:8080` → frontend.

- [ ] **Step 1: Write the failing config test**

```bash
#!/usr/bin/env bash
# deploy/rcc/test_config.sh — asserts the rendered production config is the
# RCC one: local builds kept, demo seeding off, admin-approve registration,
# frontend on loopback only, nothing else published, cloudflared only under
# the "public" profile.
set -euo pipefail
cd "$(dirname "$0")/../.."

export RCC_DOMAIN=test.example
export POSTGRES_PASSWORD=test-only-password
export JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export CLOUDFLARE_TUNNEL_TOKEN=test-only-token

base=(docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml)
cfg=$("${base[@]}" config)
cfg_public=$("${base[@]}" --profile public config)

fail() { echo "FAIL: $1" >&2; exit 1; }
has() { grep -qE -- "$1" <<<"$cfg"; }
has_public() { grep -qE -- "$1" <<<"$cfg_public"; }

has 'SEED_DEMO: "false"'                                        || fail "demo seeding is not disabled"
has 'OE_REGISTRATION_MODE: admin-approve'                       || fail "registration mode is not admin-approve"
has 'OE_DEFAULT_REGISTRATION_ROLE: viewer'                      || fail "default registration role is not viewer"
has 'ALLOWED_ORIGINS: https://test\.example,http://localhost:8080' || fail "ALLOWED_ORIGINS must list the tunnel host and the loopback URL"
has 'target: api'                                               || fail "backend no longer builds the api target locally"
has 'dockerfile: deploy/docker/Dockerfile.frontend'             || fail "frontend no longer builds locally"
has 'host_ip: 127\.0\.0\.1' && has 'published: "8080"'          || fail "frontend is not bound to 127.0.0.1:8080"
has 'published: "80"'                                           && fail "port 80 is published"
has 'published: "443"'                                          && fail "port 443 is published"
has 'published: "5432"'                                         && fail "postgres is published to the host"
has_public 'image: cloudflare/cloudflared:'                     || fail "cloudflared missing under --profile public"
has_public 'TUNNEL_TOKEN: test-only-token'                      || fail "cloudflared does not receive the tunnel token"
# Profile membership, not absence: whether `config` omits inactive-profile
# services varies by Compose version, but the rendered profiles list does not.
grep -A3 '^  cloudflared:' <<<"$cfg_public" | grep -q 'profiles:' || fail "cloudflared is not behind the public profile"
grep -A5 '^  cloudflared:' <<<"$cfg_public" | grep -q -- '- public' || fail "cloudflared profile is not named public"

echo "OK: RCC production config"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `chmod +x deploy/rcc/test_config.sh && deploy/rcc/test_config.sh`
Expected: docker compose errors with `no such file or directory` for `deploy/rcc/docker-compose.rcc.yml` (non-zero exit).

- [ ] **Step 3: Write the overlay**

```yaml
# deploy/rcc/docker-compose.rcc.yml
#
# RCC overlay for upstream's docker-compose.prod.yml, for the Mac mini.
# Run from the repo root:
#   docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public up -d
#
# What it changes and why:
#   * Images are still built here (upstream's build: blocks are inherited).
#     Upstream publishes amd64 only and says Apple Silicon should build from
#     source; the mini has the RAM for it.
#   * SEED_DEMO=false: no demo accounts or showcase projects on RCC's data.
#   * Registration is admin-approve: the first account to register becomes
#     admin (Mr Phán); everyone after waits for his approval.
#   * The frontend is bound to 127.0.0.1:8080 for local checks only. Nothing
#     else is published; the public route is the Cloudflare Tunnel, which is
#     an outbound connection from the cloudflared container to Cloudflare.
#   * cloudflared sits behind the "public" profile so the stack can be built
#     and checked on any Mac without a tunnel token.
#
# `!override` needs Docker Compose v2.24.4+.
services:
  backend:
    environment:
      SEED_DEMO: "false"
      OE_REGISTRATION_MODE: ${OE_REGISTRATION_MODE:-admin-approve}
      OE_DEFAULT_REGISTRATION_ROLE: ${OE_DEFAULT_REGISTRATION_ROLE:-viewer}
      ALLOWED_ORIGINS: https://${RCC_DOMAIN:?Set RCC_DOMAIN in .env},http://localhost:8080
      OE_FRONTEND_URL: https://${RCC_DOMAIN}

  frontend:
    ports: !override
      - "127.0.0.1:8080:80"

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    profiles: ["public"]
    command: tunnel --no-autoupdate run
    environment:
      # Created in Cloudflare Zero Trust → Networks → Tunnels. Empty by
      # default so `config` and LAN-only runs work; cloudflared itself
      # refuses to start without it when the profile is on.
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:-}
    depends_on:
      frontend:
        condition: service_healthy
```

```dotenv
# deploy/rcc/.env.example — copy to the REPO ROOT as .env on the mini.
# Compose reads the root .env; this file is only a template.

# Public hostname served through the Cloudflare Tunnel, e.g. erp.rcc.vn.
# Set as the tunnel's "public hostname" in the Cloudflare dashboard, pointing
# at service  http://frontend:80
RCC_DOMAIN=erp.example.com

# Generate on the mini:  openssl rand -base64 24
POSTGRES_PASSWORD=
# Generate on the mini:  openssl rand -hex 32   (min 64 chars; weak values are refused at boot)
JWT_SECRET=

# From Cloudflare Zero Trust → Networks → Tunnels → your tunnel → Docker
# install command (the long string after --token). Leave empty for LAN-only.
CLOUDFLARE_TUNNEL_TOKEN=

# Registration policy (see backend/app/config.py). Leave as is.
OE_REGISTRATION_MODE=admin-approve
OE_DEFAULT_REGISTRATION_ROLE=viewer

# Optional: enable the vector-search service with `--profile ai` and set
# VECTOR_BACKEND=qdrant QDRANT_URL=http://qdrant:6333 in this file.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deploy/rcc/test_config.sh`
Expected: `OK: RCC production config`. If Compose is older than 2.24.4 the `!override` tag fails to parse — update Docker Desktop rather than working around it.

- [ ] **Step 5: Commit**

```bash
git add deploy/rcc/test_config.sh deploy/rcc/docker-compose.rcc.yml deploy/rcc/.env.example
git commit -m "feat(deploy): add the RCC compose overlay with demo seeding off and a Cloudflare Tunnel profile"
```

---

### Task 4: Build the images and boot the stack (LAN-only) on this Mac

Proves the pinned tree builds on Apple Silicon and the overlay boots, before touching the mini. Docker Desktop must allow ≥ 12 GB RAM for the frontend build.

**Files:**
- None committed.

- [ ] **Step 1: Check Docker memory**

Run: `docker info --format '{{.MemTotal}}' | awk '{printf "%.1f GiB\n", $1/1024/1024/1024}'`
Expected: ≥ 11.2 GiB. The formula divides by 1024³, so it prints GiB, while Docker Desktop's "12 GB" memory setting is 12 GB decimal — the same allocation, written as 11.18 GiB. If lower, raise it in Docker Desktop → Settings → Resources → Memory before continuing.

- [ ] **Step 2: Write a throwaway `.env` and build**

```bash
cp deploy/rcc/.env.example .env
sed -i '' "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24)|" .env
sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml build 2>&1 | tail -20
```

Expected: both `backend` and `frontend` images build (20–40 minutes the first time). `.env` is git-ignored by upstream's `.gitignore` — confirm with `git check-ignore .env`.

If the backend build fails inside `pip install` with "no matching distribution" for a package on `aarch64`, use Docker Desktop's Rosetta emulation for the whole stack and note it in the PR:

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml build
```

- [ ] **Step 3: Boot without the tunnel and check health**

```bash
docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml up -d
until curl -sf http://localhost:8080/api/health >/dev/null; do sleep 5; done
curl -s http://localhost:8080/api/health | head -c 400
```

Expected: HTTP 200 within ~2 minutes; JSON containing a `"version"` field and module counts.

- [ ] **Step 4: Confirm demo seeding is off and the demo-login path**

The users module's router auto-mounts at `/api/v1/users` (`backend/app/modules/users/router.py:420`), so the endpoint is `/api/v1/users/auth/demo-login/`. With `SEED_DEMO=false` it must refuse.

Run: `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/v1/users/auth/demo-login/ -H 'content-type: application/json' -d '{"email":"demo@openestimate.local"}'`
Expected: `404` (demo disabled on this server) or `403`. If you get `405` or a routing `404` with `{"detail":"Not Found"}`, list the real path with `curl -s http://localhost:8080/api/openapi.json | python3 -c 'import json,sys; print([p for p in json.load(sys.stdin)["paths"] if "demo-login" in p])'` and use it in `deploy/rcc/smoke.sh` (Task 6).

- [ ] **Step 5: Tear down (keep the images, drop the data)**

```bash
docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml down -v
rm .env
```

Run: `docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml ps -q | wc -l`
Expected: `0`.

---

### Task 5: Prune upstream-only workflows

**Files:**
- Delete: `.github/workflows/{authors-guard,cla,dependency-review,desktop-check,desktop-release,e2e-cross-os,eval-match,homepage-loops,installer-scripts,module-captures,pypi-publish,release-signing,release,repo-hygiene,sbom-and-licenses,scorecard,secret-scan}.yml`
- Keep: `ci.yml`, `ci-full.yml`, `ci-postgres.yml`, `codeql.yml`

- [ ] **Step 1: Remove workflows that only make sense for the upstream project**

They publish to PyPI, sign releases, build desktop installers, enforce upstream's CLA and authorship, or need upstream secrets. Left in place they fail on every push and drown our own status checks.

```bash
git rm .github/workflows/authors-guard.yml .github/workflows/cla.yml \
  .github/workflows/dependency-review.yml .github/workflows/desktop-check.yml \
  .github/workflows/desktop-release.yml .github/workflows/e2e-cross-os.yml \
  .github/workflows/eval-match.yml .github/workflows/homepage-loops.yml \
  .github/workflows/installer-scripts.yml .github/workflows/module-captures.yml \
  .github/workflows/pypi-publish.yml .github/workflows/release-signing.yml \
  .github/workflows/release.yml .github/workflows/repo-hygiene.yml \
  .github/workflows/sbom-and-licenses.yml .github/workflows/scorecard.yml \
  .github/workflows/secret-scan.yml
```

Run: `ls .github/workflows`
Expected: `ci-full.yml ci-postgres.yml ci.yml codeql.yml secret-scan.yml`

Two corrections to the list above, found during the final review:

- `installer-scripts.yml` does **not** exist at `v16.7.0` — it was taken from
  upstream's `main`. The `git rm` therefore removes 16 files, not 17; drop that
  path from the command.
- `secret-scan.yml` must be **kept**. It needs no upstream secrets (it fetches a
  SHA-256-pinned gitleaks binary) and is the repository's only automated
  credential guard, which this fork needs more than upstream does. It was
  deleted and then restored; the reasoning is recorded in `RCC.md` → "CI
  workflows".

- [ ] **Step 2: Commit, push, watch the remaining workflows**

```bash
git commit -m "ci: drop upstream-only release, packaging and governance workflows"
git push -u origin platform/oce
gh run list --branch platform/oce --limit 6
```

Expected: only the four kept workflows run.

- [ ] **Step 3: If a kept workflow fails for reasons unrelated to our files (missing upstream secrets, self-hosted runners), delete it in its own commit that states the reason**

```bash
git rm .github/workflows/<failing>.yml
git commit -m "ci: drop upstream <name> workflow — needs <secret/runner> the fork does not have"
git push
```

---

### Task 6: Backup with restore proof, launchd schedule, smoke script (test-first)

**Files:**
- Create: `deploy/rcc/test_backup.sh`
- Create: `deploy/rcc/backup.sh`
- Create: `deploy/rcc/test_backup_schedule.sh`
- Create: `deploy/rcc/install-backup-schedule.sh`
- Create: `deploy/rcc/smoke.sh`

**Interfaces:**
- Produces: `backup.sh` env contract — `BACKUP_DIR` (default `$HOME/rcc-erp-backups`), `KEEP_DAYS` (14), `PG_EXEC` (test hook: command prefix that runs a program inside Postgres; default is compose `exec -T postgres`), `SKIP_APP_DATA=1` to skip the `/data` tarball, `APP_DATA_VOLUME` (default `<project>_app_data`). Output files `oce-<stamp>.dump` (pg_dump custom format) and `app-data-<stamp>.tgz`.
- Produces: `install-backup-schedule.sh` — writes and loads launchd agent `vn.rcc.erp-backup` (02:00 daily); env `LAUNCH_AGENTS_DIR`, `NO_LOAD=1` for tests.
- Produces: `smoke.sh <base-url>` exit 0 = healthy.

- [ ] **Step 1: Write the failing backup/restore test**

```bash
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `chmod +x deploy/rcc/test_backup.sh && deploy/rcc/test_backup.sh`
Expected: `deploy/rcc/backup.sh: No such file or directory` (non-zero exit).

- [ ] **Step 3: Write backup.sh**

```bash
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
```

- [ ] **Step 4: Run the backup test to verify it passes**

Run: `chmod +x deploy/rcc/backup.sh && deploy/rcc/test_backup.sh`
Expected: `database: …` line, then `OK: backup restores`.

- [ ] **Step 5: Write the failing schedule test**

```bash
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `chmod +x deploy/rcc/test_backup_schedule.sh && deploy/rcc/test_backup_schedule.sh`
Expected: `deploy/rcc/install-backup-schedule.sh: No such file or directory`.

- [ ] **Step 7: Write install-backup-schedule.sh**

```bash
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
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
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
```

- [ ] **Step 8: Run the schedule test to verify it passes**

Run: `chmod +x deploy/rcc/install-backup-schedule.sh && deploy/rcc/test_backup_schedule.sh`
Expected: `OK: backup schedule`.

- [ ] **Step 9: Write smoke.sh**

```bash
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
```

- [ ] **Step 10: Lint the shell scripts and commit**

Run: `docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable deploy/rcc/backup.sh deploy/rcc/smoke.sh deploy/rcc/install-backup-schedule.sh deploy/rcc/test_backup.sh deploy/rcc/test_backup_schedule.sh deploy/rcc/test_config.sh`
Expected: no findings.

```bash
chmod +x deploy/rcc/smoke.sh
git add deploy/rcc/backup.sh deploy/rcc/install-backup-schedule.sh deploy/rcc/smoke.sh deploy/rcc/test_backup.sh deploy/rcc/test_backup_schedule.sh
git commit -m "feat(deploy): nightly launchd backup with restore proof, and a post-deploy smoke check"
```

---

### Task 7: `RCC.md` runbook and `deploy/rcc/README.md` (Mac mini)

**Files:**
- Create: `RCC.md`
- Create: `deploy/rcc/README.md`

- [ ] **Step 1: Write RCC.md**

```markdown
# RCC fork of OpenConstructionERP

This repository is Royal Canary Corporation's fork of
[OpenConstructionERP](https://github.com/datadrivenconstruction/OpenConstructionERP)
(AGPL-3.0). It replaced the earlier Next.js/Supabase dashboard on 2026-09-04;
that code is preserved at tag `legacy-nextjs-final`.

Upstream's own README, DEVELOPING.md and MODULES.md apply unchanged. This file
covers only what is specific to RCC.

## Pin

| | |
|---|---|
| Upstream tag | `v16.7.0` |
| Upstream remote | `upstream` → https://github.com/datadrivenconstruction/OpenConstructionERP.git |
| Production branch | `main` (before cutover: `platform/oce`) |
| Production host | Apple Silicon Mac mini, Docker Desktop, Cloudflare Tunnel (`deploy/rcc/README.md`) |

## Where RCC code lives

Everything RCC-specific is additive and namespaced so upstream merges stay clean:

- `deploy/rcc/` — compose overlay, tunnel profile, backups, smoke test, host runbook
- `backend/app/modules/rcc_*` — RCC backend modules
- `frontend/src/modules/rcc-*` — RCC frontend modules (registered in `frontend/src/modules/_registry.ts`)
- `docs/superpowers/` — design specs and plans

Do not edit other upstream files. If a change is needed upstream, open an issue
with them (they re-implement reports; they do not merge PRs) and carry a
minimal patch here until it lands.

## Upgrading upstream

```bash
git fetch upstream --tags
git checkout -b chore/upgrade-vX.Y.Z main
git merge vX.Y.Z            # conflicts should only touch the paths above
make lint typecheck test
deploy/rcc/test_config.sh && deploy/rcc/test_backup.sh
```
Open a PR, build and boot it on a Mac (`deploy/rcc/README.md` → "Deploying a
new version"), run `deploy/rcc/smoke.sh`, then merge and update the pin table.

## Production

Short form (on the mini, in `~/rcc-erp`):

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
git pull && $C build && $C up -d && deploy/rcc/smoke.sh http://localhost:8080
```

## Licence note

AGPL-3.0 §13 requires that people who use the software over a network can obtain
the source of the version they use. RCC staff are those users and this
repository is that source. Do not relicense or distribute closed builds.
```

- [ ] **Step 2: Write deploy/rcc/README.md**

```markdown
# Mac mini runbook

Production host for now: an Apple Silicon Mac mini (≥ 16 GB RAM) at the
operator's home, reached through a Cloudflare Tunnel. Everything below runs as
the mini's normal user account; `C` is the compose command used throughout:

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
```

## First-time setup

1. **Keep the mini awake and self-recovering.** System Settings → Users & Groups
   → Automatic login: on (Docker Desktop only runs inside a login session), and:
   ```bash
   sudo pmset -a sleep 0 disksleep 0 displaysleep 10 autorestart 1 womp 1
   ```
   Turn FileVault on (System Settings → Privacy & Security) — RCC data lives here.
2. **Docker Desktop** from https://docs.docker.com/desktop/setup/install/mac-install/
   (free for organisations under 250 staff / $10M revenue). In Settings:
   General → "Start Docker Desktop when you sign in": on;
   Resources → Memory: **12 GB** or more; Virtual Machine Options → Rosetta: on
   (only needed if an arm64 build fails). Then `docker compose version` ≥ 2.24.4.
3. **Checkout** (shallow — the mini only needs the current tree):
   ```bash
   git clone --depth 1 -b platform/oce https://github.com/kisu-io/rcc-pm-dashboard.git ~/rcc-erp
   cd ~/rcc-erp
   ```
4. **Environment:**
   ```bash
   cp deploy/rcc/.env.example .env
   sed -i '' "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24)|" .env
   sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
   nano .env      # set RCC_DOMAIN now; CLOUDFLARE_TUNNEL_TOKEN in step 7
   chmod 600 .env
   ```
5. **Build and start LAN-only** (20–40 min the first time):
   ```bash
   docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml build
   docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml up -d
   deploy/rcc/smoke.sh http://localhost:8080
   ```
6. **Cloudflare Tunnel.** In https://one.dash.cloudflare.com → Networks → Tunnels
   → Create a tunnel → Cloudflared → name it `rcc-erp` → choose **Docker** and
   copy the long token after `--token`. Under Public Hostname add
   `RCC_DOMAIN` (e.g. `erp.rcc.vn`) → Type **HTTP** → URL **`frontend:80`**.
   Cloudflare creates the DNS record for you.
7. **Go public:**
   ```bash
   nano .env      # paste CLOUDFLARE_TUNNEL_TOKEN=...
   $C up -d
   $C logs cloudflared | tail -5     # expect "Registered tunnel connection"
   deploy/rcc/smoke.sh "https://$(grep ^RCC_DOMAIN .env | cut -d= -f2)"
   ```
8. **First admin:** open `https://RCC_DOMAIN/?lang=vi`, choose **Register**. The
   first account becomes admin. Everyone after registers and is inactive until
   an admin activates them under Admin → Users.
9. **Backups:**
   ```bash
   deploy/rcc/install-backup-schedule.sh    # launchd, 02:00 daily → ~/rcc-erp-backups
   deploy/rcc/backup.sh                     # run once now
   ```
   Put `~/rcc-erp-backups` somewhere that leaves the mini: add it to iCloud
   Drive, or point `BACKUP_DIR` at an external disk when installing the schedule.

Note: Cloudflare's free plan limits request bodies to 100 MB. Documents and
spreadsheets are fine; multi-hundred-MB CAD/BIM uploads are not, until the
move to a VPS or a paid plan.

## Deploying a new version

```bash
cd ~/rcc-erp && git pull
$C build && $C up -d
deploy/rcc/smoke.sh http://localhost:8080
```

## Rollback

```bash
cd ~/rcc-erp && git log --oneline -5      # pick the previous commit
git checkout <sha> && $C build && $C up -d
```
The schema is built by `create_all` and is additive, so an older build runs
against a newer schema. Return to the branch afterwards with `git checkout platform/oce`.

## Restore

```bash
$C stop backend
$C exec -T postgres pg_restore -U oe -d openestimate --clean --if-exists < ~/rcc-erp-backups/oce-<stamp>.dump
docker run --rm -v rcc-erp_app_data:/data -v ~/rcc-erp-backups:/in alpine:3 sh -c 'rm -rf /data/* && tar xzf /in/app-data-<stamp>.tgz -C /data'
$C start backend
```

## Moving to a VPS later

Run `deploy/rcc/backup.sh`, copy the two newest files to the VPS, follow this
runbook there (Linux: `docker compose` from Docker Engine, `cron` instead of
launchd), restore, and re-point the tunnel by pasting the same
`CLOUDFLARE_TUNNEL_TOKEN` into the VPS's `.env` — DNS does not change.
```

- [ ] **Step 3: Commit**

```bash
git add RCC.md deploy/rcc/README.md
git commit -m "docs: add the RCC fork runbook and the Mac mini deployment guide"
git push
```

---

### Task 8: Bring up the Mac mini and accept

Manual, done by the user on the mini following `deploy/rcc/README.md`, with the assistant driving commands only where asked. Secrets and the tunnel token are entered by the user.

**Files:**
- None in the repo. Produces the running deployment.

- [ ] **Step 1: Confirm the assumptions in the spec §7**

Run on the mini: `sysctl -n machdep.cpu.brand_string; sysctl -n hw.memsize | awk '{print $1/1073741824 " GB"}'; df -h / | tail -1; sw_vers -productVersion`
Expected: Apple M-series; ≥ 16 GB; ≥ 60 GB free; macOS 14 or newer. Confirm the domain is on Cloudflare DNS (Cloudflare dashboard → Websites lists it).

- [ ] **Step 2: Follow README "First-time setup" steps 1–6, ending with the bootstrap admin**

Run: `deploy/rcc/smoke.sh http://localhost:8080`
Expected: `health: …`, `demo login: refused (404)`, `OK: http://localhost:8080`.

Then, still on the mini and still with no tunnel: open `http://localhost:8080/?lang=vi` → Register, as Mr Phán. The first account to register becomes the admin, so this has to happen while the only route to the instance is loopback. Do not start the tunnel until it is done.

- [ ] **Step 3: Follow README steps 7–8 (tunnel)**

Run: `deploy/rcc/smoke.sh "https://$RCC_DOMAIN"` from a device *not* on the home network (phone on mobile data is enough for the browser check; the script from a laptop tethered to it).
Expected: `OK: https://…`; the login page loads over HTTPS with a valid certificate.

- [ ] **Step 4: Verify the bootstrap admin through the public URL**

Log in at `https://$RCC_DOMAIN/?lang=vi` as the account registered in Step 2. Then, with the access token from the login response:

Run: `curl -s -H "Authorization: Bearer $TOKEN" "https://$RCC_DOMAIN/api/v1/users/me/" | python3 -c 'import json,sys; print(json.load(sys.stdin)["role"])'`
Expected: `admin` — confirming the public route reaches the same instance and that the bootstrap was already consumed before the tunnel opened.

- [ ] **Step 5: Verify a second registration is held for approval**

Register a second test account in a private window, then try to log in.
Expected: login refused as inactive; the account appears in Admin → Users where the admin can activate it. Delete the test account afterwards.

- [ ] **Step 6: Verify no demo content, Vietnamese UI, and live features through the tunnel**

Expected: Projects list is empty (no showcase projects); UI labels are in Vietnamese after `?lang=vi`; the language picker switches back to English; the notifications bell connects (no "reconnecting" state) — this proves WebSockets pass through the tunnel.

- [ ] **Step 7: Resource check and backups (README step 9)**

Run: `docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'` then `ls -lh ~/rcc-erp-backups && launchctl list | grep vn.rcc.erp-backup`
Expected: total container memory well under the mini's RAM (typically 1.5–2.5 GB idle) — record the numbers in the PR for Plan 5's VPS sizing; today's `oce-*.dump` and `app-data-*.tgz` exist; the launchd job is listed.

---

### Task 9: Open the draft PR for the platform branch

**Files:**
- None.

- [ ] **Step 1: Join the Next.js history into `platform/oce` first**

`platform/oce` starts from upstream `v16.7.0` and shares no ancestor with `main`. GitHub refuses to open a pull request between unrelated histories, so `main` has to become an ancestor without changing the fork's tree:

```bash
git checkout platform/oce
git fetch origin
git merge -s ours --no-ff origin/main \
  -m "chore: join the Next.js history so the platform branch can be compared and merged"
git diff HEAD~1 HEAD    # must print nothing: the tree is byte-identical to the fork
git push -u origin platform/oce
```

Executed as `845524d48`. **Repeat this merge once PR #10 lands on `main`**, otherwise Plan 4's cutover merge takes its base from the pre-#10 commit and arrives as a modify/delete conflict on every file that PR touched — the exact situation the `-s ours` join exists to prevent. Sequence it as one step: merge PR #10 → `git tag legacy-nextjs-final` → re-run the merge above → push.

- [ ] **Step 2: Open a draft PR `platform/oce` → `main` (do not merge — that is Plan 4)**

```bash
gh pr create --draft --base main --head platform/oce \
  --title "Platform swap: OpenConstructionERP v16.7.0 fork" \
  --body "$(cat <<'EOF'
## Summary
- Replaces the Next.js/Supabase core with a fork of OpenConstructionERP pinned at v16.7.0 (old core archived at tag `legacy-nextjs-final`)
- Adds the RCC compose overlay with a Cloudflare Tunnel profile (`deploy/rcc/`), launchd backups with restore proof, smoke test, and the fork + Mac mini runbooks
- Design: `docs/superpowers/specs/2026-09-04-oce-platform-swap-design.md`

**Do not merge** until Plans 2–4 are complete and Mr Phán has signed off on the Mac mini deployment. The histories are already joined by the `-s ours` merge in Step 1, so the cutover is an ordinary `--no-ff` merge — no `--allow-unrelated-histories`.

## Measured on the mini (for Plan 5 VPS sizing)
- idle memory: <fill from Task 8 Step 7>
- build time: <fill from Task 8 Step 2>

## Test plan
- [x] `deploy/rcc/test_config.sh`
- [x] `deploy/rcc/test_backup.sh`
- [x] `deploy/rcc/test_backup_schedule.sh`
- [x] `deploy/rcc/smoke.sh http://localhost:8080` and `https://<domain>` on the mini
- [ ] Plan 2 (rcc_readiness backend) merged into this branch
- [ ] Plan 3 (rcc-readiness frontend) merged into this branch
- [ ] Plan 4 cutover checklist

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Run: `gh pr view --json isDraft,baseRefName,headRefName --jq '.'`
Expected: `isDraft: true`, base `main`, head `platform/oce`.
