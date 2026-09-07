# RCC CONST — Dashboard Plan

**Target platform:** OpenConstructionERP 16.9.0 (running from the PyPI wheel)
**Date:** 2026-09-07
**Status:** Research complete for the five-area card. Owner/investor portfolio view in progress.

---

## 0. Read this first — three facts that constrain everything

### 0.1 The running app is the wheel, not this repo

```
app.__file__ = .venv/lib/python3.12/site-packages/app/__init__.py
installed:     16.9.0   (PyPI wheel, not editable)
this repo:     16.7.0
```

`get_frontend_dir()` ([cli_static.py:107](backend/app/cli_static.py:107)) prefers the wheel's bundled
`_frontend_dist` (198 MB) over `frontend/dist`. **Editing `backend/app/**` or `frontend/src/**`
changes nothing at runtime.**

The gold-on-white branding already written in
[frontend/src/rcc-brand.css](frontend/src/rcc-brand.css), [index.html](frontend/index.html),
[en.ts](frontend/src/app/locales/en.ts) and [useThemeStore.ts](frontend/src/stores/useThemeStore.ts)
is real, correct work that **the running app never loads.**

### 0.2 …but that blocks *deployment*, not *development*

```bash
cd frontend && VITE_API_TARGET=http://127.0.0.1:8080 npm run dev
```

This serves your edited frontend against the **running wheel's live API**
([vite.config.ts:328-340](frontend/vite.config.ts:328); the wheel serves on `DEFAULT_PORT = 8080`,
[cli.py:88](backend/app/cli.py:88)). No `pip install -e`, no `pgdata` reset, no rebuild.

Also verified: **the module list in the repo and in the wheel is byte-identical.** Nothing you
build against source is missing at runtime.

### 0.3 Do NOT run `pip install -e backend[server]` to fix this

It is a **16.9.0 → 16.7.0 downgrade** against a database whose Alembic head was written by 16.9.
It needs an upstream merge first and will probably cost a `~/.openestimate/pgdata` reset.

**Cutover options, cheapest first:**

| Path | Effort | Durability |
|---|---|---|
| `npm run build`, copy `frontend/dist/*` over the wheel's `_frontend_dist/` | ~2 h | Wiped by the next `pip install -U`. Fine for a pilot. |
| `pip install -e backend[server]` | ~half a day + real risk | Durable, but see the downgrade warning above. |

---

## 1. The five business areas → what exists

Your customer cares about **Legal · Design · Procurement/Purchasing · Construction · Sales & Marketing**.

Four of the five have a **live, project-scoped, single-call aggregate** on the running install.
Four already ship a **frontend client function** you can import rather than write.

| Area | Coverage | Best source | Returns | Client |
|---|---|---|---|---|
| **Design** | strong | `coordination_hub` `GET /projects/{id}/dashboard` ([router.py:83](backend/app/modules/coordination_hub/router.py:83)) | open clashes + delta since last run + rule-pack pass/fail + open cost impact, one 30 s-cached call | ✅ [coordination/api.ts:25](frontend/src/features/coordination/api.ts:25) |
| **Construction** | strong | `progress` `GET /cumulative/?project_id=` ([router.py:135](backend/app/modules/progress/router.py:135)) | `current_cumulative_pct` — the headline number **absent from all 26 widgets** | ✅ [progress/api.ts:148](frontend/src/features/progress/api.ts:148) |
| **Legal** | strong | `contracts` `GET /contracts/?project_id=` ([router.py:265](backend/app/modules/contracts/router.py:265)) | mandatory project scope, correct `total` (whole set, not page) | ✅ dir exists |
| **Procurement** | strong | `procurement` `GET /stats/?project_id=` ([router.py:205](backend/app/modules/procurement/router.py:205)) | `total_pos`, `by_status`, `total_committed`, `pending_delivery_count` | ❌ **write this one** |
| **Sales & Marketing** | **weak** | `property_dev` `GET /developments/{id}/sales-dashboard` ([router.py:345](backend/app/modules/property_dev/router.py:345)) | sell-through %, contracted value by currency, handovers | ❌ none |

