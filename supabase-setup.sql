-- RCC PM Dashboard — schema v1.1
-- Adds: documents table, milestones seed, tasks seed, projects seed
-- Idempotent: re-runnable without duplicating

-- ===== TABLES =====
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  status text default 'Not Started',
  progress_pct numeric default 0,
  budget numeric,
  spent numeric default 0,
  start_date date,
  target_end date,
  pm text,
  cover_url text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  phase text,
  zone text,
  owner text,
  priority text default 'Medium',
  kanban_status text default 'To Do',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  progress_pct numeric default 0,
  due_date date,
  constraint_note text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  due_date date,
  status text default 'Pending',
  type text,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  name text not null,
  bucket text not null default 'documents',
  path text not null,
  uploaded_by text,
  created_at timestamptz default now()
);

-- ===== RLS =====
alter table projects enable row level security;
alter table tasks enable row level security;
alter table milestones enable row level security;
alter table documents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='projects' and policyname='read all') then
    create policy "read all" on projects for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tasks' and policyname='read all') then
    create policy "read all" on tasks for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='milestones' and policyname='read all') then
    create policy "read all" on milestones for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='read all') then
    create policy "read all" on documents for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='projects' and policyname='write all') then
    create policy "write all" on projects for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tasks' and policyname='write all') then
    create policy "write all" on tasks for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='milestones' and policyname='write all') then
    create policy "write all" on milestones for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='write all') then
    create policy "write all" on documents for all using (true) with check (true);
  end if;
end$$;

-- ===== SEED: additional projects (if table empty-ish) =====
insert into projects (name, location, status, progress_pct, budget, spent, start_date, target_end, pm)
select 'Riverbank Place Office', 'HCMC', 'On Hold', 60, 3000000000, 1800000000, '2026-03-01', '2026-09-30', 'Mr Phán'
where not exists (select 1 from projects where name = 'Riverbank Place Office');

insert into projects (name, location, status, progress_pct, budget, spent, start_date, target_end, pm)
select 'Barson Lounge', 'Hanoi', 'Complete', 100, 1200000000, 1100000000, '2026-01-01', '2026-05-15', 'Mr Phán'
where not exists (select 1 from projects where name = 'Barson Lounge');

insert into projects (name, location, status, progress_pct, budget, spent, start_date, target_end, pm)
select 'AKUNA Beach Club', 'Da Nang', 'Not Started', 0, 8000000000, 0, '2026-08-01', '2027-03-31', 'Mr Phán'
where not exists (select 1 from projects where name = 'AKUNA Beach Club');

-- ===== SEED: tasks (if empty) =====
do $$
declare
  p_meridian uuid;
  p_riverbank uuid;
begin
  select id into p_meridian from projects where name = 'Le Meridien Fit-out' limit 1;
  select id into p_riverbank from projects where name = 'Riverbank Place Office' limit 1;

  if not exists (select 1 from tasks where project_id = p_meridian) then
    insert into tasks (project_id, title, phase, zone, owner, priority, kanban_status, planned_start, planned_end, actual_start, actual_end, progress_pct, due_date, constraint_note)
    values
      (p_meridian, 'Demo & dọn mặt bằng', 'Construction', 'Lobby', 'Đội A', 'High', 'Done', '2026-06-01', '2026-06-10', '2026-06-01', '2026-06-09', 100, '2026-06-10', null),
      (p_meridian, 'MEP rough-in', 'Construction', 'Floor 2', 'Đội B', 'High', 'In Progress', '2026-06-11', '2026-07-05', '2026-06-12', null, 45, '2026-07-05', 'Chờ vật tư ống đồng'),
      (p_meridian, 'Drywall partition', 'Construction', 'Floor 2', 'Đội C', 'Medium', 'To Do', '2026-07-06', '2026-07-20', null, null, 0, '2026-07-20', null),
      (p_meridian, 'Nghiệm thu PCCC', 'Inspection', 'All', 'QA', 'High', 'Review', '2026-06-20', '2026-06-28', '2026-06-21', null, 80, '2026-06-28', 'Chờ lịch cơ quan PCCC');
  end if;

  if p_riverbank is not null and not exists (select 1 from tasks where project_id = p_riverbank) then
    insert into tasks (project_id, title, phase, zone, owner, priority, kanban_status, planned_start, planned_end, actual_start, actual_end, progress_pct, due_date, constraint_note)
    values
      (p_riverbank, 'Glass facade install', 'Construction', 'Facade', 'Đội D', 'High', 'In Progress', '2026-06-15', '2026-07-30', '2026-06-16', null, 30, '2026-07-30', null),
      (p_riverbank, 'HVAC commissioning', 'Fit-out', 'Roof', 'Đội MEP', 'Medium', 'To Do', '2026-08-01', '2026-08-20', null, null, 0, '2026-08-20', null);
  end if;
end$$;

-- ===== SEED: milestones =====
do $$
declare
  p_meridian uuid;
  p_riverbank uuid;
begin
  select id into p_meridian from projects where name = 'Le Meridien Fit-out' limit 1;
  select id into p_riverbank from projects where name = 'Riverbank Place Office' limit 1;

  if p_meridian is not null and not exists (select 1 from milestones where project_id = p_meridian) then
    insert into milestones (project_id, name, due_date, status, type) values
      (p_meridian, 'Design sign-off', '2026-05-15', 'Reached', 'Permit'),
      (p_meridian, 'PCCC acceptance', '2026-06-28', 'Pending', 'Inspection'),
      (p_meridian, 'Handover to client', '2026-12-20', 'Pending', 'Handover');
  end if;

  if p_riverbank is not null and not exists (select 1 from milestones where project_id = p_riverbank) then
    insert into milestones (project_id, name, due_date, status, type) values
      (p_riverbank, 'Facade complete', '2026-07-30', 'Pending', 'Inspection'),
      (p_riverbank, 'Final handover', '2026-09-30', 'Pending', 'Handover');
  end if;
end$$;

-- ===== STORAGE POLICIES (public read for all 3 buckets) =====
do $$
declare
  b text;
begin
  foreach b in array array['documents','site-photos','reports'] loop
    if not exists (select 1 from storage.buckets where id = b) then
      insert into storage.buckets (id, name, public) values (b, b, true) on conflict do nothing;
    else
      update storage.buckets set public = true where id = b;
    end if;
  end loop;
end$$;

-- Public read for buckets
drop policy if exists "Public read" on storage.objects;
create policy "Public read"
  on storage.objects for select
  using (bucket_id in ('documents','site-photos','reports'));

-- Public write (phase 1 — internal tool)
drop policy if exists "Public write" on storage.objects;
create policy "Public write"
  on storage.objects for insert
  with check (bucket_id in ('documents','site-photos','reports'));

-- Public delete (internal)
drop policy if exists "Public delete" on storage.objects;
create policy "Public delete"
  on storage.objects for delete
  using (bucket_id in ('documents','site-photos','reports'));