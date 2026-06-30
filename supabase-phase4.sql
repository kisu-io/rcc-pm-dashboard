-- RCC PM Dashboard — schema v1.4
-- Adds: task dependencies + material tracking

-- tasks: add depends_on (array of task ids) + lead_time_days
alter table tasks add column if not exists depends_on uuid[] default '{}';
alter table tasks add column if not exists lead_time_days int;

-- New table: materials
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  name text not null,
  category text,
  supplier text,
  quantity numeric,
  unit text,
  lead_time_days int,
  order_date date,
  expected_delivery date,
  actual_delivery date,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table materials enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='materials' and policyname='read all') then
    create policy "read all" on materials for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='materials' and policyname='write all') then
    create policy "write all" on materials for all using (true) with check (true);
  end if;
end$$;

create index if not exists idx_materials_project on materials(project_id);
create index if not exists idx_materials_task on materials(task_id);

-- Seed sample materials for Le Meridien
do $$
declare
  p_meridian uuid;
begin
  select id into p_meridian from projects where name = 'Le Meridien Fit-out' limit 1;
  if p_meridian is not null and not exists (select 1 from materials where project_id = p_meridian) then
    insert into materials (project_id, name, category, supplier, quantity, unit, lead_time_days, order_date, expected_delivery, status, notes) values
      (p_meridian, 'Ống đồng MEP', 'MEP', 'Vietnam Copper', 500, 'm', 14, '2026-06-15', '2026-06-29', 'Delivered', 'Đã nhận đủ'),
      (p_meridian, 'Drywall boards', 'Finishing', 'Gyptec', 1200, 'tấm', 7, '2026-06-25', '2026-07-02', 'Pending', 'Chờ giao'),
      (p_meridian, 'LED lighting', 'Electrical', 'Philips VN', 300, 'bộ', 21, '2026-07-01', '2026-07-22', 'Pending', 'Lead time 3 tuần'),
      (p_meridian, 'Paint premium', 'Finishing', 'Jotun', 400, 'lít', 5, '2026-07-10', '2026-07-15', 'Pending', null);
  end if;
end$$;