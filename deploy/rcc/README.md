# Mac mini runbook

Production host for now: an Apple Silicon Mac mini (≥ 16 GB RAM) at the
operator's home, reached through a Cloudflare Tunnel. Everything below runs as
the mini's normal user account; `C` is the compose command used throughout.
It lives in the shell, not on disk, so **run it again in every new Terminal
window** (or append it to `~/.zshrc`):

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
```

## First-time setup

1. **Keep the mini awake and self-recovering.** System Settings → Users & Groups
   → Automatic login: on (Docker Desktop only runs inside a login session), and:
   ```bash
   sudo pmset -a sleep 0 disksleep 0 displaysleep 10 autorestart 1 womp 1
   pmset -g | grep -E 'sleep|autorestart'
   ```
   Some Mac models do not support every key; `pmset` then rejects the whole
   command. If it errors, drop the key it names and run it again. The `pmset -g`
   line is what confirms which settings actually took.
   Turn FileVault on (System Settings → Privacy & Security) — RCC data lives here.
2. **Docker Desktop** from https://docs.docker.com/desktop/setup/install/mac-install/
   (free for organisations under 250 staff / $10M revenue). In Settings:
   General → "Start Docker Desktop when you sign in": on;
   Resources → Memory: **12 GB** or more; Virtual Machine Options → Rosetta: on
   (only needed if an arm64 build fails). Then `docker compose version` ≥ 2.24.4.
3. **Checkout** (full history — Rollback below needs the earlier commits):
   ```bash
   git clone -b platform/oce https://github.com/kisu-io/rcc-pm-dashboard.git ~/rcc-erp
   cd ~/rcc-erp
   ```
4. **Environment:**
   ```bash
   cp deploy/rcc/.env.example .env
   sed -i '' "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24)|" .env
   sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
   nano .env      # set RCC_DOMAIN now; CLOUDFLARE_TUNNEL_TOKEN in step 8
   chmod 600 .env
   ```
5. **Build and start LAN-only** (20–40 min the first time):
   ```bash
   docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml build
   docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml up -d
   deploy/rcc/smoke.sh http://localhost:8080
   ```
6. **First admin — do this now, before the tunnel exists.** Open
   `http://localhost:8080/?lang=vi` on the mini and choose **Register**. The
   first account to register becomes the admin. Until that account exists the
   bootstrap is unclaimed, so anyone who can reach the instance could take it —
   and step 7 puts the instance on the public internet under a DNS name that
   certificate-transparency logs publish within minutes. Claim it here, over
   loopback, where only the mini can reach it. Everyone after registers and is
   inactive until an admin activates them under Admin → Users.
7. **Cloudflare Tunnel.** In https://one.dash.cloudflare.com → Networks → Tunnels
   → Create a tunnel → Cloudflared → name it `rcc-erp` → choose **Docker** and
   copy the long token after `--token`. Under Public Hostname add
   `RCC_DOMAIN` (e.g. `erp.rcc.vn`) → Type **HTTP** → URL **`frontend:80`**.
   Cloudflare creates the DNS record for you.
8. **Go public:**
   ```bash
   nano .env      # paste CLOUDFLARE_TUNNEL_TOKEN=...
   $C up -d
   $C logs cloudflared | tail -5     # expect "Registered tunnel connection"
   deploy/rcc/smoke.sh "https://$(grep ^RCC_DOMAIN .env | cut -d= -f2)"
   ```
   Then sign in as the step 6 admin over `https://RCC_DOMAIN/?lang=vi` to
   confirm the public route reaches the same instance.

   **Caution:** `docker compose … config` renders `.env`, so its output contains
   the real `TUNNEL_TOKEN` and Postgres password in clear text. Never paste it
   into a chat, an issue or a support thread.
9. **Backups:**
   ```bash
   deploy/rcc/install-backup-schedule.sh    # launchd, 02:00 daily → ~/rcc-erp-backups
   deploy/rcc/backup.sh                     # run once now
   ```
   Backups must leave the mini, or a dead mini takes them with it. Point
   `BACKUP_DIR` at an **external disk** when installing the schedule:
   `BACKUP_DIR=/Volumes/<disk>/rcc-erp-backups deploy/rcc/install-backup-schedule.sh`.
   iCloud Drive works as an alternative, with two caveats:
   `~/Library/Mobile Documents` needs to be shared with Docker Desktop
   (Settings → Resources → File sharing) for the backup's `-v` mount, and iCloud
   can evict the local copy, so the file on disk may be a placeholder.

   Check weekly that `ls ~/rcc-erp-backups` shows yesterday's date and that
   there is **no `BACKUP-FAILED` file**. If there is one, read
   `~/rcc-erp-backups/backup.log`.

Note: Cloudflare's free plan limits request bodies to 100 MB. Documents and
spreadsheets are fine; multi-hundred-MB CAD/BIM uploads are not, until the
move to a VPS or a paid plan.

## Reading `/api/health`

In this deployment `/api/health` **always** reports `"status": "degraded"` with
`"frontend_dist_present": false`, and that is normal. nginx and the API run in
separate containers here, so the API container legitimately has no frontend
bundle on disk; upstream's health check counts that as a degradation because in
its single-container layout it would be one.

The signal to trust is the **HTTP status code**, not the `status` field: 200
plus a clean `deploy/rcc/smoke.sh` means the deployment is healthy. A non-200,
a failing `smoke.sh`, or `"database"` / `"schema_matches_models"` turning
unhealthy in the body is a real problem.

## Deploying a new version

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
cd ~/rcc-erp && git pull
$C build && $C up -d
deploy/rcc/smoke.sh http://localhost:8080
```

Image tags are pinned, including `cloudflared` in
`deploy/rcc/docker-compose.rcc.yml` — bump it here, deliberately, rather than
letting a deploy pick up a new one.

## Rollback

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
cd ~/rcc-erp && git log --oneline -5      # pick the previous commit
git checkout <sha> && $C build && $C up -d
```
The schema is built by `create_all` and is additive, so an older build runs
against a newer schema. Return to the branch afterwards with `git checkout platform/oce`.

## Restore

```bash
C="docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml --profile public"
$C stop backend
$C exec -T postgres pg_restore -U oe -d openestimate --clean --if-exists < ~/rcc-erp-backups/oce-<stamp>.dump
docker run --rm -v rcc-erp_app_data:/data -v ~/rcc-erp-backups:/in alpine:3 sh -c 'rm -rf /data/* && tar xzf /in/app-data-<stamp>.tgz -C /data'
$C start backend
deploy/rcc/smoke.sh http://localhost:8080
```
While `backend` is stopped nginx stays up and answers **502** — that is the
restore in progress, not a second fault. The closing `smoke.sh` is what says
the restore worked; do not consider the restore done without it.

## Moving to a VPS later

Run `deploy/rcc/backup.sh`, copy the two newest files to the VPS, follow this
runbook there (Linux: `docker compose` from Docker Engine, `cron` instead of
launchd), restore, and re-point the tunnel by pasting the same
`CLOUDFLARE_TUNNEL_TOKEN` into the VPS's `.env` — DNS does not change.
