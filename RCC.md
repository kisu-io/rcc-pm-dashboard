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
