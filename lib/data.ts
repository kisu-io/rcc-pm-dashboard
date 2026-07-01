import { Project, Task, Milestone, DocumentRow, Material } from './supabase';

// ===== Demo data (fallback when no Supabase key) =====

export const demoProjects: Project[] = [
  { id: '1', name: 'Le Meridien Fit-out', location: 'HCMC', status: 'In Progress', progress_pct: 35, budget: 5e9, spent: 1.75e9, start_date: '2026-06-01', target_end: '2026-12-31', pm: 'Mr Phán', cover_url: null },
  { id: '2', name: 'Riverbank Place Office', location: 'HCMC', status: 'On Hold', progress_pct: 60, budget: 3e9, spent: 1.8e9, start_date: '2026-03-01', target_end: '2026-09-30', pm: 'Mr Phán', cover_url: null },
  { id: '3', name: 'Barson Lounge', location: 'Hanoi', status: 'Complete', progress_pct: 100, budget: 1.2e9, spent: 1.1e9, start_date: '2026-01-01', target_end: '2026-05-15', pm: 'Mr Phán', cover_url: null },
  { id: '4', name: 'AKUNA Beach Club', location: 'Da Nang', status: 'Not Started', progress_pct: 0, budget: 8e9, spent: 0, start_date: '2026-08-01', target_end: '2027-03-31', pm: 'Mr Phán', cover_url: null },
];

export const demoTasks: Task[] = [
  { id: 't1', project_id: '1', title: 'Demo & dọn mặt bằng', phase: 'Construction', zone: 'Lobby', owner: 'Đội A', priority: 'High', kanban_status: 'Done', planned_start: '2026-06-01', planned_end: '2026-06-10', actual_start: '2026-06-01', actual_end: '2026-06-09', progress_pct: 100, due_date: '2026-06-10', constraint_note: null, notes: null },
  { id: 't2', project_id: '1', title: 'MEP rough-in', phase: 'Construction', zone: 'Floor 2', owner: 'Đội B', priority: 'High', kanban_status: 'In Progress', planned_start: '2026-06-11', planned_end: '2026-07-05', actual_start: '2026-06-12', actual_end: null, progress_pct: 45, due_date: '2026-07-05', constraint_note: 'Chờ vật tư ống đồng', notes: null },
  { id: 't3', project_id: '1', title: 'Drywall partition', phase: 'Construction', zone: 'Floor 2', owner: 'Đội C', priority: 'Medium', kanban_status: 'To Do', planned_start: '2026-07-06', planned_end: '2026-07-20', actual_start: null, actual_end: null, progress_pct: 0, due_date: '2026-07-20', constraint_note: null, notes: null },
  { id: 't4', project_id: '1', title: 'Nghiệm thu PCCC', phase: 'Inspection', zone: 'All', owner: 'QA', priority: 'High', kanban_status: 'Review', planned_start: '2026-06-20', planned_end: '2026-06-28', actual_start: '2026-06-21', actual_end: null, progress_pct: 80, due_date: '2026-06-28', constraint_note: 'Chờ lịch cơ quan PCCC', notes: null },
];

export const demoMilestones: Milestone[] = [
  { id: 'm1', project_id: '1', name: 'Design sign-off', due_date: '2026-05-15', status: 'Reached', type: 'Permit' },
  { id: 'm2', project_id: '1', name: 'PCCC acceptance', due_date: '2026-06-28', status: 'Pending', type: 'Inspection' },
  { id: 'm3', project_id: '1', name: 'Handover to client', due_date: '2026-12-20', status: 'Pending', type: 'Handover' },
];

// ===== HELPERS =====

export function formatVND(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

export function daysFromNow(d: string | null): number {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function isOverdue(t: Task): boolean {
  return t.due_date != null && t.kanban_status !== 'Done' && daysFromNow(t.due_date) < 0;
}

export function isLookAhead(t: Task): boolean {
  return t.kanban_status !== 'Done' && daysFromNow(t.due_date) <= 42;
}

// SPI (Schedule Performance Index) — earned/planned
export function computeSPI(tasks: Task[]): number {
  const planned = tasks.reduce((s, t) => s + (t.planned_end ? Math.max(0, 100 - Math.max(0, daysFromNow(t.planned_end)) * 2) : 0), 0);
  const actual = tasks.reduce((s, t) => s + t.progress_pct, 0);
  return planned > 0 ? actual / planned : 1;
}