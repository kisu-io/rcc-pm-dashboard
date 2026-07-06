// SERVER-ONLY — fetched by server components (cookie-aware auth)
import 'server-only';
import { Project, Task, Milestone, DocumentRow, Material, CostEntry } from './supabase';
import { createServerSupabase } from './supabase-server';
import { demoProjects, demoTasks, demoMilestones } from './data';

const hasKey =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getProjects(): Promise<Project[]> {
  if (!hasKey) return demoProjects;
  const s = createServerSupabase();
  const { data, error } = await s.from('projects').select('*').order('created_at');
  if (error || !data?.length) return demoProjects;
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!hasKey) return demoProjects.find((p) => p.id === id) || null;
  const s = createServerSupabase();
  const { data, error } = await s.from('projects').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    // Fall back to demo data if the lookup fails (e.g. dummy key / network error)
    return demoProjects.find((p) => p.id === id) || null;
  }
  return data as Project;
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  if (!hasKey) return projectId ? demoTasks.filter((t) => t.project_id === projectId) : demoTasks;
  const s = createServerSupabase();
  let q = s.from('tasks').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error || !data?.length) {
    // Fall back to demo data on error (e.g. dummy key / network error)
    return projectId ? demoTasks.filter((t) => t.project_id === projectId) : demoTasks;
  }
  return data as Task[];
}

export async function getMilestones(projectId?: string): Promise<Milestone[]> {
  if (!hasKey) return projectId ? demoMilestones.filter((m) => m.project_id === projectId) : demoMilestones;
  const s = createServerSupabase();
  let q = s.from('milestones').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error || !data?.length) {
    // Fall back to demo data on error (e.g. dummy key / network error)
    return projectId ? demoMilestones.filter((m) => m.project_id === projectId) : demoMilestones;
  }
  return data as Milestone[];
}

export async function getDocuments(projectId?: string): Promise<DocumentRow[]> {
  if (!hasKey) return [];
  const s = createServerSupabase();
  let q = s.from('documents').select('*').order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) {
    console.error('[getDocuments] error:', error.message);
    return [];
  }
  return (data as DocumentRow[]) || [];
}

export async function getMaterials(projectId?: string): Promise<Material[]> {
  if (!hasKey) return [];
  const s = createServerSupabase();
  let q = s.from('materials').select('*').order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) {
    console.error('[getMaterials] error:', error.message);
    return [];
  }
  return (data as Material[]) || [];
}

export async function getCostEntries(projectId?: string): Promise<CostEntry[]> {
  if (!hasKey) return [];
  const s = createServerSupabase();
  let q = s.from('cost_entries').select('*').order('date', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) {
    console.error('[getCostEntries] error:', error.message);
    return [];
  }
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
  if (!hasKey) return [];
  const s = createServerSupabase();
  const { data, error } = await s.rpc('list_users_with_roles');
  if (error) {
    console.error('[listUsersWithRoles] error:', error.message);
    return [];
  }
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
  if (!hasKey) return [];
  const s = createServerSupabase();
  const { data, error } = await s
    .from('activity_log')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[getActivityLog] error:', error.message);
    return [];
  }
  return (data as ActivityLogRow[]) || [];
}