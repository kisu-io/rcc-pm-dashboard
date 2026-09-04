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

**Never run `git add -A` or `git add .` in this repository.** RCC data files
(`_import_*.sql`, containing client and staff names) and old build output from
the retired Next.js core can sit untracked in a working tree, and a blanket add
commits them. Stage files by path.

## CI workflows

The fork keeps four upstream workflows plus the secret scan and removes the
rest. Kept:

- `ci.yml`, `ci-full.yml`, `ci-postgres.yml` — the actual test suites; they are
  what tells us an upstream upgrade still works.
- `codeql.yml` — static analysis, runs on GitHub-hosted runners with no
  upstream-only configuration.
- `secret-scan.yml` — the only automated credential guard. It fetches a
  SHA-256-pinned gitleaks binary and needs no secrets of its own, and this
  repository's whole operational story is hand-managed `.env` files, a Postgres
  password and a Cloudflare tunnel token. The `.pre-commit-config.yaml` gitleaks
  hook is opt-in per clone and does not run on push, so it is not a substitute.

Removed, because they only make sense for the upstream project and would fail on
every push here: `release.yml`, `release-signing.yml`, `pypi-publish.yml`
(publish upstream's releases and packages), `desktop-check.yml`,
`desktop-release.yml` (build upstream's desktop installers), `cla.yml`,
`authors-guard.yml` (enforce upstream's contributor agreement and AUTHORS file),
`scorecard.yml` (scores the upstream project and needs its org settings),
`repo-hygiene.yml`, `homepage-loops.yml`, `module-captures.yml`,
`eval-match.yml`, `e2e-cross-os.yml` (upstream's own docs, demo captures, eval
assets and cross-OS runner matrix).

Two removals are worth naming explicitly:

- `dependency-review.yml` — depends on the dependency-graph and Advanced
  Security settings configured on upstream's organisation, which this fork does
  not have; it fails rather than reports. Dependency risk is handled at upgrade
  time instead (see below).
- `sbom-and-licenses.yml` — generates an SBOM and licence manifest for upstream's
  published releases. This fork publishes no releases, and the AGPL-3.0 §13
  obligation is met directly: RCC staff use the software over a network and this
  repository *is* the corresponding source (see "Licence note").

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
