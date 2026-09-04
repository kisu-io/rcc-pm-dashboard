/**
 * The six delivery modules the programme is run by.
 *
 * Agreed at the 2026-09-04 review: Legal, Design, Procurement/Purchasing,
 * Construction, Sales & Marketing, Operation. These are organisational silos —
 * each one is a different team with its own workbook — which is why the home
 * page reports progress per module rather than per phase.
 *
 * This replaces the five residential-development "phase" buckets that used to
 * live in lib/phase.ts. Those were inferred from free text in `tasks.phase`,
 * and against the live dataset the inference routed 629 of 679 rows into
 * "Thi công" while Design and Sales sat at 0% permanently — the classifier was
 * guessing at a taxonomy the data never carried.
 *
 * `tasks.module` (supabase-phase10.sql) records the answer explicitly instead.
 * Every row currently in the database belongs to the Operation team's
 * pre-opening checklist, so that is both the backfill and the fallback: the
 * app reads correctly whether or not the migration has been applied, the same
 * arrangement task_kind uses.
 *
 * `tasks.phase` keeps its own meaning — the department inside a module
 * (Engineering, Culinary, Housekeeping…) — and still drives the department
 * ledger on each project page.
 */

export const MODULES = [
  'legal',
  'design',
  'procurement',
  'construction',
  'sales',
  'operation',
] as const;

export type ModuleKey = (typeof MODULES)[number];

/** Reading order on every screen: the sequence the meeting listed them in. */
export const MODULE_ORDER: ModuleKey[] = [
  'legal',
  'design',
  'procurement',
  'construction',
  'sales',
  'operation',
];

/** The programme runs bilingual copy; both labels are shown together. */
export const MODULE_LABELS: Record<ModuleKey, { en: string; vn: string }> = {
  legal: { en: 'Legal', vn: 'Pháp lý' },
  design: { en: 'Design', vn: 'Thiết kế' },
  procurement: { en: 'Procurement', vn: 'Cung ứng — Mua hàng' },
  construction: { en: 'Construction', vn: 'Thi công' },
  sales: { en: 'Sales & Marketing', vn: 'Kinh doanh — Tiếp thị' },
  operation: { en: 'Operation', vn: 'Vận hành' },
};

/** Identity only. Semantic state has its own scale — see lib/ui.ts. */
export const MODULE_COLORS: Record<ModuleKey, string> = {
  legal: '#a855f7',
  design: '#06b6d4',
  procurement: '#f59e0b',
  construction: '#2563eb',
  sales: '#ec4899',
  operation: '#14b8a6',
};

/** The column on `projects` holding a PM's manual override for each module. */
export const MODULE_PCT_COLUMN: Record<ModuleKey, string> = {
  legal: 'pct_legal',
  design: 'pct_design',
  procurement: 'pct_procurement',
  construction: 'pct_construction',
  sales: 'pct_sales',
  operation: 'pct_operation',
};

const MODULE_SET = new Set<string>(MODULES);

export type ModularTask = {
  module?: string | null;
  kanban_status?: string | null;
  due_date?: string | null;
};

/**
 * Which module a task belongs to.
 *
 * Unrecognised and missing values resolve to `operation` rather than to a
 * separate "unassigned" bucket: every row in the database today is the
 * operation team's, so an honest default is better than a seventh module that
 * exists only to hold rows the migration has not reached yet.
 */
export function classifyModule(task: ModularTask): ModuleKey {
  const raw = task.module?.trim().toLowerCase();
  if (raw && MODULE_SET.has(raw)) return raw as ModuleKey;
  return 'operation';
}

// ------------------------------------------------------------------ progress

/**
 * `no-data`     — the module has no records yet; the team has not loaded theirs.
 * `not-started` — records exist, nothing done and nothing in progress.
 * `behind`      — at least one open item is past its date.
 * `on-track`    — work is moving and none of it is late.
 * `complete`    — every record done.
 */
export type ModuleState = 'no-data' | 'not-started' | 'behind' | 'on-track' | 'complete';

export type ModuleProgress = {
  module: ModuleKey;
  total: number;
  done: number;
  /** 0..100. */
  progressPct: number;
  /** True when progressPct came from the PM's override, not from the tasks. */
  isOverridden: boolean;
  /** Open — everything not yet Done. This is what "pending" means on screen. */
  pending: number;
  /** Open, dated, and the date has passed. */
  overdue: number;
  /** Open with no date at all. */
  unscheduled: number;
  wip: number;
  state: ModuleState;
};

