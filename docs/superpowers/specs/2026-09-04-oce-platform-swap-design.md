# RCC PM Dashboard → OpenConstructionERP platform swap — design

**Date:** 2026-09-04
**Status:** approved decisions, plans in progress
**Owner:** kisu-io (for Mr Phán, RCC)

## 1. Decision

Replace the current core of `rcc-pm-dashboard` (Next.js 14 + Supabase on Vercel,
3.5k lines) with a fork of
[datadrivenconstruction/OpenConstructionERP](https://github.com/datadrivenconstruction/OpenConstructionERP)
("OCE"), pinned at **v16.7.0** (released 2026-09-03), and re-implement the
RCC-specific views (opening readiness, six delivery modules) as an OCE module.

Decisions taken on 2026-09-04 with the user:

| Question | Decision |
|---|---|
| Kind of swap | **Full swap.** This repo becomes an OCE fork; the Next.js app is retired after sign-off. |
| Hosting | **Apple Silicon Mac mini (16 GB+) at the user's home, for now**, via OCE's `docker-compose.prod.yml` plus an RCC overlay. The existing VPS is too small. A move to a VPS is a later plan using the same compose files and the backup/restore path. |
| Public access | **Cloudflare Tunnel** — no port-forwarding, HTTPS included, WebSockets work. Requires a domain on Cloudflare DNS. Free plan caps request bodies at 100 MB. |
| Frontend on Vercel? | **No.** OCE's SPA hardcodes a same-origin `/api` base (`frontend/src/shared/lib/api.ts:19`); on Vercel it would need rewrites that cannot carry WebSocket upgrades, and the build wants an 8 GB heap. Vercel adds nothing the mini's nginx does not already do. |
| Live data (1 project, 679 tasks, 12 users, 2,731 activity rows) | **Fresh start.** No migration script. Mr Phán re-imports from the source workbooks. |
| Old core | Kept on `main` (tagged `legacy-nextjs-final`) until cutover; Vercel and Supabase retired in Plan 4. |

## 2. What OCE is (measured on the v16.7.0 tree)

- Backend: Python 3.12+, FastAPI, SQLAlchemy 2 (async), PostgreSQL 16 **only**.
  190 auto-discovered modules under `backend/app/modules/<name>/` (a `manifest.py`
  is the whole registration mechanism). Schema is built by `create_all` plus a
  column-heal pass at boot; `/api/health` reports whether the Alembic head matches.
- Frontend: React 18 + TypeScript + Vite SPA, react-router, i18next with 41 shipping
  locales including **`vi`**. Optional modules register in
  `frontend/src/modules/_registry.ts`; the home dashboard and project page are
  widget grids (`features/dashboard/widgetRegistry.ts`,
  `features/projects/projectWidgetRegistry.ts`).
- Production layout: `docker-compose.prod.yml` = `postgres` (pgduckdb 16) +
  `backend` (API-only target of `deploy/docker/Dockerfile.unified`, port 8000) +
  `frontend` (nginx serving the SPA and proxying `/api/`, port 80) + optional
  `qdrant` (profile `ai`). No TLS termination — the docs say 443 belongs to a proxy.
- Images: every base image (`python:3.12-slim`, `node:22-alpine`, `nginx:alpine`,
  `pgduckdb/pgduckdb:16-main`) is multi-arch, and upstream's docs say Apple Silicon
  should **build from source** rather than pull their amd64 image. The frontend
  build runs `tsc -b` + Vite with `--max-old-space-size=8192`, so the build host
  needs ≥ 12 GB available to Docker. The only amd64-only component is the optional
  `cad2data` CAD converter (IFC files fall back to placeholder geometry on arm64).
- First-run semantics that matter to us:
  - `SEED_DEMO=false` disables demo accounts and showcase projects.
  - Registration: `OE_REGISTRATION_MODE` defaults to `admin-approve`; the
    **first registered user becomes admin** (`users/service.py:424-465`),
    later self-registrations are inactive until an admin activates them.
    `OE_DEFAULT_REGISTRATION_ROLE` ∈ {viewer, editor, manager}, default viewer.
  - Settings read env with prefix `OE_` and accept the legacy unprefixed names
    the compose files use (`JWT_SECRET`, `ALLOWED_ORIGINS`, `APP_ENV`, …).
  - Auth is a bearer JWT kept in `localStorage`, not a cookie.
  - Language: `?lang=vi` on any URL stores the choice in `localStorage`;
    otherwise browser language, then `en`.
- Licence: **AGPL-3.0**. Internal use by RCC staff is fine; our modifications
  must remain available to the users who interact with the deployment
  (they will — the repo is theirs). The code can never be made proprietary.
  A commercial licence template exists if that ever matters.
- Governance: upstream **does not merge external pull requests**. Our fork is
  permanent; we upgrade by merging upstream tags. Upstream released three
  versions in the three days before this spec — upgrades are a deliberate,
  scheduled activity, not a reflex.

## 3. Target architecture

```
kisu-io/rcc-pm-dashboard  (branch platform/oce → becomes main at cutover)
├── <entire OCE v16.7.0 tree, unmodified>
├── RCC.md                                  ← fork runbook (pin, upgrade, deploy, backup)
├── deploy/rcc/                             ← RCC deployment overlay (Plan 1)
│   ├── docker-compose.rcc.yml              ← SEED_DEMO=false, loopback port, cloudflared (profile "public")
│   ├── .env.example                        ← copied to repo-root .env on the host
│   ├── backup.sh / install-backup-schedule.sh / smoke.sh / test_*.sh
│   └── README.md                           ← Mac mini runbook
├── backend/app/modules/rcc_readiness/      ← RCC backend module (Plan 2)
├── frontend/src/modules/rcc-readiness/     ← RCC frontend module + widgets (Plan 3)
└── docs/superpowers/{specs,plans}/         ← this spec and the plans
```

Runtime on the Mac mini (Docker Desktop, one compose project `rcc-erp`):

```
Internet ──▶ Cloudflare edge (TLS, https://erp.<domain>)
                │ outbound tunnel, no open ports
                ▼
          cloudflared ──▶ frontend (nginx, SPA, /api/ proxy) ──8000──▶ backend (FastAPI)
                                   ▲                                       └──5432──▶ postgres
          127.0.0.1:8080 ──────────┘ (loopback only, for local checks)
volumes: pg_data, app_data (/data: uploads, vectors)
```

Images are built on the mini itself (`docker compose build`); there is no image
registry. Moving to a VPS later = same compose files, build there (or add a
registry workflow then), `backup.sh` output restored.

### RCC customisation policy (keeps upstream merges clean)

1. **Never edit an upstream file** except the two registration points
   (`frontend/src/modules/_registry.ts`, and `scripts/check_module_manifests.py`'s
   allowlist if we add a shared library) and the workflow pruning in Plan 1.
2. All RCC code lives in namespaced directories: `backend/app/modules/rcc_*`,
   `frontend/src/modules/rcc-*`, `deploy/rcc/`, `RCC.md`.
3. Upgrade = `git fetch upstream --tags && git merge vX.Y.Z`, resolve conflicts
   only in the files above, run `make lint typecheck test`, rebuild images.
4. Pin is recorded in `RCC.md`; every upgrade is its own PR.

## 4. Data model mapping (old core → OCE)

Fresh start means no migration script, but the mapping fixes where each RCC
concept lives so Plans 2–3 and the Excel re-import template agree.

| Old (`lib/supabase.ts`) | OCE home | Notes |
|---|---|---|
| `projects` (name, status, start_date, target_end, location, pm, cover_url) | `oe_projects_project` (name, status, planned_start_date, planned_end_date, address, owner_id) | `target_end` = opening date → `planned_end_date`. Cover image → `metadata_.cover_url`. |
| `projects.pct_<module>` (six PM overrides) | **new** `oe_rcc_module_override` (project_id, module, pct) | Owned by `rcc_readiness`. 0/absent = derive from records. |
| `tasks` with `task_kind='work'` | `oe_tasks_task`, `task_type='rcc_work'` | `task_type` accepts custom strings (`tasks/schemas.py:28`). `metadata_` carries `module`, `department` (old `phase`), `zone`, `constraint_note`, `due_month`. Status map: To Do→`open`, In Progress→`in_progress`, Review→`in_progress` + `metadata_.review=true`, Done→`completed`. |
| `tasks` with `task_kind='gate'` | `oe_tasks_task`, `task_type='rcc_gate'` | Same metadata. Undated/unowned is correct for gates. |
| `milestones` | `oe_projects_milestone` | `type` → `milestone_type`. |
| `documents` | `documents` / `cde` modules | Native OCE file store (local `/data`). |
| `materials` (0 rows) | `procurement` / `site_inventory` | Native. |
| `cost_entries` (0 rows) | `costs` / `cvr` | Native. |
| `user_roles` (pm/viewer/admin) | `oe_users_user.role` (admin/manager/editor/viewer) | pm→manager. |
| `activity_log` | dropped | OCE keeps its own audit trail. |

Open point for Plan 2's first task (a 1-hour spike, not a decision to make here):
whether OCE's `TasksPage` Kanban tolerates the custom `task_type`/status values
above, or whether `rcc_readiness` should own its own `oe_rcc_item` table and UI.
Default is **reuse `oe_tasks_task`** (we get CRUD, Kanban and the
`POST /tasks/import/file/` Excel importer for free); fall back to an own table
only if the spike shows the Tasks UI hides or mangles the rows.

## 5. Plans

Each plan produces working, testable software on its own.

### Plan 1 — Fork and deploy on the Mac mini (`docs/superpowers/plans/2026-09-04-oce-platform-swap-plan-1-fork-and-deploy.md`)

Deliverable: OCE v16.7.0 running on the Mac mini from this repo's
`platform/oce` branch, reachable at `https://erp.<domain>` through a Cloudflare
Tunnel, no demo data, Mr Phán as the bootstrap admin, nightly backups proven
restorable, old core archived on `main` under tag `legacy-nextjs-final`.

### Plan 2 — `rcc_readiness` backend module

- Spike: custom `task_type` rows in the Tasks Kanban (see §4).
- `backend/app/modules/rcc_readiness/`: manifest, `models.py`
  (`oe_rcc_module_override`), `service.py` — a **port of `lib/readiness.ts`,
  `lib/task-kind.ts`, `lib/modules.ts`** to Python, function-for-function, with
  the existing Vitest cases ported to pytest (`lib/*.test.ts` are the spec).
- Router: `GET /api/v1/rcc-readiness/programme?project_id=`,
  `GET /api/v1/rcc-readiness/portfolio`, `GET/PUT /api/v1/rcc-readiness/overrides/{project_id}`.
- Excel import: extend the module with `POST /api/v1/rcc-readiness/import/`
  that accepts the RCC workbook layout (Title, Kind, Module, Department, Zone,
  Owner, Priority, Status, Due Date, Constraint, Notes) and writes
  `oe_tasks_task` rows with the metadata above; ships an `.xlsx` template.

### Plan 3 — `rcc-readiness` frontend module + widgets

- `frontend/src/modules/rcc-readiness/` with `manifest.ts` (routes
  `/rcc/programme`, `/rcc/readiness/:projectId`; nav group `planning`;
  `translations.en` + `translations.vi` — the bilingual labels from
  `lib/modules.ts` `MODULE_LABELS`).
- Port of `app/page.tsx` (Programme Progress), `components/modules/*`,
  `components/readiness/*` to the OCE component conventions (Tailwind, `t()`,
  `@tanstack/react-query` against Plan 2's endpoints).
- Two dashboard widgets registered in `widgetRegistry.ts` /
  `projectWidgetRegistry.ts`: `rcc-module-progress` (six bars) and
  `rcc-opening-readiness` (gates met / days to opening / overdue).
- Playwright smoke in `frontend/tests/e2e/rcc-readiness.spec.ts`.

### Plan 4 — Cutover and retirement

- Merge `platform/oce` → `main`. The Next.js history is already joined into
  `platform/oce` by `-s ours` merges — the first at `845524d`, repeated once
  PR #10 lands on `main` — which record `main` as an ancestor while leaving the
  fork's tree unchanged. The cutover is therefore an ordinary `--no-ff` merge,
  not `--allow-unrelated-histories`, and the old history stays reachable (also
  at tag `legacy-nextjs-final`); `main` becomes the default branch.
- Mr Phán: register (becomes admin), approve the other users, import the
  workbooks, verify the programme page against the last Vercel screenshot.
- Keep the Vercel URL alive read-only for 14 days, then delete the Vercel
  project.
- Supabase: pause the project at cutover; delete after 30 days. Take a final
  `pg_dump` first and store it with the mini's backups.
- Save the fork/pin/upgrade facts to memory; update `ROADMAP.md`.

### Plan 5 — Move from the Mac mini to a VPS (when RCC has one sized for it)

- Size from the mini's measured `docker stats`; expect ≥ 4 vCPU / 8 GB.
- Same compose files; build on the VPS or add a registry workflow then.
- `backup.sh` output restored on the VPS; the Cloudflare Tunnel is re-pointed
  (a tunnel is a token, not an IP — DNS does not change).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Home hosting: power cuts, ISP outages, macOS updates | `pmset` no-sleep + auto-restart, auto-login, Docker Desktop at login, `restart: unless-stopped`. Downtime is accepted for "for now"; Plan 5 ends it. |
| RCC data on a personal machine | Flagged to Mr Phán at cutover. FileVault on, backups synced off the mini. |
| Frontend build needs 8 GB heap | Docker Desktop memory ≥ 12 GB on the 16 GB+ mini; asserted in Plan 1 Task 4. |
| An arm64 wheel is missing | Fallback: `DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build` under Docker Desktop's Rosetta. Documented in Task 4. |
| Cloudflare free-plan 100 MB body cap | Fine for readiness data and documents; large CAD/BIM uploads wait for Plan 5 or a paid plan. Documented in the runbook. |
| Upstream moves fast, no PRs accepted | Pin a tag; upgrade monthly on a branch; RCC code isolated per §3. |
| AGPL network clause | Internal deployment; source is the users' own repo. Documented in `RCC.md`. |
| Data loss on a single host | Nightly `pg_dump` + `/data` tarball via launchd, 14-day retention, restore proven by `test_backup.sh`. Off-mini copy (iCloud Drive / external disk) is the user's step in the runbook. |
| Demo content leaking into production | `SEED_DEMO=false` asserted by `deploy/rcc/test_config.sh`; `smoke.sh` asserts demo-login is refused. |
| Old branch work lost | `feat/module-progress-home` is 3 commits ahead of `main` with no PR — Plan 1 Task 1 merges it before anything else so `legacy-nextjs-final` is complete. |

## 7. Assumptions to confirm before Plan 1 Task 8

1. The Mac mini is Apple Silicon with ≥ 16 GB RAM (confirmed by the user) and
   ≥ 60 GB free disk; it can stay logged in and awake.
2. A domain is on Cloudflare DNS (RCC's, or one the user registers); the
   hostname `erp.<domain>` is free to use.
3. The Cloudflare Tunnel token and all secrets are created and entered by the
   user, never by the assistant.
4. The Telegram "Zera" bot lives outside this repo and is unaffected.
