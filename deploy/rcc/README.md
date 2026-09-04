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
