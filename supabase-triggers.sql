-- RCC PM Dashboard — schema v1.2
-- Adds: trigger to auto-compute project.progress_pct from tasks

-- Function: recompute project progress as avg of its tasks' progress_pct
-- Trigger functions take NO arguments — NEW/OLD are special row variables
create or replace function recompute_project_progress()
returns trigger
language plpgsql
security definer
as $$
declare
  avg_pct numeric;
  pid uuid;
begin
  pid := coalesce(NEW.project_id, OLD.project_id);
  if pid is null then
    return coalesce(NEW, OLD);
  end if;
  select coalesce(avg(progress_pct), 0) into avg_pct
  from tasks
  where project_id = pid;

  update projects
  set progress_pct = round(avg_pct, 0)
  where id = pid and progress_pct <> round(avg_pct, 0);

  return coalesce(NEW, OLD);
end;
$$;

-- Trigger: fire on task insert/update/delete
drop trigger if exists trg_recompute_progress_ins on tasks;
drop trigger if exists trg_recompute_progress_upd on tasks;
drop trigger if exists trg_recompute_progress_del on tasks;

create trigger trg_recompute_progress_ins
  after insert on tasks
  for each row execute function recompute_project_progress();

create trigger trg_recompute_progress_upd
  after update of progress_pct, project_id on tasks
  for each row execute function recompute_project_progress();

create trigger trg_recompute_progress_del
  after delete on tasks
  for each row execute function recompute_project_progress();

-- Backfill current projects
update projects p
set progress_pct = sub.avg_pct
from (
  select project_id, coalesce(avg(progress_pct), 0) as avg_pct
  from tasks
  group by project_id
) sub
where p.id = sub.project_id and p.progress_pct <> sub.avg_pct;