### Legal is the biggest opportunity

Excellent module depth, **zero dashboard presence today**. The only legal-adjacent number on the
dashboard is "Open change orders", framed as finance.

Beyond `contracts`, `change_intelligence` `GET /projects/{id}/notice-register`
([router.py:632](backend/app/modules/change_intelligence/router.py:632)) returns
`{at_risk, proof_missing, overdue, due_soon}` — contractual **time-bar clocks** derived from
FIDIC/NEC4/JCT periods, cross-checked against correspondence for proof of service. Nothing else in
the product is this close to a ready-made Legal card, and its client already exists at
[change-intelligence/api.ts:709](frontend/src/features/change-intelligence/api.ts:709).

If the Legal tile proves useful, `variations` `GET /dashboard/project/{id}`
([router.py:1476](backend/app/modules/variations/router.py:1476)) adds 17 more scalars from one
call — EOT claims open, disruption claims open, schedule impact days — with no new backend work.

### Sales & Marketing — two honest problems

1. **Marketing does not exist.** No campaigns, spend, channels, content, attribution or web
   analytics anywhere in 190+ modules. The only marketing-shaped code is `webhook_leads` (an
   inbound gateway with no count endpoint) and a single `source_cost` column on `property_dev`'s
   Lead ([models.py:729](backend/app/modules/property_dev/models.py:729)).
2. **`crm`'s dashboard takes no `project_id` at all** ([router.py:746](backend/app/modules/crm/router.py:746)).
   It genuinely returns `open_opportunities`, `weighted_value`, `leads_open`, `win_rate_30d` — but
   it cannot sit beside four project-scoped tiles without lying about scope.
   `property_dev` *is* project-scoped ([models.py:56](backend/app/modules/property_dev/models.py:56))
   but only fires for residential development.

**Cheapest real marketing number:** a count endpoint on `webhook_leads`. The data is already
persisted and indexed; only the `GROUP BY` is missing.

---

## 2. "Why write on top of Procurement — it's already in the app?"

Correct, and the distinction is narrow. **Nothing about procurement gets rewritten.**

| Layer | Status |
|---|---|
| `procurement` backend module | ✅ ships, `category="core"` |
| Procurement page in the sidebar | ✅ ships, `frontend/src/features/procurement/` |
| `GET /v1/procurement/stats/` aggregate endpoint | ✅ ships and works |
| A **typed fetch wrapper** to call it from a dashboard card | ❌ missing — ~15 lines |

`frontend/src/features/procurement/api.ts` exports nine functions —
`cancelPurchaseOrder`, `getPOMatchStatus`, `getSupplierScorecard`, `getVendorEligibility`,
`getRetainageReconciliation`, … — and **not one of them calls `/stats/`**.

The OCE authors left a note about exactly this at
[ProcurementPage.tsx:388](frontend/src/features/procurement/ProcurementPage.tsx:388):

> *"Known limit, stated rather than papered over: the list endpoint returns 50 orders by default and
> caps at 100, so on a project past that the totals this panel reduces out of `insightOrders`
> describe a page, not a project. A TruncationNotice next to a wrong number would read as coverage.
> **The real fix is server-side aggregates, and `/v1/procurement/stats/` already computes some of
> them for the reporting page — backend scope, not this wave.**"*

So the Procurement page you saw is charting **the 50 purchase orders it happened to load**, not the
project. The fix the authors deferred is the same ~15 lines. This is the cheapest correctness win
in the whole plan.

---

## 3. The efficient build — one widget, two insertion points

**Do not add five separate widgets.** Five registry entries plus five `widgetNodes` keys is five
upstream merge conflicts per release. Use **one consolidated card with an internal tile grid** —
the exact precedent `operations_snapshot` set when it folded nine former widgets into one.

