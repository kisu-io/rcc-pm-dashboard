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

import { partitionByKind, type ClassifiableTask } from './task-kind';

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

export type ModularTask = ClassifiableTask & {
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
  /** Every record in the module, both kinds. */
  total: number;
  /** Schedulable, owned actions. */
  workTotal: number;
  workDone: number;
  /** Opening-acceptance criteria. Normally undated and unowned — correctly so. */
  gatesTotal: number;
  gatesMet: number;
  /** 0..100, derived from work alone unless the PM overrode it. */
  progressPct: number;
  /** True when progressPct came from the PM's override, not from the records. */
  isOverridden: boolean;
  /** Open work. This is what "pending" means on screen. */
  pending: number;
  /** Open work, dated, and the date has passed. */
  overdue: number;
  /** Open work with no date — the genuine scheduling gap. Gates are excluded. */
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

type StateInput = {
  total: number;
  workTotal: number;
  workDone: number;
  gatesTotal: number;
  gatesMet: number;
  overdue: number;
  wip: number;
  isOverridden: boolean;
  progressPct: number;
};

/** A hand-entered override must never draw past the end of its bar. */
function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function stateFor(r: StateInput): ModuleState {
  // An override is the team reporting progress before loading a workbook —
  // the whole reason the column exists. Calling that "no records" printed an
  // em-dash above a bar filled to the number the PM had just typed.
  if (r.total === 0) {
    if (!r.isOverridden) return 'no-data';
    return r.progressPct >= 100 ? 'complete' : 'on-track';
  }
  // Done means both populations are finished: the work is delivered and the
  // acceptance criteria are signed off.
  if (r.workDone === r.workTotal && r.gatesMet === r.gatesTotal) return 'complete';
  // A late module is the louder signal, so it outranks "nothing started yet".
  // Lateness always comes from the records, never from the override — a PM
  // reporting 100% does not make an overdue row on time.
  if (r.overdue > 0) return 'behind';
  if (r.workDone === 0 && r.wip === 0) return 'not-started';
  return 'on-track';
}

/**
 * One module's figures.
 *
 * Work and gates are counted separately, because they are structurally
 * different populations — see lib/task-kind.ts. Blending them is what produced
 * the "Avg Progress 6%" this codebase already diagnosed and removed: on the
 * live programme the two honest figures are work 37/356 = 10% and gates
 * 5/323 = 2%, and 6% is neither. Worse, a blended figure moves when a gate is
 * added and no work changes. Percentage, pending, overdue and unscheduled all
 * come from work; gates get their own met/total ratio.
 *
 * `override` is the project's stored pct_<module>, where 0 means "auto".
 * (supabase-phase6.sql created these columns with `default 0`; nothing has
 * ever reset existing rows, and components/AddProjectModal.tsx writes whatever
 * a PM types, so a non-zero value here is a deliberate entry.) It replaces the
 * derived percentage but never the lateness — a PM reporting 100% does not
 * make an overdue row on time.
 */
export function moduleProgress(
  module: ModuleKey,
  tasks: ModularTask[],
  today: string,
  override: number | null | undefined,
): ModuleProgress {
  const { work, gates } = partitionByKind(tasks);
  const openWork = work.filter((t) => t.kanban_status !== 'Done');

  const workTotal = work.length;
  const workDone = work.length - openWork.length;
  const overdue = openWork.filter((t) => !!t.due_date && isPast(t.due_date, today)).length;
  const wip = work.filter((t) => t.kanban_status === 'In Progress').length;

  const isOverridden = override != null && override > 0;
  const progressPct = isOverridden
    ? clampPct(override)
    : workTotal === 0
      ? 0
      : Math.round((workDone / workTotal) * 100);

  const figures = {
    total: tasks.length,
    workTotal,
    workDone,
    gatesTotal: gates.length,
    gatesMet: gates.filter((t) => t.kanban_status === 'Done').length,
    overdue,
    wip,
    isOverridden,
    progressPct,
  };

  return {
    module,
    ...figures,
    pending: openWork.length,
    unscheduled: openWork.filter((t) => !t.due_date).length,
    state: stateFor(figures),
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
