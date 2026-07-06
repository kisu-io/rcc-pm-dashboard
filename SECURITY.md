# RCC PM Dashboard — Security Review (Phase 5c)

**Date:** 2026-07-06
**Reviewer:** Hermes Agent (automated)
**Scope:** RLS policies, triggers, security-definer functions, repo secrets.

## Summary

**No critical issues found.** Repo is clean of secrets. RLS is correctly enabled on every table. Two minor hardening recommendations below.

## RLS posture

| Table | SELECT | INSERT/UPDATE/DELETE | Notes |
|---|---|---|---|
| `projects` | `auth.uid() is not null` | `is_pm()` (pm/admin) | ✅ |
| `tasks` | `auth.uid() is not null` | `is_pm()` | ✅ |
| `milestones` | `auth.uid() is not null` | `is_pm()` | ✅ |
| `documents` | `auth.uid() is not null` | `is_pm()` | ✅ |
| `materials` | `auth.uid() is not null` | `is_pm()` | ✅ Phase 4 `read all`/`write all` dropped & replaced in `supabase-auth.sql` |
| `cost_entries` | `auth.uid() is not null` | `is_pm()` | ✅ new in Phase 5 |
| `activity_log` | `auth.uid() is not null` | **no policy** (trigger-only write) | ✅ append-only |
| `user_roles` | `auth.uid() is not null` | insert: self OR admin · update: admin only | ⚠️ see below |
| Storage buckets | `auth.uid() is not null` | `is_pm()` | ✅ |

## Security-definer functions

| Function | Privilege | Gate | Safe? |
|---|---|---|---|
| `current_user_role()` | reads `user_roles` for `auth.uid()` | none (anyone can call, only reads own role) | ✅ |
| `is_pm()` | wraps `current_user_role()` | none needed | ✅ |
| `list_users_with_roles()` | reads `auth.users` + `user_roles` | **raises 42501 if caller is not admin** | ✅ |
| `recompute_project_spent()` | updates `projects.spent` | only callable via trigger on `cost_entries` writes, which are gated to `is_pm()` | ✅ |
| `log_write()` | inserts into `activity_log` | only callable via triggers; no direct INSERT policy on `activity_log` | ✅ |

## Repo secrets scan

- **`.env.local` / `.env`** — gitignored (`.gitignore` confirmed).
- **`.env.example`** — checked in, contains only placeholder (`your-anon-key-here`). ✅
- **Git history scan** — no `service_role` keys, no JWTs, no passwords in any commit. Only a documentation comment mentioning `service_role` as bootstrap guidance. ✅
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — intentionally public (client-side Supabase), safe to expose. RLS is the gate, not the key.

## Findings & recommendations

### ✅ No critical issues

All write paths are gated by `is_pm()` or admin-only checks. Read paths require authentication. Anon access is blocked everywhere (explicit `auth.uid() is not null`).

### ⚠️ Minor: `user_roles` update policy is admin-only but has no `WITH CHECK`

```sql
create policy "update own role" on public.user_roles
  for update
  using (auth.uid() in (select user_id from public.user_roles where role = 'admin'));
```

There's no `with check` clause. A admin could theoretically set `role` to an arbitrary string — but the `CHECK (role in ('pm', 'viewer', 'admin'))` column constraint prevents this. So the table-level CHECK compensates. **No action required**, but adding `with check (role in ('pm','viewer','admin'))` would be belt-and-suspenders.

### ⚠️ Minor: `user_roles` has no DELETE policy

Admins cannot delete a `user_roles` row via the client SDK (only insert/upsert). This is intentional — we don't want users to be un-personned from the UI. If cleanup is needed, do it in Supabase Studio.

### ℹ️ Note: `activity_log` RLS allows any authenticated user to read

This is by design for now (roadmap Phase 7 mentions an in-app notification center backed by `activity_log`). If sensitive fields end up in `before`/`after` JSONB (e.g. vendor pricing), consider tightening to admin-only or redacting columns.

## Remediation

No changes required for Phase 5 sign-off. Recommendations above are tracked for future hardening.