**Verified mechanics:**

1. One object in `DASHBOARD_WIDGETS` — [widgetRegistry.ts:59](frontend/src/features/dashboard/widgetRegistry.ts:59)
2. One key in `widgetNodes` — [DashboardPage.tsx:2390](frontend/src/features/dashboard/DashboardPage.tsx:2390)
3. Add the id to `WIDGET_NULL_FALLBACK` — [DashboardPage.tsx:140](frontend/src/features/dashboard/DashboardPage.tsx:140)
4. All logic in a **new** `DeliveryModulesCard.tsx` that upstream never touches

`DASHBOARD_WIDGET_IDS` / `BY_ID` derive automatically. **No test enumerates widget ids.** Locale
keys are optional — every entry carries `labelDefault` / `descDefault`, and every `t()` passes a
`defaultValue`. Each upgrade becomes a two-line re-apply, not a merge.

---

## 4. Routes that do NOT work — verified dead ends

| Route | Verdict |
|---|---|
| **Partner pack** | Cannot touch the dashboard. `core/partner_pack/manifest.py` has **no** dashboard/widget/layout field; grepping `apply.py` for "dashboard" returns nothing. A pack does branding, defaults and locale overrides only. |
| **`hidden_modules` to reframe the sidebar** | Dead. [module_loader.py:703](backend/app/core/module_loader.py:703) refuses to disable any `category="core"` module, and **119 of 190 manifests are core**. The categories fall out *backwards*: `coordination_hub`, `procurement`, `progress`, `cde`, `deadlines` are core (unhideable) while `crm`, `contracts`, `variations`, `property_dev` are `business` (hideable). Use `PUT /v1/users/me/sidebar-preferences/` instead. |
| **`bi_dashboards` for Legal/Design KPIs** | Impossible, not merely missing. Its custom-KPI DSL whitelists exactly six entities ([kpi_spec.py:305](backend/app/modules/bi_dashboards/kpi_spec.py:305)): `boq_position`, `boq`, `project`, `boq_markup`, `schedule_activity`, `cost_item_usage` — all cost/schedule. No contracts, design, PO or CRM entity. `saved_views` has the same hole (three entities). |
| **A new OCE module** | Costs 4–8× and still ends at the identical frontend source edit: `frontend/src/modules/_types.ts` `ModuleManifest` exposes only `routes` + `navItems`, with no dashboard-widget slot. |
| **Seeding a default layout for another user** | Both dashboard-layout endpoints are `/me/`-bound; `UserAdminUpdate` ([users/schemas.py:314](backend/app/modules/users/schemas.py:314)) carries only `full_name | role | is_active | locale`. `spans` is localStorage-only and never syncs. |

---

## 5. Traps — each would cost a day

- **Don't source "win rate" from `bid_management` / `tendering` / `rfq_bidding`.** All three model
  subcontractors bidding **into** your packages. A tile labelled "win rate" from these reports the
  opposite of what a reader assumes. Sell-side win rate exists in exactly one place:
  `oe_crm_opportunity` won/lost.
- **Don't promise Construction as "X% · N pts behind plan."** `planned_cumulative_pct` is populated
  **only** by manually upserted plan rows ([progress/service.py:745](backend/app/modules/progress/service.py:745),
  writer at `:768`) and is typed `float | None`. On a stock install every point is `None`. Degrade
  to a bare percentage.
- **Don't build Legal on `payment_clock`'s breach register.** `record_clock_events` has exactly one
  call site — inside `GET /applications/{id}`. A project with real statutory breaches that nobody
  browsed renders a confident **0**.
- **Don't label a CDE tile "drawings at latest revision."** `latest_revisions` counts containers
  with *at least one* revision ([cde/repository.py:127](backend/app/modules/cde/repository.py:127)),
  and ISO 19650 containers are not drawings — a spec, a schedule and a model all land in the same number.
