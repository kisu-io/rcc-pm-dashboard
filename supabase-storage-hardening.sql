-- RCC PM Dashboard — storage hardening
--
-- Closes the hole where the three document buckets were public with anon
-- read/write/delete policies: anyone who opened the deployed site could read the
-- publishable key out of the JS bundle, enumerate every object and delete it.
--
-- Requires public.is_pm() from supabase-auth.sql. Idempotent — safe to re-run.
--
-- ORDER OF OPERATIONS: deploy the application first. This script makes every
-- object private, and only a build that mints signed URLs (lib/storage.ts) can
-- still display documents afterwards.

-- 1. Buckets are private; objects are reachable only via a signed URL.
do $$
declare
  b text;
begin
  foreach b in array array['documents','site-photos','reports'] loop
    insert into storage.buckets (id, name, public) values (b, b, false)
      on conflict (id) do update set public = false;
  end loop;
end$$;

-- 2. Drop the anon-era policies.
drop policy if exists "Public read" on storage.objects;
drop policy if exists "Public write" on storage.objects;
drop policy if exists "Public delete" on storage.objects;

-- 3. Reads require a session; writes and deletes require PM or admin — matching
--    the "auth read" / "pm write" split already used on the data tables.
drop policy if exists "auth read storage" on storage.objects;
create policy "auth read storage"
  on storage.objects for select
  using (bucket_id in ('documents','site-photos','reports') and auth.uid() is not null);

drop policy if exists "pm write storage" on storage.objects;
create policy "pm write storage"
  on storage.objects for insert
  with check (bucket_id in ('documents','site-photos','reports') and public.is_pm());

drop policy if exists "pm update storage" on storage.objects;
create policy "pm update storage"
  on storage.objects for update
  using (bucket_id in ('documents','site-photos','reports') and public.is_pm())
  with check (bucket_id in ('documents','site-photos','reports') and public.is_pm());

drop policy if exists "pm delete storage" on storage.objects;
create policy "pm delete storage"
  on storage.objects for delete
  using (bucket_id in ('documents','site-photos','reports') and public.is_pm());

-- 4. Verify: expect three rows, all public = false, and no policy named 'Public %'.
-- select id, public from storage.buckets where id in ('documents','site-photos','reports');
-- select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';
