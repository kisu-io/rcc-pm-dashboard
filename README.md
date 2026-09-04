# RCC PM Dashboard

Construction Project Management dashboard (style: Structura) cho Mr Phán — PM của RCC.

## Stack
- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase (Postgres + Storage drive-type + Auth + Realtime)
- dnd-kit (Kanban drag-drop)
- Zera bot: cron 6-week look-ahead → Telegram group

## Setup
1. **DB**: chạy `supabase-setup.sql` trong Supabase SQL Editor + tạo 3 buckets (documents, site-photos, reports)
2. **Deploy**: push lên GitHub → import vào Vercel
3. **Env (Vercel → Settings → Environment Variables)**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://eyxqbpcgrunksmirsiia.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Tick **Production, Preview _and_ Development** for both. `middleware.ts`
   asserts them non-null, so an environment missing either one fails every
   request with `MIDDLEWARE_INVOCATION_FAILED` and the whole deployment
   returns 500. Previews were broken this way for months while the "Vercel ✓"
   check on each PR stayed green — that check only proves the build compiled,
   not that the app runs.

   Set **Type: Config**, not Secret. `NEXT_PUBLIC_*` values are inlined into
   the browser bundle at build time, so "Secret" hides the value from you in
   the Vercel UI and from nobody else. That is fine for the `anon` key, which
   is public by design — RLS is what protects the data. Never put
   `service_role` behind a `NEXT_PUBLIC_` prefix: it bypasses RLS entirely.
4. `npm install && npm run dev` (local) hoặc Vercel auto-build

## Features
- **Opening Readiness** (`/`): gates signed off, days to opening, a department
  ledger sorted worst-first, the departments never mobilised, committed work
  for the fortnight, the unscheduled queue and blockers. With more than one
  project it becomes a portfolio roll-up, one row per programme.
- **Tasks & Gates**: the two record kinds `tasks` holds get the view that suits
  them — a Kanban for schedulable work, a checklist for readiness gates
  (acceptance criteria, normally undated and unowned). See `lib/task-kind.ts`.
- **Schedule** (`/gantt`): a Gantt when tasks carry `planned_start`, otherwise a
  department × month grid, which is the shape this data actually has.
- Budget and Materials stay out of the nav until they have rows behind them.
- Demo data fallback khi chưa có Supabase key (`NEXT_PUBLIC_E2E_BYPASS_AUTH=1`,
  ignored in production builds — see `lib/env.ts`).

## Cron (Zera)
- Daily Brief 08:00 VN
- 6-Week Look-ahead Thứ 2 08:30 VN
- Overdue Alert 17:00 VN
- Weekly Report Thứ 6 16:00 VN
→ gửi group Project Management X Zera