- **Don't pair procurement's `total_committed` against `resource_summary`'s buy-list.**
  `total_committed` sums `PurchaseOrder.amount_total` without reading `currency_code`
  ([repository.py:159](backend/app/modules/procurement/repository.py:159)) while the buy-list is
  FX-normalised. The ratio is meaningless on any multi-currency project — and your portfolio spans
  seven currencies.
- **Name-collision traps.** `cases` = onboarding playbooks (already backs the `cases_learn` widget).
  `compliance` / `compliance_ai` = a YAML DSL for validating **estimate** data, not regulatory
  compliance. `pipelines` = a node-graph automation builder, not a sales pipeline.
  `architecture_map` = OCE's own **software** architecture.
- **Don't verify against `architecture_manifest.json`.** Its own `statistics` block says
  `backend_modules: 125` against 190 on disk. Anyone trusting it silently misses a third of the product.
- **Don't fan out one `useQuery` per tile if you later expand.**
  [dashboard/service.py:50-54](backend/app/modules/dashboard/service.py:50) records that exactly
  this pattern *"used to cause 502 spikes on project-page load"*. Five calls in one card is fine;
  twenty-five across a page is not.

---

## 6. Prior art — recover it, don't redesign it

Your taxonomy already exists, **fully designed and tested**, at git tag **`legacy-nextjs-final`**
(origin commit `e0b05a825`). Read with `git show legacy-nextjs-final:lib/modules.ts`.

**Worth lifting essentially verbatim — roughly a full engineering cycle already paid for,
including three post-review defect fixes you would otherwise re-discover:**

1. **The taxonomy.** Six slugs, `MODULE_ORDER`, bilingual `MODULE_LABELS`
   (Pháp lý / Thiết kế / Cung ứng — Mua hàng / Thi công / Kinh doanh — Tiếp thị / Vận hành) and
   `MODULE_COLORS`. OCE ships a `vi` locale, so the Vietnamese half has a native home.
2. **The five-state machine.** `no-data | not-started | behind | on-track | complete`, where
   `behind` outranks `not-started` (a late module is the louder signal) and `complete` requires
   **both** work and gates finished. Pure functions, zero framework dependency.
3. **The rule that makes or breaks the card: "no records" must never render as 0%.** They are two
   different phone calls. The deleted UI shipped a specific fix for exactly this. OCE's widgets
   self-hide on no data instead — which *hides the finding*.
4. **Work and gates must not be blended** (`partitionByKind`). Blending produced "Avg Progress 6%"
   when the honest figures were work 37/356 = 10% and gates 5/323 = 2%. Worse, the blended number
   moved when a gate was added and no work changed. Also: 306 of 313 undated open rows were gates,
   which are *supposed* to be undated.
5. **The test suite is the spec.** `lib/modules.test.ts`, 23+ invariants: adding a gate must not
   move the percentage; an override of 0 means "auto"; an override never suppresses lateness
   (PM says 100%, a real row is late → show **both** facts, never merge them); overrides clamp
   140→100 and −20→0; portfolio rollups deliberately ignore per-project overrides.
6. **The card layout.** `ModuleCard.tsx` and `ProjectModuleGrid.tsx` compile nearly unchanged —
   OCE is Tailwind 3.4.19 + lucide-react, the same stack. Two adjustments: OCE runs
   `darkMode: 'class'` and its cards carry `dark:` variants these lack, and hardcoded EN/VN strings
   must move behind `t()`.

**Not reusable:** the persistence layer. `tasks.module` has no OCE column. The design doc still live
on HEAD at `docs/superpowers/specs/2026-09-04-oce-platform-swap-design.md` maps it to
`oe_tasks_task.task_type` with module in `metadata_`. One caveat the spec does not raise:
`metadata_` is **JSON, not JSONB**, so `metadata->>'module'` cannot be indexed. Fine for hundreds
of rows, not tens of thousands.