const MS_PER_DAY = 86400000;

function isPast(due: string, today: string): boolean {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.round((b - a) / MS_PER_DAY) < 0;
}

function stateFor(total: number, done: number, overdue: number, wip: number): ModuleState {
  if (total === 0) return 'no-data';
  if (done === total) return 'complete';
  // A late module is the louder signal, so it outranks "nothing started yet".
  if (overdue > 0) return 'behind';
  if (done === 0 && wip === 0) return 'not-started';
  return 'on-track';
}

/**
 * One module's figures.
 *
 * `override` is the project's stored pct_<module>. Zero means "auto" in this
 * schema — supabase-phase7.sql reset every project to 0 precisely so the app
 * would derive the number — so only a value above zero wins.
 */
export function moduleProgress(
  module: ModuleKey,
  tasks: ModularTask[],
  today: string,
  override: number | null | undefined,
): ModuleProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.kanban_status === 'Done').length;
  const open = tasks.filter((t) => t.kanban_status !== 'Done');
  const overdue = open.filter((t) => !!t.due_date && isPast(t.due_date, today)).length;
  const wip = tasks.filter((t) => t.kanban_status === 'In Progress').length;
  const isOverridden = override != null && override > 0;

  return {
    module,
    total,
    done,
    progressPct: isOverridden
      ? Math.round(override)
      : total === 0
        ? 0
        : Math.round((done / total) * 100),
    isOverridden,
    pending: open.length,
    overdue,
    unscheduled: open.filter((t) => !t.due_date).length,
    wip,
    state: stateFor(total, done, overdue, wip),
  };
}

export type ModuleOverrides = Partial<Record<
  'pct_legal' | 'pct_design' | 'pct_procurement' | 'pct_construction' | 'pct_sales' | 'pct_operation',
  number | null
>>;

function overrideFor(project: ModuleOverrides, module: ModuleKey): number | null {
  const column = MODULE_PCT_COLUMN[module] as keyof ModuleOverrides;
  return project[column] ?? null;
}

function groupByModule<T extends ModularTask>(tasks: T[]): Record<ModuleKey, T[]> {
  const groups = Object.fromEntries(MODULE_ORDER.map((m) => [m, [] as T[]])) as Record<
    ModuleKey,
    T[]
  >;
  for (const task of tasks) groups[classifyModule(task)].push(task);
  return groups;
}

/**
 * All six modules for one project, always in MODULE_ORDER and always all six —
 * a module with nothing in it is a finding, not a row to hide.
 */
export function projectModules(
  project: ModuleOverrides,
  tasks: ModularTask[],
  today: string,
): ModuleProgress[] {
  const groups = groupByModule(tasks);
  return MODULE_ORDER.map((m) => moduleProgress(m, groups[m], today, overrideFor(project, m)));
}

/**
 * All six modules rolled up across the portfolio.
 *
 * Per-project overrides are deliberately not applied here: they are a PM's
 * judgement about one estate and cannot be averaged into a meaningful
 * portfolio figure. Tasks belonging to no listed project are ignored rather
 * than silently attributed to the first one.
 */
export function portfolioModules<P extends { id: string }>(
  projects: P[],
  tasks: (ModularTask & { project_id?: string | null })[],
  today: string,
): ModuleProgress[] {
  const known = new Set(projects.map((p) => p.id));
  const owned = tasks.filter((t) => !!t.project_id && known.has(t.project_id));
  const groups = groupByModule(owned);
  return MODULE_ORDER.map((m) => moduleProgress(m, groups[m], today, null));
}

// ------------------------------------------------------------------- overall

/**
 * A project's headline percentage.
 *
 * Hybrid, matching the module bars: a stored progress_pct above zero is the
 * PM's override, otherwise derive it from Done / total.
 */
export function effectiveProgress(
  project: { progress_pct?: number | null },
  tasks: { kanban_status?: string | null }[],
): number {
  const stored = project?.progress_pct;
  if (stored != null && stored > 0) return Math.round(stored);
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.kanban_status === 'Done').length / tasks.length) * 100);
}
