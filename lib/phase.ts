// Phase classification + breakdown helpers — shared between dashboard and project detail.

export const PHASE_BUCKETS = ['legal', 'design', 'procurement', 'construction', 'sales'] as const;
export type PhaseBucket = typeof PHASE_BUCKETS[number];

export const PHASE_LABELS_VN: Record<PhaseBucket, string> = {
  legal: 'Pháp lý',
  design: 'Thiết kế',
  procurement: 'Cung ứng-Đấu thầu',
  construction: 'Thi công',
  sales: 'Sales & marketing',
};

export const PHASE_ORDER: PhaseBucket[] = ['legal', 'design', 'procurement', 'construction', 'sales'];
export const PHASE_COLORS: Record<PhaseBucket, string> = {
  legal: '#a855f7', design: '#06b6d4', procurement: '#f59e0b', construction: '#2563eb', sales: '#ec4899',
};

/** Effective overall progress for a project.
 *  Hybrid: if project.progress_pct > 0 (PM entered manually), use it.
 *  Otherwise auto-calc = Done tasks / total tasks * 100.
 *  Returns 0..100. */
export function effectiveProgress(
  project: { progress_pct?: number | null },
  tasks: { kanban_status?: string | null }[],
): number {
  const stored = project?.progress_pct;
  if (stored != null && stored > 0) return Math.round(stored);
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.kanban_status === 'Done').length;
  return Math.round((done / tasks.length) * 100);
}

/** Map a task.phase string to one of 5 phase buckets. Returns null only when phase is null/empty. */
export function classifyPhase(phase: string | null): PhaseBucket | null {
  if (!phase) return null;
  const p = phase.toLowerCase().trim();
  if (['legal', 'permit', 'pháp lý', 'phap ly', 'giấy phép', 'giay phep', 'phaply'].some((s) => p.includes(s))) return 'legal';
  if (['design', 'thiết kế', 'thiet ke', 'thietke'].some((s) => p.includes(s))) return 'design';
  if (['procurement', 'tender', 'cung ứng', 'cung ung', 'đấu thầu', 'dau thau', 'materials', 'mua hàng', 'mua hang'].some((s) => p.includes(s))) return 'procurement';
  if (['sales', 'marketing'].some((s) => p.includes(s))) return 'sales';
  // Default: Construction covers Construction / MEP / Inspection / Fit-out / thi công
  return 'construction';
}

/** Compute % per phase bucket for a project.
 *  Hybrid: if the project has a stored pct_<bucket> > 0, use it. Otherwise derive from tasks.
 *  Returns 0..100 per bucket. */
export function phaseBreakdown(
  project: { pct_legal?: number | null; pct_design?: number | null; pct_procurement?: number | null; pct_construction?: number | null; pct_sales?: number | null } | null,
  projectTasks: { phase: string | null; progress_pct: number }[],
): Record<PhaseBucket, number> {
  const stored: Record<PhaseBucket, number | null | undefined> = {
    legal: project?.pct_legal,
    design: project?.pct_design,
    procurement: project?.pct_procurement,
    construction: project?.pct_construction,
    sales: project?.pct_sales,
  };
  const groups: Record<PhaseBucket, number[]> = { legal: [], design: [], procurement: [], construction: [], sales: [] };
  for (const t of projectTasks) {
    const bucket = classifyPhase(t.phase);
    if (!bucket) continue;
    groups[bucket].push(t.progress_pct);
  }
  const out: Record<PhaseBucket, number> = { legal: 0, design: 0, procurement: 0, construction: 0, sales: 0 };
  for (const b of PHASE_BUCKETS) {
    const s = stored[b];
    if (s != null && s > 0) {
      out[b] = Math.round(s);
    } else {
      const arr = groups[b];
      out[b] = arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
    }
  }
  return out;
}