**Status:** Plan 1 shipped (`RCC.md`, `deploy/rcc/*`). **Plans 2 and 3 were never started** — no
`backend/app/modules/rcc_*`, no `frontend/src/modules/rcc-*` on HEAD.

---

## 7. Decisions only you can make

1. **The sixth module.** The prior art has six; you want five. `operation` is load-bearing — it is
   `classifyModule`'s fallback and the CHECK constraint's escape valve, and 100% of the historical
   679 rows sat there. Dropping it means explicitly choosing a new fallback (an `unassigned`
   bucket, or a hard validation error at import). **Do not silently delete it.**
2. **Sales scope.** Workspace-wide CRM tile (honest but jarring beside four project-scoped tiles),
   `property_dev` where the customer does residential development, or drop the tile.
   **An absent tile beats a mislabelled one.**
3. **Marketing.** Rename the area to "Sales", or fund a build. There is nothing to wire.
4. **What "progress" means.** Three numbers will disagree on screen: BOQ physical percent-complete
   (`progress`), task-derived SPI (`bi_dashboards` `spi` has `source_modules=['tasks']`, *not* the
   schedule or progress modules), and the prior art's work/gate completion ratio. **Pick one per
   area and say which**, or you ship two contradictory "progress" figures on one card.
5. **Does the data exist?** Every endpoint above is verified live — that says nothing about *rows*.
   All five sit behind `Depends(RequirePermission(...))`, so you need a JWT before `curl` does
   anything. **Budget an hour, do it first, treat it as a gate.**

---

## 8. Owner / investor portfolio view

**The requirement:** the boss wants every project's progress individually, plus a cross-project
summary of where the blockers are, so he can decide what to unblock.

**The dashboard today is project-by-project** — a top-bar selector picks one project and almost
every widget scopes to it.

### 8.1 The good news: OCE already solved this, and nothing on the dashboard uses it

`GET /v1/dashboard/rollup/` ([dashboard/router.py](backend/app/modules/dashboard/router.py))
takes **optional** `project_ids`:

> *"Comma-separated project UUIDs to scope the rollup. **Omit for all accessible projects.**
> IDs the caller can't access are silently dropped (IDOR-safe)."*

It also takes optional `widgets` and supports `If-None-Match` (ETag-cached).

`KNOWN_WIDGETS` ([service.py:37](backend/app/modules/dashboard/service.py:37)) splits into two groups,
and the comment says so explicitly:

```python
# Wave-2 dashboard widgets (cross-project rollups on /dashboard surface).
"boq_summary", "validation_score", "clash_health", "schedule_critical",
"risk_top", "hse_scorecard", "procurement_pipeline", "budget_variance",
"change_orders", "weather_site",

# Project-detail widgets (W23 P0 — single-project rollups on /projects/:id;
# each scoped to the requested project_id via the same rollup endpoint).
# Replaces the per-widget useQuery fan-out that used to cause 502 spikes.
"project_rfi_inbox", "project_change_orders_pulse", "project_daily_diary",
"project_hse_incidents", "project_variations", "project_quality_ncr",
"project_compliance_summary", "project_budget_burn",
```

**Ten cross-project aggregators already exist and are reachable in one call.**
`compute_rollup(session, projects, widgets)` ([service.py:1595](backend/app/modules/dashboard/service.py:1595))
takes a **list** of projects and dispatches through `_COMPUTE_MAP`.

### 8.2 They already label every row with its project

Verified in two of them:

```python
# compute_risk_top — service.py:611
project_name_by_id = {p.id: p.name for p in projects}
stmt = select(Risk.id, Risk.project_id, Risk.title, Risk.probability,
              Risk.impact_severity, Risk.risk_score, Risk.status
       ).where(Risk.project_id.in_(project_ids))
```

One `IN (...)` query, not a fan-out — and every returned row carries its project. The
`compute_schedule_critical` docstring records why this design exists:

