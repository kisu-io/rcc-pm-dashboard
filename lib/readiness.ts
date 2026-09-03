/**
 * Opening-readiness aggregation.
 *
 * This replaces the portfolio arithmetic the dashboard used to do. That code
 * answered "how complete is the portfolio", which for a single pre-opening
 * programme produced two numbers that contradicted each other on the same row:
 * "Schedule Health 100%" (derived from one project's target_end still being in
 * the future) beside "Avg Progress 6%" (Done/total across a mixed population).
 *
 * The question a pre-opening PM actually asks at T-minus-28 is: which
 * department will stop us opening, and who do I call about it. So the unit of
 * measurement here is the department, and the measure of done is the readiness
 * gate — not a percentage.
 *
 * Every function takes `today` rather than reading the clock, so results are
 * deterministic and testable.
 */

import { classifyTaskKind, partitionByKind, type ClassifiableTask } from './task-kind';

const MS_PER_DAY = 86400000;

export type ReadinessTask = ClassifiableTask & {
  id?: string;
  title?: string;
  phase?: string | null;
  owner?: string | null;
  kanban_status?: string | null;
  due_date?: string | null;
  constraint_note?: string | null;
};

/** Today in ISO date form, local calendar day. Impure — keep it out of the maths. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whole days from `fromISO` to `toISO`. Negative means `toISO` is in the past.
 *
 * Parsed as UTC midnight on both sides. The previous helper compared a parsed
 * date against Date.now(), which drifts by a day either side of midnight
 * depending on the viewer's timezone — enough to move a task in and out of
 * "overdue" between two people looking at the same screen.
 */
