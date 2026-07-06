# RCC PM Dashboard — Roadmap

**Scope:** Internal construction PM tool for Mr Phán ([[rcc]] — Royal Canary Corporation) plus a handful of viewers.
**Guiding decisions (2026-07-06):**
- **Single-PM tool** — Mr Phán edits, a few viewers read. No multi-team / client portal for now.
- **Bilingual VN/EN** kept as-is — no formal i18n system.
- **Hardening first** — finish and secure what exists before adding breadth.

Live: <https://rcc-pm-dashboard.vercel.app> · Repo: `kisu-io/rcc-pm-dashboard` · Stack: Next.js 14 + Supabase + Vercel.

---

## Current state (audit — 2026-07-06)

Solid, deployed skeleton with a real product core, but **write paths are demo-grade**:

- Reads are cookie-aware SSR with demo-data fallback (`lib/data-server.ts`) — good.
- **Materials** page has no add/edit UI (tells the user to "add via Supabase").
- **Budget** is portfolio roll-up only — no cost line items; `spent` is a hand-typed column.
- **Team** is derived from task owners — no team table, no contacts.
- **No admin surface** — roles (`pm`/`viewer`/`admin`) are assigned by hand-editing Supabase.
- **"Zera" Telegram bot is not in this repo** — no `app/api/`, no `vercel.json`, no cron here.
- **Zero tests**, no CI. Errors are swallowed (`console.error → return []`). Everything is `force-dynamic`; Supabase Realtime unused.

---

## Phase 5 — Real & safe *(priority)*

**5a. Close CRUD gaps**
- [ ] Materials add/edit/delete UI
- [ ] Budget cost-entry line items (`cost_entries` table → computed `spent` roll-up)
- [ ] Milestone edit/delete

**5b. Admin/Users page (lightweight)**
- [ ] `/admin/users` (admin-only): list users, promote/demote role, magic-link invite

**5c. Security + audit**
- [ ] `security-reviewer` pass over all RLS policies + triggers
- [ ] `activity_log` table (who changed what, when)
- [ ] Confirm no secrets in public repo history

**5d. Tests + CI baseline**
- [ ] Vitest unit tests on `lib/data.ts` helpers (SPI, overdue, look-ahead, formatVND)
- [ ] Playwright E2E golden path: login → create project → add task → drag Kanban → upload doc
- [ ] GitHub Actions: lint + typecheck + test on PR

## Phase 6 — Field-first features
- [ ] Daily site log (date, weather, crew count, note, photo → existing `site-photos` bucket)
- [ ] Punch/snag list + basic RFI tracking
- [ ] PWA: installable, camera capture, phone-usable on-site

## Phase 7 — Notifications & reporting (formalize "Zera")
- [ ] Bring cron into repo: `app/api/cron/*` + `vercel.json` (daily brief, look-ahead, overdue, weekly) → Telegram
- [ ] PDF/Excel export of weekly + per-project status
- [ ] In-app notification center backed by `activity_log`

## Phase 8 — Performance & robustness
- [ ] Supabase Realtime for live Kanban/dashboard; tagged caching + `revalidateTag`
- [ ] Error boundaries + real logger (stop silent swallowing)
- [ ] Sentry-style capture

*(Phase 9 multi-tenant / client portal — deferred; out of single-PM scope.)*

## Quick wins (do inside Phase 5)
- [ ] Enforce `next lint` in CI
- [ ] Remove dead `Mail`/`Phone` imports in `team/page.tsx` (or wire contacts)
- [ ] `.env.example` ↔ Vercel env parity check