> *"Also returns `total_schedules` so the KpiRibbon's 'Schedule Status' tile can stop fanning out
> `/v1/schedule/schedules/?project_id=…` per project (**v4.6.2 N+1 nuke 2026-05-24**)."*

**So the 13-project fan-out problem is already solved server-side.** The blocker summary is one
HTTP call, not 13 × N.

Failure isolation is built in: a widget whose module is missing is logged, rolled back and dropped
from the response — one absent module cannot break the rest.

### 8.3 What this gives you, and what it does not

| Boss's ask | Status |
|---|---|
| **Cross-project blocker summary, ranked** | ✅ **One call today.** `risk_top` (top-5 by probability × impact, project-labelled), `schedule_critical` (top-5 critical-path activities), `change_orders`, `budget_variance`, `validation_score`, `clash_health`, `hse_scorecard`, `procurement_pipeline`. |
| **All 13 projects listed with value/budget** | ✅ Already rendering — Portfolio Overview, the 13-card Projects strip, Analytics → Project Overview. |
| **Per-project *progress %* for all 13, side by side** | ⚠️ **Not covered.** The cross-project computers return **top-N across the portfolio**, not a complete per-project matrix. `progress` `GET /cumulative/` is single-project. |
| **"Blocked N days, waiting on X"** | ⚠️ **Unverified.** The computers return counts and top-N lists; whether any carries an *age* or *owner* dimension was not confirmed. A bare count does not tell the boss what to act on. |

### 8.4 Recommended shape

An owner view built on `GET /rollup/` with `project_ids` **omitted**:

1. **Blocker board** — one call, `widgets=risk_top,schedule_critical,change_orders,budget_variance,validation_score,clash_health,hse_scorecard,procurement_pipeline`.
   Each item renders as *project name → what is stuck → severity*. This is the decision surface.
2. **Project progress strip** — extend the existing 13-card strip rather than building a new
   widget. It already lists every project; it needs a progress number added.
3. **Fix the money line.** Portfolio Overview currently renders TOTAL BUDGET as a concatenated
   multi-currency string — `AED 21.3M + R$40.9M + CA$195.7M + CN¥687.5M + €86M + ₹339.4M + $38M`.
   For an investor that is unreadable. Normalise to one base currency via the `fx` module.

**Same two insertion points as §3** — this is a second card in the same
`DeliveryModulesCard`-style file, not a second integration.

### 8.5 Reconciling with the five business areas

They are **different audiences and different scopes**, and both are legitimate:

- The **five-area card** (§1, §3) is *project-scoped* — the right shape for a **PM**.
- The **owner view** (§8) is *portfolio-scoped* — the right shape for the **boss**.

Do not try to make one card serve both. Build the owner view first: it is cheaper (one call, no new
backend), it serves the person who signs off, and `procurement_pipeline` / `change_orders` /
`risk_top` already cover three of the five areas at portfolio level for free.

### 8.6 Still unverified — finish before building

The research pass for this section **failed on a session limit** and only §8.1–8.3 were verified by
direct file reads. Outstanding:

- [ ] Does the frontend already call `/rollup/` without `project_ids`? Find the client.
- [ ] Do any computers carry an **age / owner** dimension ("blocked 14 days on the client")?
- [ ] `portfolio` module — programme tree and cross-schedule CPM. If it can say *which project's
      delay blocks another*, that is the highest-value thing in the product for an owner.
- [ ] `project_intelligence` `/score/` `/recommendations/` — is the score real or a placeholder?
      Can it rank 13 projects?
- [ ] Any baseline-vs-actual variance that does **not** need manual plan rows (see §5 —
      `planned_cumulative_pct` is `None` on a stock install).
- [ ] Can an admin seed the boss's dashboard layout, or must he configure it himself?
      (§4 says layout is `/me/`-scoped — likely **no**.)

---

## 9. Afternoon plan — 2026-09-07

