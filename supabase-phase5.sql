-- RCC PM Dashboard — schema v1.6 (Phase 5a: cost_entries)
-- Adds: cost_entries table for line-item project costs.
-- `projects.spent` becomes a computed roll-up of cost_entries (kept in sync via trigger).
-- Idempotent: re-runnable.

-- ===== cost_entries =====
create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  date date not null default current_date,
  category text,
  vendor text,
  description text not null,
  amount numeric not null check (amount >= 0),
  invoice_ref text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_entries_project on public.cost_entries(project_id);
create index if not exists idx_cost_entries_date on public.cost_entries(date);

-- RLS: read = authenticated, write = PM/admin
alter table public.cost_entries enable row level security;

drop policy if exists "auth read" on public.cost_entries;
create policy "auth read" on public.cost_entries
  for select using (auth.uid() is not null);

drop policy if exists "pm write" on public.cost_entries;
create policy "pm write" on public.cost_entries
  for all using (public.is_pm()) with check (public.is_pm());

-- ===== Sync projects.spent from cost_entries roll-up =====
-- On any insert/update/delete on cost_entries, recompute the affected project's spent.
create or replace function public.recompute_project_spent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_project uuid;
begin
  affected_project := coalesce(new.project_id, old.project_id);
  if affected_project is not null then
    update public.projects
      set spent = coalesce((
        select sum(amount) from public.cost_entries where project_id = affected_project
      ), 0)
      where id = affected_project;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_cost_entries_spent on public.cost_entries;
create trigger trg_cost_entries_spent
  after insert or update or delete on public.cost_entries
  for each row execute function public.recompute_project_spent();

-- ===== Backfill existing projects' spent from any pre-seeded values =====
-- (No-op if cost_entries is empty — leaves spent as-is because the trigger only fires on writes.)
-- To force a full recompute, run: update public.projects set spent = 0; then re-insert cost entries.

-- ===== Phase 5b: admin users RPC =====
-- List all auth users with their role. Security definer — but gate by admin check inside.
-- Returns: user_id, email, created_at, role

create or replace function public.list_users_with_roles()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins may call this (alias ur to avoid column ambiguity)
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select
      u.id as user_id,
      u.email as email,
      u.created_at as created_at,
      coalesce(r.role, 'viewer') as role
    from auth.users u
    left join public.user_roles r on r.user_id = u.id
    order by u.created_at;
end;
$$;

-- Grant execute to authenticated users (the function itself enforces admin)
grant execute on function public.list_users_with_roles() to authenticated;

-- ===== Phase 5c: activity_log =====
-- Append-only audit log. RLS: read = authenticated, insert = trigger only (no direct user insert).
-- Writes logged for: projects, tasks, milestones, documents, materials, cost_entries, user_roles.

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  actor uuid,                         -- auth.uid() of the writer (null if anon/bypass)
  action text not null,               -- 'insert' | 'update' | 'delete'
  table_name text not null,
  row_id uuid,                        -- pk of affected row (null for bulk)
  before jsonb,                       -- old row (update/delete)
  after jsonb                         -- new row (insert/update)
);

create index if not exists idx_activity_log_ts on public.activity_log(ts desc);
create index if not exists idx_activity_log_actor on public.activity_log(actor);
create index if not exists idx_activity_log_table on public.activity_log(table_name);

alter table public.activity_log enable row level security;

drop policy if exists "auth read" on public.activity_log;
create policy "auth read" on public.activity_log
  for select using (auth.uid() is not null);

-- No INSERT/UPDATE/DELETE policy → only the SECURITY DEFINER trigger function can write.

-- Generic logger function — called by per-table triggers.
create or replace function public.log_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (actor, action, table_name, row_id, before, after)
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then old.id else new.id end), null),
    (case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end),
    (case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end)
  );
  return coalesce(new, old);
end;
$$;

-- Attach to every writable table
drop trigger if exists trg_log_projects on public.projects;
create trigger trg_log_projects
  after insert or update or delete on public.projects
  for each row execute function public.log_write();

drop trigger if exists trg_log_tasks on public.tasks;
create trigger trg_log_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.log_write();

drop trigger if exists trg_log_milestones on public.milestones;
create trigger trg_log_milestones
  after insert or update or delete on public.milestones
  for each row execute function public.log_write();

drop trigger if exists trg_log_documents on public.documents;
create trigger trg_log_documents
  after insert or update or delete on public.documents
  for each row execute function public.log_write();

drop trigger if exists trg_log_materials on public.materials;
create trigger trg_log_materials
  after insert or update or delete on public.materials
  for each row execute function public.log_write();

drop trigger if exists trg_log_cost_entries on public.cost_entries;
create trigger trg_log_cost_entries
  after insert or update or delete on public.cost_entries
  for each row execute function public.log_write();

drop trigger if exists trg_log_user_roles on public.user_roles;
create trigger trg_log_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function public.log_write();