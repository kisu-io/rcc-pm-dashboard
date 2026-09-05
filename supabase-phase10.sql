-- RCC PM Dashboard — schema v1.11: record which module a task belongs to
--
-- WHY
-- The 2026-09-04 review settled the programme's top-level structure: six
-- delivery modules, each a separate team with its own workbook —
--
--   legal · design · procurement · construction · sales · operation
--
-- Nothing in the schema recorded that. The app inferred five *phase* buckets
-- from free text in tasks.phase (lib/phase.ts::classifyPhase), and against the
-- live data that inference was wrong at scale: it routed 629 of the 679 rows
-- into "Thi công" — because its fallback branch was Construction and the
-- programme's phase values are hotel departments (Engineering, Culinary,
-- Housekeeping, Security …) — while Design and Sales showed 0% permanently.
--
-- The fix is to stop guessing. tasks.module states the answer.
--
-- BACKFILL
-- Every row currently in the database is the Operation team's pre-opening
-- checklist, so all 679 backfill to 'operation'. Construction, Legal, Design,
-- Procurement and Sales get their own views once those teams load their data.
--
-- tasks.phase keeps its existing meaning — the department *inside* a module —
-- and still drives the department ledger on each project page.
--
-- The application does not require this column: lib/modules.ts::classifyModule
-- falls back to 'operation', so the app and this migration deploy in either
-- order. Same arrangement as task_kind in supabase-phase8.sql.
--
-- Idempotent: safe to re-run. Applied to production 2026-09-04:
--   tasks.module   text not null default 'operation'  — 679 rows backfilled
--   projects.pct_operation numeric(5,2) default 0

-- ------------------------------------------------------------- tasks.module
alter table tasks add column if not exists module text;

update tasks set module = 'operation' where module is null;

alter table tasks alter column module set default 'operation';
alter table tasks alter column module set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_module_check'
  ) then
    alter table tasks
      add constraint tasks_module_check
      check (module in ('legal', 'design', 'procurement', 'construction', 'sales', 'operation'));
  end if;
end $$;

create index if not exists tasks_module_idx on tasks (module);

comment on column tasks.module is
  'Delivery module this task belongs to — the owning team. One of legal, design, procurement, construction, sales, operation. Distinct from tasks.phase, which is the department inside the module.';

-- --------------------------------------------------- projects.pct_operation
-- The other five override columns already exist (supabase-phase6.sql). The
-- sixth module needs the same escape hatch: a PM sets it above zero to
-- override the derived Done/total figure, and 0 means "auto".
alter table projects
  add column if not exists pct_operation numeric(5,2) default 0;

comment on column projects.pct_operation is
  'Vận hành % (0..100). NULL/0 = derive from tasks where module = operation.';

-- ---------------------------------------------------------------- verify
-- Expected on the Chateau De Saigon programme: a single row, operation / 679.
--
--   select module, count(*) from tasks group by module order by 2 desc;
--
-- To lift a workstream out of Operation into its own module later, e.g.:
--
--   update tasks set module = 'legal' where phase = 'Legal';