Session research limit resets **12:00 Asia/Saigon**. Block 1 needs no AI and can start immediately.

### Block 1 — The data gate (~1 h). Do this first; it can kill or redirect everything else.

Every endpoint in this plan is verified to *exist*. **None is verified to return rows.** All sit
behind `Depends(RequirePermission(...))`, so you need a JWT before `curl` does anything, and
`/health` 404s (`/api/health` is the real path).

```bash
# 1. get a token against the running wheel on :8080
# 2. then, in ONE session, hit each of these and record row counts:
```

| # | Call | Answers |
|---|---|---|
| 1 | `GET /v1/dashboard/rollup/` **with `project_ids` omitted** | **The single most important call.** Does it return all 13 projects' aggregates in one response? What do `risk_top` and `schedule_critical` actually contain? |
| 2 | `GET /v1/procurement/stats/?project_id=<id>` | Does the new client have data to render? |
| 3 | `GET /v1/coordination_hub/projects/<id>/dashboard` | Design tile |
| 4 | `GET /v1/progress/cumulative/?project_id=<id>` | Construction tile — and is `planned_cumulative_pct` `null`? |
| 5 | `GET /v1/contracts/contracts/?project_id=<id>` | Legal tile |
| 6 | `GET /v1/change_intelligence/projects/<id>/notice-register` | Legal tile (the good one) |

**Decision point.** If call 1 returns populated cross-project data → build the owner view first.
If most calls return empty → the demo data does not exercise these modules, and the honest next
step is seeding realistic data, not building cards over zeros.

### Block 2 — Ship the procurement fix (~1 h). Independent of Block 1.

`getProcurementStats()` is written ([procurement/api.ts](frontend/src/features/procurement/api.ts)).
What remains is the consumer:

1. Start the dev server — `cd frontend && VITE_API_TARGET=http://127.0.0.1:8080 npm run dev`
2. In `ProcurementPage.tsx`, replace the Module Insights panel's page-derived totals
   (`insightOrders`, ~line 393) with `getProcurementStats(projectId)`
3. Delete the "describes a page, not a project" caveat at `:388` — it will no longer be true
4. Verify against a project with **more than 50 POs**, or the bug is invisible

This fixes a number that is **currently wrong on screen**, and it is the smallest complete unit of
work available.

### Block 3 — Owner-view spike (~2 h). Gated on Block 1 call 1.

If `/rollup/` returns good cross-project data, build a read-only spike:

- One `useQuery` against `/rollup/` with `project_ids` omitted and
  `widgets=risk_top,schedule_critical,change_orders,budget_variance`
- Render as a flat **blocker board**: *project name → what is stuck → severity*, sorted worst-first
- Do **not** wire it into `widgetRegistry.ts` yet — prove the data first at a throwaway route

**Open question this spike answers:** do any rows carry an **age** or **owner** dimension?
"3 blockers" is not actionable; "blocked 14 days waiting on the client" is. If nothing carries age,
that is a backend gap and needs costing separately.

### Block 4 — After 12:00, re-run the failed research (~background)

The six §8.6 items. Highest value first:

1. `portfolio` module — can its cross-schedule CPM say **which project's delay blocks another**?
   If yes, that is the best thing in the product for an owner.
2. `project_intelligence` `/score/` — real composite or placeholder? Can it rank 13 projects?
3. Any baseline-vs-actual variance that does not need manually entered plan rows.

### Not this afternoon

- **Do not** run `pip install -e backend[server]` (§0.3 — version downgrade against a newer DB).
- **Do not** touch `widgetRegistry.ts` until Block 1 proves the data exists.
- **Do not** start the five-area PM card. The owner view serves the person who signs off, and
  `procurement_pipeline` / `change_orders` / `risk_top` already cover three of the five areas at
  portfolio level for free.

---

## 10. Built 2026-09-07 — all-projects dashboard view

### Shipped

