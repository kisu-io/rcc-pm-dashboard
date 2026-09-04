-- RCC PM Dashboard — schema v1.9: name the two things `tasks` already contains
--
-- WHY
-- The tasks table holds two structurally different kinds of record, and nothing
-- in the schema said so:
--
--   * work items   — an action someone owns and schedules.
--                    zone is a workbook/department heading ('ENGINEERING',
--                    'EXECUTIVE HOUSEKEEPER', 'OS&E', 'Final 60 days').
--                    98% carry a due_date, 99% carry an owner.
--
--   * readiness gates — an acceptance criterion for opening. Titles are
--                    end-states ('Security Systems Ready', 'Engineering
--                    Sign-off Completed'), zone is a numbered checklist
--                    heading ('8. Team Readiness') or null.
--                    5% carry a date, 0% carry an owner.
--
-- Counting them as one population is what made the dashboard report
-- "Schedule Health 100%" next to "Avg Progress 6%": completion ratios were
-- dividing across two incompatible sets, and 306 undated acceptance criteria
-- were being rendered as overdue tasks.
--
-- Separately, due_date is not a deadline — it is a month bucket. Across 366
-- dated rows there are only 30 distinct values and 319 of them fall on the
-- 1st or the 15th; 2026-08-01 alone carries 106 tasks. due_month records that
-- honestly so the UI can stop implying day precision the data never had.
--
-- The application does not require either column: lib/task-kind.ts prefers
-- task_kind when present and falls back to inferring from zone, so this
-- migration and the app deploy in either order.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- task_kind
alter table tasks add column if not exists task_kind text;

-- Backfill from the zone pattern. A numbered heading ('4. Fire, Life Safety')
-- or a null zone is a readiness gate; anything else is schedulable work.
update tasks
   set task_kind = case
         when zone is null then 'gate'
         when zone ~ '^[0-9]+\.' then 'gate'
         else 'work'
       end
 where task_kind is null;

alter table tasks alter column task_kind set default 'work';
alter table tasks alter column task_kind set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_task_kind_check'
  ) then
    alter table tasks
      add constraint tasks_task_kind_check
      check (task_kind in ('work', 'gate'));
  end if;
end $$;

create index if not exists tasks_task_kind_idx on tasks (task_kind);

comment on column tasks.task_kind is
  'work = a scheduled, owned action. gate = an opening-readiness acceptance criterion (normally undated and unowned).';

-- ---------------------------------------------------------------- due_month
-- Stored as the first of the month so it sorts and compares as a date.
alter table tasks add column if not exists due_month date;

update tasks
   set due_month = date_trunc('month', due_date)::date
 where due_date is not null
   and due_month is null;

create index if not exists tasks_due_month_idx on tasks (due_month);

comment on column tasks.due_month is
  'Month bucket the row was planned into, first-of-month. due_date carries no day precision: 319 of 366 dated rows land on the 1st or 15th.';

-- ---------------------------------------------------------------- keep in sync
-- New and edited rows get due_month derived from due_date automatically, so the
-- two can never drift. task_kind is left to the application/import to set.
create or replace function sync_task_due_month()
returns trigger
language plpgsql
as $$
begin
  new.due_month := case
    when new.due_date is null then null
    else date_trunc('month', new.due_date)::date
  end;
  return new;
end $$;

drop trigger if exists trg_sync_task_due_month on tasks;
create trigger trg_sync_task_due_month
  before insert or update of due_date on tasks
  for each row execute function sync_task_due_month();

-- ---------------------------------------------------------------- verify
-- Expected on the Chateau De Saigon programme: 356 work / 323 gate,
-- and 366 rows with a due_month across 9 distinct months.
--
--   select task_kind, count(*) from tasks group by task_kind;
--   select count(due_month), count(distinct due_month) from tasks;