export function dayDiff(fromISO: string, toISO: string): number | null {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

export function isDone(t: ReadinessTask): boolean {
  return t.kanban_status === 'Done';
}

export function isOpen(t: ReadinessTask): boolean {
  return !isDone(t);
}

/** Open, dated, and the date has passed. Undated rows are never overdue. */
export function isOverdueOn(t: ReadinessTask, today: string): boolean {
  if (isDone(t) || !t.due_date) return false;
  const d = dayDiff(today, t.due_date);
  return d != null && d < 0;
}

// ---------------------------------------------------------------- departments

export type ReadinessStatus =
  | 'clear'          // every gate met, no open work
  | 'not-mobilised'  // gates defined but nothing assigned and nothing scheduled
  | 'nothing-moved'  // every open work item is already late
  | 'behind'         // some work is late
  | 'on-track';      // open work, none late

export type DepartmentReadiness = {
  department: string;
  gates: number;
  gatesMet: number;
  gatesUndated: number;
  workTotal: number;
  workOpen: number;
  workOverdue: number;
  workWip: number;
  workUndated: number;
  owners: string[];
  blockers: number;
  status: ReadinessStatus;
};

function statusFor(r: Omit<DepartmentReadiness, 'status'>): ReadinessStatus {
  if (r.gates > 0 && r.gatesMet === r.gates && r.workOpen === 0) return 'clear';
  // Nobody named and nothing scheduled, but the department has acceptance
  // criteria to meet. At T-28 this is the most dangerous state on the board,
  // and the old dashboard could not represent it at all.
  if (r.workOpen === 0 && r.owners.length === 0 && r.gates > 0) return 'not-mobilised';
  if (r.workOpen > 0 && r.workOverdue === r.workOpen) return 'nothing-moved';
  if (r.workOverdue > 0) return 'behind';
  return 'on-track';
}

const STATUS_RISK: Record<ReadinessStatus, number> = {
  'not-mobilised': 0,
  'nothing-moved': 1,
  behind: 2,
  'on-track': 3,
  clear: 4,
};

export function departmentReadiness(
  tasks: ReadinessTask[],
  today: string,
): DepartmentReadiness[] {
  const byDept = new Map<string, ReadinessTask[]>();
  for (const t of tasks) {
    const key = t.phase?.trim() || 'Unassigned';
    const bucket = byDept.get(key);
    if (bucket) bucket.push(t);
    else byDept.set(key, [t]);
  }

  const rows: DepartmentReadiness[] = [];
  byDept.forEach((deptTasks, department) => {
    const { work, gates } = partitionByKind(deptTasks);
    const openWork = work.filter(isOpen);
    const owners = Array.from(
      new Set(deptTasks.map((t) => t.owner?.trim()).filter((o): o is string => !!o)),
    ).sort();

    const base = {
      department,
      gates: gates.length,
      gatesMet: gates.filter(isDone).length,
      gatesUndated: gates.filter((g) => isOpen(g) && !g.due_date).length,
      workTotal: work.length,
      workOpen: openWork.length,
      workOverdue: openWork.filter((t) => isOverdueOn(t, today)).length,
      workWip: work.filter((t) => t.kanban_status === 'In Progress').length,
      workUndated: openWork.filter((t) => !t.due_date).length,
      owners,
      blockers: deptTasks.filter((t) => isOpen(t) && !!t.constraint_note).length,
    };
    rows.push({ ...base, status: statusFor(base) });
  });

  return rows.sort((a, b) => {
    const rank = STATUS_RISK[a.status] - STATUS_RISK[b.status];
    if (rank !== 0) return rank;
    if (b.workOverdue !== a.workOverdue) return b.workOverdue - a.workOverdue;
    const unmetA = a.gates - a.gatesMet;
    const unmetB = b.gates - b.gatesMet;
    if (unmetB !== unmetA) return unmetB - unmetA;
    return a.department.localeCompare(b.department);
  });
}

// ------------------------------------------------------------------ programme

export type ProgrammeReadiness = {
  openingDate: string | null;
  daysToOpening: number | null;
  gatesTotal: number;
  gatesMet: number;
  workOpen: number;
  workOverdue: number;
  workWip: number;
  undatedOpen: number;
  dueNextFortnight: number;
  dueBeforeOpening: number;
  blockers: number;
  departmentCount: number;
  notMobilised: DepartmentReadiness[];
  nothingMoved: DepartmentReadiness[];
};

export function programmeReadiness(
  tasks: ReadinessTask[],
  today: string,
  openingDate: string | null,
): ProgrammeReadiness {
  const { work, gates } = partitionByKind(tasks);
  const openWork = work.filter(isOpen);
  const departments = departmentReadiness(tasks, today);

  const withinDays = (t: ReadinessTask, days: number) => {
    if (!t.due_date) return false;
    const d = dayDiff(today, t.due_date);
    return d != null && d >= 0 && d <= days;
  };

  const daysToOpening = openingDate ? dayDiff(today, openingDate) : null;

  return {
    openingDate,
    daysToOpening,
    gatesTotal: gates.length,
    gatesMet: gates.filter(isDone).length,
    workOpen: openWork.length,
    workOverdue: openWork.filter((t) => isOverdueOn(t, today)).length,
    workWip: work.filter((t) => t.kanban_status === 'In Progress').length,
    undatedOpen: tasks.filter((t) => isOpen(t) && !t.due_date).length,
    dueNextFortnight: openWork.filter((t) => withinDays(t, 14)).length,
    dueBeforeOpening:
      daysToOpening != null && daysToOpening >= 0
        ? openWork.filter((t) => withinDays(t, daysToOpening)).length
        : 0,
    blockers: tasks.filter((t) => isOpen(t) && !!t.constraint_note).length,
    departmentCount: departments.length,
    notMobilised: departments.filter((d) => d.status === 'not-mobilised'),
    nothingMoved: departments.filter((d) => d.status === 'nothing-moved'),
  };
}

// ------------------------------------------------------------------- listings

/**
 * Work due between today and today+horizon, soonest first.
 *
 * The old look-ahead filtered on `daysFromNow(due) <= 14` with no lower bound,
 * so sorting ascending surfaced the six *most overdue* rows in the table —
 * items 125 to 215 days late — and hid every task actually due in the fortnight.
 * Overdue work is a different list with a different action; see overdueWork().
 */
export function lookAhead(
  tasks: ReadinessTask[],
  today: string,
  horizonDays = 14,
): ReadinessTask[] {
  return tasks
    .filter((t) => {
      if (isDone(t) || !t.due_date) return false;
      const d = dayDiff(today, t.due_date);
      return d != null && d >= 0 && d <= horizonDays;
    })
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
}

/** Open, dated work whose date has passed — most overdue first. */
export function overdueWork(tasks: ReadinessTask[], today: string): ReadinessTask[] {
  return tasks
    .filter((t) => classifyTaskKind(t) === 'work' && isOverdueOn(t, today))
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
}

export type UnscheduledGroup = {
  department: string;
  gates: number;
  work: number;
};

/**
 * Open rows with no date, by department.
 *
 * Gates belong here as a queue to work through, not as a backlog of failures:
 * an acceptance criterion is *supposed* to be undated until someone commits to
 * a date for it. Undated work items are the genuine data gap.
 */
export function unscheduledByDepartment(tasks: ReadinessTask[]): UnscheduledGroup[] {
  const map = new Map<string, UnscheduledGroup>();
  for (const t of tasks) {
    if (!isOpen(t) || t.due_date) continue;
    const department = t.phase?.trim() || 'Unassigned';
    const row = map.get(department) ?? { department, gates: 0, work: 0 };
    if (classifyTaskKind(t) === 'gate') row.gates++;
    else row.work++;
    map.set(department, row);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.gates + b.work - (a.gates + a.work) || a.department.localeCompare(b.department),
  );
}

// ----------------------------------------------------------------- month grid

export type MonthCell = { month: string; total: number; done: number; overdue: number };
export type MonthRow = { department: string; cells: MonthCell[]; undated: number };
export type MonthGrid = { months: string[]; rows: MonthRow[] };

/**
 * Department × month grid — what replaces the Gantt.
 *
 * A Gantt needs a start, an end and a dependency graph. This dataset has none:
 * planned_start is null on every row and depends_on is empty on every row, so
 * GanttView filtered all of them out and the route rendered its empty state.
 * What the data does support is a month bucket per department, which is exactly
 * what the workbook it came from encoded.
 */
export function monthGrid(tasks: ReadinessTask[], today: string): MonthGrid {
  const months = Array.from(
    new Set(tasks.map((t) => t.due_date?.slice(0, 7)).filter((m): m is string => !!m)),
  ).sort();

  const byDept = new Map<string, ReadinessTask[]>();
  for (const t of tasks) {
    const key = t.phase?.trim() || 'Unassigned';
    const bucket = byDept.get(key);
    if (bucket) bucket.push(t);
    else byDept.set(key, [t]);
  }

  const rows: MonthRow[] = [];
  byDept.forEach((deptTasks, department) => {
    const cells = months.map((month) => {
      const inMonth = deptTasks.filter((t) => t.due_date?.slice(0, 7) === month);
      return {
        month,
        total: inMonth.length,
        done: inMonth.filter(isDone).length,
        overdue: inMonth.filter((t) => isOverdueOn(t, today)).length,
      };
    });
    rows.push({
      department,
      cells,
      undated: deptTasks.filter((t) => isOpen(t) && !t.due_date).length,
    });
  });

  const load = (r: MonthRow) => r.cells.reduce((s, c) => s + c.total, 0);
  return {
    months,
    rows: rows.sort((a, b) => load(b) - load(a) || a.department.localeCompare(b.department)),
  };
}
