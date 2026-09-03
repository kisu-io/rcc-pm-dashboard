// SERVER-ONLY — fetched by server components (cookie-aware auth)
import 'server-only';
import { Project, Task, Milestone, DocumentRow, Material, CostEntry } from './supabase';
import { createServerSupabase } from './supabase-server';
import { demoProjects, demoTasks, demoMilestones } from './data';
import { E2E_BYPASS_AUTH } from './env';

const hasKey =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// E2E mode: use demo data (dummy Supabase key, bypass auth). Ignored in a
// production build — see lib/env.ts.
const isE2E = E2E_BYPASS_AUTH;

// Demo fallback ONLY when no Supabase env vars (local dev) OR E2E bypass mode.
// Production (with real env vars, no bypass) always returns real data or empty.

/**
 * A failed query must never be reported as "no rows".
 *
 * Returning [] on error made a broken read indistinguishable from a healthy,
 * empty project: the dashboard rendered 0 active projects, 0 at risk, 0 overdue
 * and "Schedule Health 100%" from data it never actually received. Throwing
 * hands the failure to the nearest error boundary (app/error.tsx) so the page
 * says it could not load instead of inventing a reassuring number.
 *
 * Note this fires only on a real query error. RLS filtering rows out is not an
 * error — that legitimately returns an empty set.
 */
export class DataFetchError extends Error {
  readonly source: string;
  constructor(source: string, message: string) {
    super(`[${source}] ${message}`);
    this.name = 'DataFetchError';
    this.source = source;
  }
}

export async function getProjects(): Promise<Project[]> {
  if (!hasKey || isE2E) return demoProjects;
  const s = createServerSupabase();
  const { data, error } = await s.from('projects').select('*').order('created_at');
  if (error) throw new DataFetchError('getProjects', error.message);
  return (data as Project[]) || [];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!hasKey || isE2E) return demoProjects.find((p) => p.id === id) || null;
  const s = createServerSupabase();
  const { data, error } = await s.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new DataFetchError('getProject', error.message);
  return (data as Project) || null;
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  if (!hasKey || isE2E) return projectId ? demoTasks.filter((t) => t.project_id === projectId) : demoTasks;
  const s = createServerSupabase();
  let q = s.from('tasks').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw new DataFetchError('getTasks', error.message);
  return (data as Task[]) || [];
}

export async function getMilestones(projectId?: string): Promise<Milestone[]> {
  if (!hasKey || isE2E) return projectId ? demoMilestones.filter((m) => m.project_id === projectId) : demoMilestones;
  const s = createServerSupabase();
  let q = s.from('milestones').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw new DataFetchError('getMilestones', error.message);
  return (data as Milestone[]) || [];
}

export async function getDocuments(projectId?: string): Promise<DocumentRow[]> {
  if (!hasKey || isE2E) return [];
  const s = createServerSupabase();
  let q = s.from('documents').select('*').order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw new DataFetchError('getDocuments', error.message);
  return (data as DocumentRow[]) || [];
}

export async function getMaterials(projectId?: string): Promise<Material[]> {
  if (!hasKey || isE2E) return [];
  const s = createServerSupabase();
  let q = s.from('materials').select('*').order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw new DataFetchError('getMaterials', error.message);
  return (data as Material[]) || [];
}

export async function getCostEntries(projectId?: string): Promise<CostEntry[]> {
  if (!hasKey || isE2E) return [];
  const s = createServerSupabase();
  let q = s.from('cost_entries').select('*').order('date', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw new DataFetchError('getCostEntries', error.message);
  return (data as CostEntry[]) || [];
}

/** Server-side: returns the current user's role (or 'anonymous').
 *  Uses the security-definer RPC `current_user_role()` to bypass RLS
 *  (the direct select on user_roles can fail if the SSR cookie session
 *  isn't fully hydrated on first render).
 */
export async function getServerRole(): Promise<'anonymous' | 'viewer' | 'pm' | 'admin'> {
  if (!hasKey) return 'anonymous';
  const s = createServerSupabase();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return 'anonymous';
  const { data, error } = await s.rpc('current_user_role');
  if (error) {
    console.error('[getServerRole] RPC error:', error.message);
    // Fallback to direct query if RPC missing (pre-phase-3 schema)
    const { data: row } = await s.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    return (row?.role as 'viewer' | 'pm' | 'admin') || 'viewer';
  }
  return (data as string) as 'anonymous' | 'viewer' | 'pm' | 'admin';
}

/** Server-side: list all users with roles (admin only — RPC enforces). */
export async function listUsersWithRoles(): Promise<{ user_id: string; email: string; created_at: string; role: string }[]> {
  if (!hasKey || isE2E) return [];
  const s = createServerSupabase();
  const { data, error } = await s.rpc('list_users_with_roles');
  if (error) throw new DataFetchError('listUsersWithRoles', error.message);
  return (data as { user_id: string; email: string; created_at: string; role: string }[]) || [];
}

export type ActivityLogRow = {
  id: number;
  ts: string;
  actor: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/** Server-side: recent activity log (admin only — RLS allows any authed user to read, but we gate in UI). */
export async function getActivityLog(limit = 100): Promise<ActivityLogRow[]> {
  if (!hasKey || isE2E) return [];
  const s = createServerSupabase();
  const { data, error } = await s
    .from('activity_log')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit);
  if (error) throw new DataFetchError('getActivityLog', error.message);
  return (data as ActivityLogRow[]) || [];
}