-- RCC PM Dashboard — schema v1.10: fix list_users_with_roles() return type
--
-- /admin/users was failing in production. Vercel's runtime log:
--
--   DataFetchError: [listUsersWithRoles] structure of query does not match
--   function result type          routes=/admin/users
--
-- The function declares RETURNS TABLE(..., email text, ...) but selects
-- auth.users.email, which Supabase defines as character varying(255).
-- PostgreSQL does not implicitly coerce varchar to text when a plpgsql
-- RETURN QUERY is checked against a declared TABLE type, so every call raised
-- and the page fell through to its error boundary. The role column has the
-- same exposure via COALESCE.
--
-- Fix: cast both explicitly. Behaviour is otherwise unchanged, including the
-- admin-only gate.
--
-- Idempotent: CREATE OR REPLACE. Already applied to production.

create or replace function public.list_users_with_roles()
returns table(user_id uuid, email text, created_at timestamptz, role text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select
      u.id                             as user_id,
      u.email::text                    as email,
      u.created_at                     as created_at,
      coalesce(r.role, 'viewer')::text as role
    from auth.users u
    left join public.user_roles r on r.user_id = u.id
    order by u.created_at;
end;
$function$;

-- verify (as an admin session): should list every auth user with a role
--   select * from list_users_with_roles();
