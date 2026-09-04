// Shared schedule utilities — phase colors, date helpers, risk detection.
// Used by GanttView, KanbanBoard, TaskFilters so they stay in sync.

export type ScheduleTask = {
  id: string;
  project_id: string;
  title: string;
  phase: string | null;
  zone: string | null;
  owner: string | null;
  priority: string;
  kanban_status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: number;
  due_date: string | null;
  constraint_note: string | null;
  notes: string | null;
  depends_on?: string[] | null;
};

// 11 distinct phase colors (mirrors CDC schedule visualizer palette).
// Phase names are dynamic (data-driven), so we hash unknown phases to a color.
export const PHASE_PALETTE = [
  '#0891b2', // 0 — cyan-600
  '#7c3aed', // 1 — violet-600
  '#2563eb', // 2 — blue-600
  '#db2777', // 3 — pink-600
  '#ea580c', // 4 — orange-600
  '#16a34a', // 5 — green-600
  '#ca8a04', // 6 — yellow-600
  '#dc2626', // 7 — red-600
  '#0d9488', // 8 — teal-600
  '#9333ea', // 9 — purple-600
  '#475569', // 10 — slate-600
];

export const MILESTONE_COLOR = '#f59e0b'; // amber-500
export const EXPRESS_COLOR = '#ef4444';   // red-500
export const CRITICAL_COLOR = '#dc2626';  // red-600
export const TODAY_COLOR = '#0f172a';     // slate-900

const PHASE_COLOR_CACHE: Record<string, string> = {};

export function phaseColor(phase: string | null | undefined): string {
  if (!phase) return '#94a3b8'; // slate-400
  if (PHASE_COLOR_CACHE[phase]) return PHASE_COLOR_CACHE[phase];
  // Stable hash → palette index
  let h = 0;
  for (let i = 0; i < phase.length; i++) h = (h * 31 + phase.charCodeAt(i)) >>> 0;
  const c = PHASE_PALETTE[h % PHASE_PALETTE.length];
  PHASE_COLOR_CACHE[phase] = c;
  return c;
}

export function isMilestone(t: ScheduleTask): boolean {
  const n = (t.notes || '').toLowerCase();
  const title = (t.title || '').toLowerCase();
  return n.includes('milestone') || n.includes('bàn giao') || title.includes('handover');
}

export function isExpress(t: ScheduleTask): boolean {
  const n = (t.notes || '').toLowerCase();
  const title = (t.title || '').toLowerCase();
  return (
    n.includes('express') ||
    n.includes('rủi ro cao') ||
    n.includes('fast-track') ||
    n.includes('compressed') ||
    title.includes('express') ||
    title.includes('fast-track') ||
    title.includes('compressed')
  );
}

export function barColor(t: ScheduleTask, critical = false): string {
  if (critical) return CRITICAL_COLOR;
  if (isMilestone(t)) return MILESTONE_COLOR;
  if (isExpress(t)) return EXPRESS_COLOR;
  return phaseColor(t.phase);
}

export function priorityColor(p: string): string {
  if (p === 'High') return '#ef4444';
  if (p === 'Medium') return '#f59e0b';
  if (p === 'Low') return '#22c55e';
  return '#94a3b8';
}

export function parseDate(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

export function daysBetween(a: string | null, b: string | null): number | null {
  const pa = parseDate(a);
  const pb = parseDate(b);
  if (pa == null || pb == null) return null;
  return Math.max(1, Math.round((pb - pa) / 86400000) + 1); // inclusive
}

export function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// Build the list of months spanning [min, max] for Gantt column headers.
export function monthColumns(minTs: number, maxTs: number): { key: string; label: string; startTs: number; endTs: number }[] {
  const out: { key: string; label: string; startTs: number; endTs: number }[] = [];
  const d = new Date(minTs);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const end = new Date(maxTs);
  end.setMonth(end.getMonth() + 1);
  while (d < end) {
    const start = d.getTime();
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
      startTs: start,
      endTs: next.getTime(),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

// Critical path: longest chain through depends_on (BFS from each leaf).
export function computeCriticalSet(tasks: ScheduleTask[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  function depth(id: string, visiting = new Set<string>()): number {
    if (visiting.has(id)) return 0; // cycle guard
    if (memo.has(id)) return memo.get(id)!;
    const t = byId.get(id);
    if (!t || !(t.depends_on && t.depends_on.length)) {
      memo.set(id, 1);
      return 1;
    }
    visiting.add(id);
    const d = 1 + Math.max(...t.depends_on.map((dep) => depth(dep, new Set(visiting))));
    visiting.delete(id);
    memo.set(id, d);
    return d;
  }
  let maxD = 0;
  const crit = new Set<string>();
  tasks.forEach((t) => {
    const d = depth(t.id);
    if (d > maxD) maxD = d;
  });
  // Mark all tasks on any chain of length === maxD
  function walk(id: string, path: string[]) {
    const t = byId.get(id);
    if (!t) return;
    const newPath = [...path, id];
    if (memo.get(id) === 1) {
      if (newPath.length === maxD) newPath.forEach((x) => crit.add(x));
      return;
    }
    (t.depends_on || []).forEach((dep) => walk(dep, newPath));
  }
  tasks.forEach((t) => walk(t.id, []));
  return crit;
}

export function uniquePhases(tasks: ScheduleTask[]): string[] {
  const seen = new Set<string>();
  tasks.forEach((t) => { if (t.phase) seen.add(t.phase); });
  return Array.from(seen);
}

export function uniqueOwners(tasks: ScheduleTask[]): string[] {
  const seen = new Set<string>();
  tasks.forEach((t) => { if (t.owner) seen.add(t.owner); });
  return Array.from(seen);
}

export function uniqueZones(tasks: ScheduleTask[]): string[] {
  const seen = new Set<string>();
  tasks.forEach((t) => { if (t.zone) seen.add(t.zone); });
  return Array.from(seen);
}

/**
 * Kanban column colors. Lives here rather than in KanbanBoard so the board and
 * the task editor tint the same status identically.
 */
export const KANBAN_STATUS_COLOR: Record<string, string> = {
  'To Do': '#94a3b8',       // slate-400
  'In Progress': '#2563eb', // blue-600
  Review: '#a855f7',        // purple-500
  Done: '#22c55e',          // green-500
};

export function statusColor(status: string | null | undefined): string {
  if (!status) return '#94a3b8';
  return KANBAN_STATUS_COLOR[status] || '#94a3b8';
}
