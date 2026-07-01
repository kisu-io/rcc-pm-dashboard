// SERVER-ONLY — fetched by server components (cookie-aware auth)
import 'server-only';
import { Project, Task, Milestone, DocumentRow, Material } from './supabase';
import { createServerSupabase } from './supabase-server';
import { demoProjects, demoTasks, demoMilestones } from './data';

const hasKey =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getProjects(): Promise<Project[]> {
  if (!hasKey) return demoProjects;
  const s = await createServerSupabase();
  const { data, error } = await s.from('projects').select('*').order('created_at');
  if (error || !data?.length) return demoProjects;
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!hasKey) return demoProjects.find((p) => p.id === id) || null;
  const s = await createServerSupabase();
  const { data, error } = await s.from('projects').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Project;
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  if (!hasKey) return projectId ? demoTasks.filter((t) => t.project_id === projectId) : demoTasks;
  const s = await createServerSupabase();
  let q = s.from('tasks').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error || !data?.length) return projectId ? [] : demoTasks;
  return data as Task[];
}

export async function getMilestones(projectId?: string): Promise<Milestone[]> {
  if (!hasKey) return projectId ? demoMilestones.filter((m) => m.project_id === projectId) : demoMilestones;
  const s = await createServerSupabase();
  let q = s.from('milestones').select('*').order('due_date');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error || !data?.length) return [];
  return data as Milestone[];
}

export async function getDocuments(projectId?: string): Promise<DocumentRow[]> {
  if (!hasKey) return [];
  const s = await createServerSupabase();
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
  const s = await createServerSupabase();
  let q = s.from('materials').select('*').order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) {
    console.error('[getMaterials] error:', error.message);
    return [];
  }
  return (data as Material[]) || [];
}