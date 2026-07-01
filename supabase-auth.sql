-- RCC PM Dashboard — schema v1.5 (Phase 3: Auth + Roles + RLS tightening)
--
-- Strategy:
--   - Add user_roles table (auth.uid → role)
--   - Tighten RLS: read = auth.uid present (any logged-in user)
--                  write = role = 'pm' (only PMs can mutate)
--   - viewer role = read-only
--
-- NOTE: Must enable Supabase Auth (email/magic link) in dashboard first.
-- Until users sign in, anon access is BLOCKED. Run this migration ONLY
-- when ready to enforce auth.

-- ===== user_roles =====
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('pm', 'viewer', 'admin')),
  display_name text,
  created_at timestamptz default now()
);

alter table public.user_roles enable row level security;

-- Anyone logged in can see who has which role
drop policy if exists "read roles" on public.user_roles;
create policy "read roles"
  on public.user_roles for select
  using (auth.uid() is not null);

-- Users can read their own role
-- (covered by "read roles" above — auth.uid() is not null)

-- Only admin or self can insert/update roles (bootstrap via service_role)
drop policy if exists "insert own role" on public.user_roles;
create policy "insert own role"
  on public.user_roles for insert
  with check (auth.uid() = user_id or auth.uid() in (select user_id from public.user_roles where role = 'admin'));

drop policy if exists "update own role" on public.user_roles;
create policy "update own role"
  on public.user_roles for update
  using (auth.uid() in (select user_id from public.user_roles where role = 'admin'));

-- Helper function: current user's role
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'anonymous'
  );
$$;

-- Helper: is current user a PM (or admin)?
create or replace function public.is_pm()
returns boolean
language sql
security definer
stable
as $$
  select public.current_user_role() in ('pm', 'admin');
$$;

-- ===== Tighten RLS on existing tables =====

-- DROP old permissive policies
drop policy if exists "read all" on public.projects;
drop policy if exists "write all" on public.projects;
drop policy if exists "read all" on public.tasks;
drop policy if exists "write all" on public.tasks;
drop policy if exists "read all" on public.milestones;
drop policy if exists "write all" on public.milestones;
drop policy if exists "read all" on public.documents;
drop policy if exists "write all" on public.documents;
drop policy if exists "read all" on public.materials;
drop policy if exists "write all" on public.materials;

-- ===== New policies: read = authenticated, write = PM/admin =====

-- PROJECTS
create policy "auth read" on public.projects
  for select using (auth.uid() is not null);
create policy "pm write" on public.projects
  for all using (public.is_pm()) with check (public.is_pm());

-- TASKS
create policy "auth read" on public.tasks
  for select using (auth.uid() is not null);
create policy "pm write" on public.tasks
  for all using (public.is_pm()) with check (public.is_pm());

-- MILESTONES
create policy "auth read" on public.milestones
  for select using (auth.uid() is not null);
create policy "pm write" on public.milestones
  for all using (public.is_pm()) with check (public.is_pm());

-- DOCUMENTS
create policy "auth read" on public.documents
  for select using (auth.uid() is not null);
create policy "pm write" on public.documents
  for all using (public.is_pm()) with check (public.is_pm());

-- MATERIALS
create policy "auth read" on public.materials
  for select using (auth.uid() is not null);
create policy "pm write" on public.materials
  for all using (public.is_pm()) with check (public.is_pm());

-- ===== Storage policies tightening =====
-- Replace public read/write with auth-required

drop policy if exists "Public read" on storage.objects;
drop policy if exists "Public write" on storage.objects;
drop policy if exists "Public delete" on storage.objects;

-- Authenticated read
create policy "auth read storage"
  on storage.objects for select
  using (
    bucket_id in ('documents','site-photos','reports')
    and auth.uid() is not null
  );

-- PM/admin write
create policy "pm write storage"
  on storage.objects for insert
  with check (
    bucket_id in ('documents','site-photos','reports')
    and public.is_pm()
  );

-- PM/admin delete
create policy "pm delete storage"
  on storage.objects for delete
  using (
    bucket_id in ('documents','site-photos','reports')
    and public.is_pm()
  );

-- PM/admin update (for move/rename)
create policy "pm update storage"
  on storage.objects for update
  using (
    bucket_id in ('documents','site-photos','reports')
    and public.is_pm()
  );

-- ===== Auto-create role row on signup =====
-- Trigger: when new auth.user created, insert user_roles row as 'viewer'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_roles (user_id, role, display_name)
  values (new.id, 'viewer', coalesce(new.email, 'new user'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();