**`AllProjectsOverviewCard`** ([AllProjectsOverviewCard.tsx](frontend/src/features/dashboard/AllProjectsOverviewCard.tsx)),
registered at the three insertion points from §3:

| File | Change |
|---|---|
| `widgetRegistry.ts` | `LayoutGrid` import + `all_projects_overview` as the first entry |
| `DashboardPage.tsx:53` | import |
| `DashboardPage.tsx:142` | added to `WIDGET_NULL_FALLBACK` |
| `DashboardPage.tsx:2393` | `widgetNodes` key |

**`getProcurementStats()`** ([procurement/api.ts](frontend/src/features/procurement/api.ts)) — typed client
for `/v1/procurement/stats/`, with the `POStatus` union and the currency-blindness warning.

**Gates:** `TYPECHECK_EXIT=0` (all four tsc configs, 9216 MB), `ESLINT_EXIT=0`,
**22 dashboard test files / 111 tests pass**.

### Data sources — zero extra HTTP calls

`DashboardPage` mounts `DashboardRollupProvider` with **no `projectIds`**, so the shared
`GET /v1/dashboard/rollup/` already carries every accessible project. The card reads that payload
through `useDashboardRollupContext()`.

| Block | Rollup widget | Shows |
|---|---|---|
| Legal | `change_orders` | open count + impact **split by currency** |
| Design | `clash_health` | open · high · % resolved |
| Procurement & Purchasing | `procurement_pipeline` | POs issued · RFQs pending · received |
| Construction | `schedule_critical` + `risk_top` | schedules · critical activities · top risks |
| Sales & Marketing | *none* | honest "not connected" state |

Per-project bars come from `boq_summary.by_project` (the only complete per-project series in the
rollup), enriched by id from `clash_health.by_project`, `validation_score.by_project` and
`budget_variance.top_over`.

### Two deliberate decisions

1. **The bar reads "Estimate readiness", not "Progress".** `progress` has no batch endpoint —
   only `/cumulative/?project_id=` — so real percent-complete for 13 projects is 13 calls, the
   exact N+1 the codebase already removed. The bar is priced BOQ positions and the header says so.
   **True physical progress needs a backend batch endpoint.**
2. **Sales & Marketing renders empty on purpose.** No marketing module exists and `crm`'s
   dashboard takes no `project_id`. A tenant-wide number beside portfolio-scoped ones would read
   as a bug the first time totals failed to reconcile.

### CORRECTION to §9 Block 2 — the procurement fix is bigger than costed

§9 Block 2 said "~1 h: swap the Module Insights panel to the new client." **That is wrong.**

`buildProcurementInsights` ([procurementInsights.ts:108](frontend/src/features/procurement/procurementInsights.ts:108))
builds a **row-level pivot dataset** — per-order `number`, `supplier`, `status`, `month`, `value`,
`open`, `received`. `/v1/procurement/stats/` returns five scalars with **no supplier or month
dimension**, so it cannot reproduce the pivot. The two are not interchangeable.

Revised options:

- **(a) ~1 h, safe.** Add a stats-backed header strip above the pivot carrying the *true* project
  totals, and relabel the pivot as "first 50 orders". Fixes the wrong headline number without
  touching the charts.
- **(b) backend work.** Extend `/stats/` with supplier and month breakdowns, then retire the
  page-derived pivot entirely.

**Not started — needs a decision.**

### Open

- The §9 Block 1 **data gate has not run.** Every bound field is typed and real; whether rows exist
  is unknown. Thin data renders "No records yet" — the card working correctly, not failing.
- To view: `cd frontend && VITE_API_TARGET=http://127.0.0.1:8080 npm run dev` → localhost:5173.
  It will **not** appear on `:8080`, which still serves the wheel's bundle.
- **Design question:** the five modules are blocks *inside* one card (one registry entry, two
  upstream insertion points). Five *separate* dashboard widgets would be five entries and five
  merge conflicts per upstream release. Say the word and they can be split.
